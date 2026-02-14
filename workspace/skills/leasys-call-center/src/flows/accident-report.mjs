import { sayAndGather, sayAndHangup, redirect, transferToAgent } from '../services/twilio-voice.mjs';
import { createCase } from '../services/salesforce-mock.mjs';
import { findBestShops, formatShopForVoice } from '../services/body-shop-directory.mjs';

const callState = new Map();

function getState(callSid) {
  if (!callState.has(callSid)) {
    callState.set(callSid, { data: {} });
  }
  return callState.get(callSid);
}

function cleanupState(callSid) {
  callState.delete(callSid);
}

export function handleEntry(req) {
  const callSid = req.body.CallSid;
  const callerNumber = req.query.from || req.body.From || 'Unknown';
  const state = getState(callSid);
  state.data.contactPhone = callerNumber;

  return sayAndGather(
    `I'm sorry to hear about your accident. I'll help you report it and get you connected with a body shop. ` +
    `First, can you tell me where the accident occurred? Please provide the street address or nearest intersection.`,
    '/voice/flow/accident-report/gather?step=location',
    { timeout: 10 }
  );
}

export function handleGather(req) {
  const callSid = req.body.CallSid;
  const speech = req.body.SpeechResult || '';
  const step = req.query.step || 'location';
  const state = getState(callSid);

  switch (step) {
    case 'location':
      state.data.location = speech;
      return sayAndGather(
        `Got it, the accident happened at ${speech}. ` +
        `Can you describe the damage to your vehicle? For example, "front bumper dented" or "rear collision damage".`,
        '/voice/flow/accident-report/gather?step=description',
        { timeout: 10 }
      );

    case 'description':
      state.data.description = speech;
      return sayAndGather(
        `Thank you. Were there any other vehicles or parties involved? If yes, please describe. If not, just say "no other parties".`,
        '/voice/flow/accident-report/gather?step=other_parties',
        { timeout: 10 }
      );

    case 'other_parties': {
      const lower = speech.toLowerCase();
      const noParties = lower.includes('no') && (lower.includes('other') || lower.includes('parties') || lower.includes('one'));
      state.data.otherParties = noParties ? null : speech;
      return sayAndGather(
        `Were there any injuries? Please say "yes" or "no".`,
        '/voice/flow/accident-report/gather?step=injuries',
        { timeout: 8 }
      );
    }

    case 'injuries': {
      const hasInjuries = speech.toLowerCase().includes('yes');
      state.data.injuries = hasInjuries;
      if (hasInjuries) {
        cleanupState(callSid);
        return transferToAgent(
          `Since there are injuries involved, I need to connect you with our emergency response team immediately. Please hold.`
        );
      }
      return sayAndGather(
        `Do you have a police report number? If yes, please provide it. If not, say "no report".`,
        '/voice/flow/accident-report/gather?step=police',
        { timeout: 10 }
      );
    }

    case 'police': {
      const noReport = speech.toLowerCase().includes('no');
      state.data.policeReport = noReport ? null : speech;
      return sayAndGather(
        `Let me confirm the details. ` +
        `Location: ${state.data.location}. ` +
        `Damage: ${state.data.description}. ` +
        `${state.data.otherParties ? 'Other parties: ' + state.data.otherParties + '. ' : 'No other parties. '}` +
        `${state.data.policeReport ? 'Police report: ' + state.data.policeReport + '. ' : 'No police report. '}` +
        `Is this correct? Say "yes" to confirm or "no" to start over.`,
        '/voice/flow/accident-report/gather?step=confirm',
        { timeout: 8 }
      );
    }

    case 'confirm': {
      const confirmed = speech.toLowerCase().includes('yes') || speech.toLowerCase().includes('correct') || speech.toLowerCase().includes('right');
      if (!confirmed) {
        cleanupState(callSid);
        return redirect('/voice/flow/accident-report');
      }
      return redirect('/voice/flow/accident-report/finalize');
    }

    default:
      cleanupState(callSid);
      return transferToAgent("I'm having trouble processing your report. Let me connect you with an agent.");
  }
}

export async function handleFinalize(req) {
  const callSid = req.body.CallSid;
  const state = getState(callSid);

  const caseRecord = createCase({
    subject: `Accident Report - ${state.data.location}`,
    description: state.data.description,
    priority: state.data.otherParties ? 'High' : 'Medium',
    contactName: null,
    contactPhone: state.data.contactPhone,
    type: 'Accident Report',
    location: state.data.location,
    otherParties: state.data.otherParties,
    injuries: state.data.injuries,
    policeReport: state.data.policeReport,
  });

  let shopMessage = '';
  const shops = await findBestShops(45.4642, 9.19, { damageType: 'collision', maxResults: 2 });
  if (shops.length > 0) {
    shopMessage = ` I've also found some body shops near you. ${shops.map((s, i) => formatShopForVoice(s, i)).join(' ')} Would you like me to schedule an appointment? You can call us back and say "book appointment" with your case number.`;
  }

  const response = sayAndHangup(
    `Your accident report has been filed. Your case number is ${caseRecord.CaseNumber.split('').join(' ')}. ` +
    `I'll repeat that: ${caseRecord.CaseNumber.split('').join(' ')}. ` +
    `Please save this number for your records.${shopMessage} ` +
    `Thank you for calling Leasys Drivers Assistance. We'll be in touch soon.`
  );

  cleanupState(callSid);
  return response;
}

import { sayAndGather, sayAndHangup, transferToAgent } from '../services/twilio-voice.mjs';
import { getCase, getCaseByPhone, getAppointments } from '../services/salesforce-mock.mjs';

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

function extractCaseNumber(speech) {
  const cleaned = speech.toUpperCase().replace(/\s+/g, '');
  const leaMatch = cleaned.match(/LEA[-\s]?([A-Z0-9]{4,7})/);
  if (leaMatch) return `LEA-${leaMatch[1]}`;
  return null;
}

function formatCaseStatus(caseRecord) {
  const statusMessages = {
    'New': 'Your case has been received and is being reviewed by our team.',
    'In Progress': 'Your case is currently being worked on.',
    'Dispatched': 'A service team has been dispatched and is on the way.',
    'Scheduled': 'Your repair appointment has been scheduled.',
    'In Repair': 'Your vehicle is currently being repaired.',
    'Awaiting Parts': 'We are waiting for parts to arrive for your repair. This typically takes 2 to 3 business days.',
    'Ready': 'Your vehicle repair is complete and ready for pickup.',
    'Closed': 'This case has been resolved and closed.',
  };
  return statusMessages[caseRecord.Status] || `Your case status is: ${caseRecord.Status}.`;
}

function formatAppointmentInfo(appointments) {
  if (!appointments || appointments.length === 0) return '';
  const next = appointments.find(a => a.Status === 'Scheduled' && new Date(a.DateTime) > new Date());
  if (!next) return '';
  const d = new Date(next.DateTime);
  const formatted = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return ` Your next appointment is at ${next.ShopName} on ${formatted}.`;
}

export function handleEntry(req) {
  const callSid = req.body.CallSid;
  const callerNumber = req.query.from || req.body.From || 'Unknown';
  const initialSpeech = req.query.speech || '';
  const state = getState(callSid);
  state.data.contactPhone = callerNumber;

  const caseNumber = initialSpeech ? extractCaseNumber(initialSpeech) : null;
  if (caseNumber) {
    const caseRecord = getCase(caseNumber);
    if (caseRecord) {
      return handleCaseFound(callSid, caseRecord);
    }
  }

  const phoneCases = getCaseByPhone(callerNumber);
  if (phoneCases.length > 0) {
    state.data.phoneCases = phoneCases;
    if (phoneCases.length === 1) {
      return handleCaseFound(callSid, phoneCases[0]);
    }
    const caseList = phoneCases.slice(0, 3).map((c, i) =>
      `Case ${i + 1}: ${c.CaseNumber}, ${c.Subject}, status ${c.Status}`
    ).join('. ');
    return sayAndGather(
      `I found ${phoneCases.length} case${phoneCases.length > 1 ? 's' : ''} associated with your phone number. ` +
      `${caseList}. ` +
      `Which case would you like to check? Say the case number or "case 1", "case 2", etc.`,
      '/voice/flow/claim-status/gather?step=select_case',
      { timeout: 10 }
    );
  }

  return sayAndGather(
    `I'll look up your claim status. Can you please provide your case number? ` +
    `It starts with L-E-A followed by a dash and several characters.`,
    '/voice/flow/claim-status/gather?step=identify',
    { timeout: 10 }
  );
}

export function handleGather(req) {
  const callSid = req.body.CallSid;
  const speech = req.body.SpeechResult || '';
  const step = req.query.step || 'identify';
  const state = getState(callSid);

  switch (step) {
    case 'identify': {
      const caseNumber = extractCaseNumber(speech);
      if (!caseNumber) {
        return sayAndGather(
          `I couldn't recognize a case number from what you said. ` +
          `The case number starts with LEA followed by a dash. ` +
          `Can you please try again? Or say "agent" to speak with a live person.`,
          '/voice/flow/claim-status/gather?step=identify',
          { timeout: 10 }
        );
      }
      const caseRecord = getCase(caseNumber);
      if (!caseRecord) {
        return sayAndGather(
          `I couldn't find a case with number ${caseNumber.split('').join(' ')}. ` +
          `Could you double-check the number and try again?`,
          '/voice/flow/claim-status/gather?step=identify',
          { timeout: 10 }
        );
      }
      return handleCaseFound(callSid, caseRecord);
    }

    case 'select_case': {
      const lower = speech.toLowerCase();
      const phoneCases = state.data.phoneCases || [];
      let selectedIndex = 0;
      if (lower.includes('2') || lower.includes('two') || lower.includes('second')) selectedIndex = 1;
      if (lower.includes('3') || lower.includes('three') || lower.includes('third')) selectedIndex = 2;

      const caseNumber = extractCaseNumber(speech);
      if (caseNumber) {
        const found = phoneCases.find(c => c.CaseNumber === caseNumber);
        if (found) return handleCaseFound(callSid, found);
      }

      if (selectedIndex < phoneCases.length) {
        return handleCaseFound(callSid, phoneCases[selectedIndex]);
      }
      return handleCaseFound(callSid, phoneCases[0]);
    }

    case 'followup': {
      const lower = speech.toLowerCase();
      if (lower.includes('another') || lower.includes('different') || lower.includes('other case')) {
        cleanupState(callSid);
        return sayAndGather(
          `What case number would you like to check?`,
          '/voice/flow/claim-status/gather?step=identify',
          { timeout: 10 }
        );
      }
      if (lower.includes('agent') || lower.includes('person') || lower.includes('speak')) {
        cleanupState(callSid);
        return transferToAgent("Connecting you with a live agent now.");
      }
      cleanupState(callSid);
      return sayAndHangup(
        `Thank you for calling Leasys Drivers Assistance. Have a great day!`
      );
    }

    default:
      cleanupState(callSid);
      return transferToAgent("Let me connect you with an agent who can help.");
  }
}

function handleCaseFound(callSid, caseRecord) {
  const statusMsg = formatCaseStatus(caseRecord);
  const appointments = getAppointments(caseRecord.CaseNumber);
  const appointmentMsg = formatAppointmentInfo(appointments);

  cleanupState(callSid);

  return sayAndGather(
    `I found your case. Case number: ${caseRecord.CaseNumber.split('').join(' ')}. ` +
    `Subject: ${caseRecord.Subject}. ` +
    `${statusMsg}${appointmentMsg} ` +
    `Is there anything else I can help you with? You can say "check another case", "speak to an agent", or "no thanks".`,
    '/voice/flow/claim-status/gather?step=followup',
    { timeout: 8 }
  );
}

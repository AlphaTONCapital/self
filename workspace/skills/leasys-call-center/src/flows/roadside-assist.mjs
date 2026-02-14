import { sayAndGather, sayAndHangup, redirect, transferToAgent } from '../services/twilio-voice.mjs';
import { createRoadsideCase, updateCase } from '../services/salesforce-mock.mjs';

const ISSUE_TYPES = {
  flat: { label: 'Flat Tire', eta: '30 to 45 minutes', priority: 'Medium' },
  battery: { label: 'Dead Battery / Jump Start', eta: '20 to 35 minutes', priority: 'Medium' },
  lockout: { label: 'Vehicle Lockout', eta: '25 to 40 minutes', priority: 'Low' },
  towing: { label: 'Towing', eta: '45 to 60 minutes', priority: 'High' },
  overheating: { label: 'Engine Overheating', eta: '30 to 45 minutes', priority: 'High' },
  fuel: { label: 'Out of Fuel', eta: '25 to 40 minutes', priority: 'Low' },
  other: { label: 'Other Breakdown', eta: '35 to 50 minutes', priority: 'Medium' },
};

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

function detectIssueType(speech) {
  const lower = speech.toLowerCase();
  if (lower.includes('flat') || lower.includes('tire') || lower.includes('puncture')) return 'flat';
  if (lower.includes('battery') || lower.includes('jump') || lower.includes('won\'t start') || lower.includes('dead')) return 'battery';
  if (lower.includes('lock') || lower.includes('keys') || lower.includes('locked out')) return 'lockout';
  if (lower.includes('tow') || lower.includes('totaled') || lower.includes('can\'t drive') || lower.includes('undriveable')) return 'towing';
  if (lower.includes('overheat') || lower.includes('hot') || lower.includes('steam') || lower.includes('temperature')) return 'overheating';
  if (lower.includes('fuel') || lower.includes('gas') || lower.includes('empty') || lower.includes('petrol') || lower.includes('diesel')) return 'fuel';
  return 'other';
}

export function handleEntry(req) {
  const callSid = req.body.CallSid;
  const callerNumber = req.query.from || req.body.From || 'Unknown';
  const initialSpeech = req.query.speech || '';
  const state = getState(callSid);
  state.data.contactPhone = callerNumber;

  if (initialSpeech) {
    const detected = detectIssueType(initialSpeech);
    if (detected !== 'other') {
      state.data.issueType = detected;
      state.data.issueLabel = ISSUE_TYPES[detected].label;
      return sayAndGather(
        `I understand you need help with ${ISSUE_TYPES[detected].label.toLowerCase()}. ` +
        `Can you tell me your current location? Please provide the street address, highway name, or nearest landmark.`,
        '/voice/flow/roadside-assist/gather?step=location',
        { timeout: 10 }
      );
    }
  }

  return sayAndGather(
    `I'll get you roadside assistance right away. What's the issue with your vehicle? ` +
    `For example: "flat tire", "dead battery", "locked out", "need a tow", or "engine overheating".`,
    '/voice/flow/roadside-assist/gather?step=issue_type',
    { timeout: 10 }
  );
}

export function handleGather(req) {
  const callSid = req.body.CallSid;
  const speech = req.body.SpeechResult || '';
  const step = req.query.step || 'issue_type';
  const state = getState(callSid);

  switch (step) {
    case 'issue_type': {
      const issueKey = detectIssueType(speech);
      const issue = ISSUE_TYPES[issueKey];
      state.data.issueType = issueKey;
      state.data.issueLabel = issue.label;

      return sayAndGather(
        `Got it, ${issue.label.toLowerCase()}. ` +
        `Can you tell me your current location? Please provide the street address, highway, or nearest landmark.`,
        '/voice/flow/roadside-assist/gather?step=location',
        { timeout: 10 }
      );
    }

    case 'location':
      state.data.location = speech;
      return sayAndGather(
        `You're at ${speech}. What vehicle are you driving? Please include the make, model, color, and license plate if possible.`,
        '/voice/flow/roadside-assist/gather?step=vehicle_info',
        { timeout: 10 }
      );

    case 'vehicle_info':
      state.data.vehicleInfo = speech;
      return sayAndGather(
        `Are you in a safe location? For example, on the shoulder of the road or in a parking lot? Say "yes" or "no".`,
        '/voice/flow/roadside-assist/gather?step=safe',
        { timeout: 8 }
      );

    case 'safe': {
      const isSafe = speech.toLowerCase().includes('yes') || speech.toLowerCase().includes('safe');
      state.data.isSafe = isSafe;

      if (!isSafe && (state.data.issueType === 'overheating' || state.data.issueType === 'towing')) {
        cleanupState(callSid);
        return transferToAgent(
          `For your safety, I'm connecting you with our emergency dispatch team immediately. Please stay in your vehicle with your hazard lights on.`
        );
      }

      const issue = ISSUE_TYPES[state.data.issueType];
      return sayAndGather(
        `Let me confirm. You need ${issue.label.toLowerCase()} at ${state.data.location}. ` +
        `Vehicle: ${state.data.vehicleInfo}. ` +
        `Estimated arrival time is ${issue.eta}. ` +
        `Shall I dispatch assistance now? Say "yes" to confirm.`,
        '/voice/flow/roadside-assist/gather?step=confirm',
        { timeout: 8 }
      );
    }

    case 'confirm': {
      const confirmed = speech.toLowerCase().includes('yes') || speech.toLowerCase().includes('confirm') || speech.toLowerCase().includes('please');
      if (!confirmed) {
        cleanupState(callSid);
        return redirect('/voice/flow/roadside-assist');
      }
      return redirect('/voice/flow/roadside-assist/finalize');
    }

    default:
      cleanupState(callSid);
      return transferToAgent("I'm having difficulty processing your request. Connecting you with an agent.");
  }
}

export function handleFinalize(req) {
  const callSid = req.body.CallSid;
  const state = getState(callSid);
  const issue = ISSUE_TYPES[state.data.issueType];

  const caseRecord = createRoadsideCase({
    contactName: null,
    contactPhone: state.data.contactPhone,
    location: state.data.location,
    issueType: issue.label,
    vehicleInfo: state.data.vehicleInfo,
    description: `${issue.label} at ${state.data.location}. Vehicle: ${state.data.vehicleInfo}. Safe location: ${state.data.isSafe ? 'Yes' : 'No'}`,
  });

  updateCase(caseRecord.CaseNumber, { Status: 'Dispatched' });

  const response = sayAndHangup(
    `Roadside assistance has been dispatched. ` +
    `Your case number is ${caseRecord.CaseNumber.split('').join(' ')}. ` +
    `A ${issue.label.toLowerCase()} team will arrive at ${state.data.location} within ${issue.eta}. ` +
    `${!state.data.isSafe ? 'Please turn on your hazard lights and stay in your vehicle. ' : ''}` +
    `You can call us back anytime with your case number for updates. ` +
    `Thank you for calling Leasys Drivers Assistance.`
  );

  cleanupState(callSid);
  return response;
}

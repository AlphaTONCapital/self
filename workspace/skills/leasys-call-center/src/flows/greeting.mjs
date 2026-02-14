import { sayAndGather, transferToAgent, redirect } from '../services/twilio-voice.mjs';

const INTENT_PATTERNS = {
  accident: [
    'accident', 'crash', 'collision', 'hit', 'damage', 'wreck',
    'smash', 'fender', 'bender', 'rear-ended', 'side-swiped', 'totaled',
  ],
  bodyShop: [
    'appointment', 'repair', 'body shop', 'fix', 'schedule',
    'book', 'dent', 'scratch', 'paint', 'bumper', 'bodywork',
    'carrozzeria', 'riparazione',
  ],
  roadside: [
    'flat tire', 'battery', 'locked out', 'tow', 'breakdown',
    'dead battery', 'flat', 'stuck', 'won\'t start', 'overheating',
    'jump start', 'lockout', 'roadside', 'stranded', 'soccorso',
  ],
  claimStatus: [
    'status', 'claim', 'update', 'when', 'check', 'progress',
    'case number', 'how long', 'ready', 'where is', 'my repair',
    'stato', 'pratica',
  ],
};

const AGENT_KEYWORDS = ['agent', 'person', 'human', 'operator'];

export function detectIntent(speechText) {
  if (!speechText) return null;
  const lower = speechText.toLowerCase();

  let bestMatch = null;
  let bestScore = 0;

  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    let score = 0;
    for (const pattern of patterns) {
      if (lower.includes(pattern)) {
        score += pattern.split(' ').length;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = intent;
    }
  }

  return bestMatch;
}

const FLOW_ROUTES = {
  accident: '/voice/flow/accident-report',
  bodyShop: '/voice/flow/body-shop-booking',
  roadside: '/voice/flow/roadside-assist',
  claimStatus: '/voice/flow/claim-status',
};

export function handleIncoming(req) {
  return sayAndGather(
    `Thank you for calling Leasys Drivers Assistance. ` +
    `I can help you with accident reporting, body shop appointments, roadside assistance, or checking the status of an existing claim. ` +
    `How can I help you today?`,
    '/voice/incoming/gather',
    { timeout: 8 }
  );
}

export function handleIncomingGather(req) {
  const speech = req.body.SpeechResult;
  const callerNumber = req.body.From || 'Unknown';

  if (!speech) {
    return sayAndGather(
      `I'm sorry, I didn't catch that. Could you please tell me what you need help with? ` +
      `You can say things like "I was in an accident", "I need a repair appointment", ` +
      `"I need roadside help", or "I want to check my claim status".`,
      '/voice/incoming/gather',
      { timeout: 8 }
    );
  }

  const lower = speech.toLowerCase();
  const intent = detectIntent(speech);

  if (!intent) {
    if (AGENT_KEYWORDS.some(kw => lower.includes(kw))) {
      return transferToAgent("I'll connect you with a live agent right away.");
    }
    return sayAndGather(
      `I understand you said: "${speech}". ` +
      `I can help with four things: reporting an accident, booking a body shop appointment, ` +
      `requesting roadside assistance, or checking a claim status. Which would you like?`,
      '/voice/incoming/gather',
      { timeout: 8 }
    );
  }

  return redirect(FLOW_ROUTES[intent] + `?from=${encodeURIComponent(callerNumber)}&speech=${encodeURIComponent(speech)}`);
}

export function handleUnknownFlow(req) {
  return transferToAgent("I'm having trouble understanding your request. Let me connect you with a live agent.");
}

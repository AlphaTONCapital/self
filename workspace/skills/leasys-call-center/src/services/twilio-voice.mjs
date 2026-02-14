import twilio from 'twilio';

const VoiceResponse = twilio.twiml.VoiceResponse;

const VOICE_CONFIG = {
  voice: 'Polly.Joanna',
  language: 'en-US',
};

const GATHER_DEFAULTS = {
  input: 'speech',
  speechTimeout: 'auto',
  language: 'en-US',
};

export function say(text, options = {}) {
  const response = new VoiceResponse();
  response.say({ ...VOICE_CONFIG, ...options }, text);
  return response;
}

export function sayAndGather(text, actionUrl, options = {}) {
  const response = new VoiceResponse();
  const gather = response.gather({
    ...GATHER_DEFAULTS,
    action: actionUrl,
    method: 'POST',
    ...options,
  });
  gather.say(VOICE_CONFIG, text);
  response.say(VOICE_CONFIG, "I didn't catch that. Let me transfer you to an agent.");
  response.dial(process.env.LEASYS_AGENT_NUMBER || '+390000000000');
  return response;
}

export function sayAndHangup(text) {
  const response = new VoiceResponse();
  response.say(VOICE_CONFIG, text);
  response.hangup();
  return response;
}

export function transferToAgent(message) {
  const response = new VoiceResponse();
  if (message) {
    response.say(VOICE_CONFIG, message);
  }
  response.say(VOICE_CONFIG, 'Transferring you to a live agent now. Please hold.');
  response.dial(process.env.LEASYS_AGENT_NUMBER || '+390000000000');
  return response;
}

export function redirect(url) {
  const response = new VoiceResponse();
  response.redirect(url);
  return response;
}

export function validateTwilioRequest(req, authToken) {
  const twilioSignature = req.headers['x-twilio-signature'];
  if (!twilioSignature || !authToken) return false;
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  return twilio.validateRequest(authToken, twilioSignature, url, req.body);
}

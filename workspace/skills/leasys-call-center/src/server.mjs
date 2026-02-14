import express from 'express';
import { handleIncoming, handleIncomingGather, handleUnknownFlow } from './flows/greeting.mjs';
import { handleEntry as accidentEntry, handleGather as accidentGather, handleFinalize as accidentFinalize } from './flows/accident-report.mjs';
import { handleEntry as bodyShopEntry, handleGather as bodyShopGather, handleFinalize as bodyShopFinalize } from './flows/body-shop-booking.mjs';
import { handleEntry as roadsideEntry, handleGather as roadsideGather, handleFinalize as roadsideFinalize } from './flows/roadside-assist.mjs';
import { handleEntry as claimEntry, handleGather as claimGather } from './flows/claim-status.mjs';
import { validateTwilioRequest } from './services/twilio-voice.mjs';

const app = express();
const PORT = parseInt(process.env.LEASYS_WEBHOOK_PORT || '3100', 10);

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const callSid = req.body?.CallSid || 'no-call';
  console.log(`[${timestamp}] ${req.method} ${req.path} CallSid=${callSid}`);
  next();
});

// Twilio signature validation (skip in development)
app.use('/voice', (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!validateTwilioRequest(req, authToken)) {
      console.warn(`[WARN] Invalid Twilio signature from ${req.ip}`);
      res.status(403).send('Forbidden');
      return;
    }
  }
  next();
});

function sendTwiml(res, twiml) {
  res.type('text/xml');
  res.send(twiml.toString());
}

// --- Greeting / Intent Detection ---

app.post('/voice/incoming', (req, res) => {
  sendTwiml(res, handleIncoming(req));
});

app.post('/voice/incoming/gather', (req, res) => {
  sendTwiml(res, handleIncomingGather(req));
});

// --- Accident Report Flow ---

app.post('/voice/flow/accident-report', (req, res) => {
  sendTwiml(res, accidentEntry(req));
});

app.post('/voice/flow/accident-report/gather', (req, res) => {
  sendTwiml(res, accidentGather(req));
});

app.post('/voice/flow/accident-report/finalize', async (req, res) => {
  sendTwiml(res, await accidentFinalize(req));
});

// --- Body Shop Booking Flow ---

app.post('/voice/flow/body-shop-booking', (req, res) => {
  sendTwiml(res, bodyShopEntry(req));
});

app.post('/voice/flow/body-shop-booking/gather', async (req, res) => {
  sendTwiml(res, await bodyShopGather(req));
});

app.post('/voice/flow/body-shop-booking/finalize', (req, res) => {
  sendTwiml(res, bodyShopFinalize(req));
});

// --- Roadside Assistance Flow ---

app.post('/voice/flow/roadside-assist', (req, res) => {
  sendTwiml(res, roadsideEntry(req));
});

app.post('/voice/flow/roadside-assist/gather', (req, res) => {
  sendTwiml(res, roadsideGather(req));
});

app.post('/voice/flow/roadside-assist/finalize', (req, res) => {
  sendTwiml(res, roadsideFinalize(req));
});

// --- Claim Status Flow ---

app.post('/voice/flow/claim-status', (req, res) => {
  sendTwiml(res, claimEntry(req));
});

app.post('/voice/flow/claim-status/gather', (req, res) => {
  sendTwiml(res, claimGather(req));
});

// --- Call Status Callback ---

app.post('/voice/status', (req, res) => {
  const { CallSid, CallStatus, CallDuration } = req.body;
  console.log(`[STATUS] CallSid=${CallSid} Status=${CallStatus} Duration=${CallDuration}s`);
  res.sendStatus(204);
});

// --- Health Check ---

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'leasys-call-center',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// --- Catch-all for unknown flow routes ---

app.post('/voice/flow/:flowName', (req, res) => {
  sendTwiml(res, handleUnknownFlow(req));
});

app.post('/voice/flow/:flowName/gather', (req, res) => {
  sendTwiml(res, handleUnknownFlow(req));
});

const server = app.listen(PORT, () => {
  console.log(`Leasys Call Center webhook server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Twilio webhook URL: http://localhost:${PORT}/voice/incoming`);
});

export { app, server };

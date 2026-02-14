import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

let server, baseUrl;

function post(path, body = {}) {
  return new Promise((resolve, reject) => {
    const data = new URLSearchParams(body).toString();
    const url = new URL(path, baseUrl);
    const req = http.request(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(data) },
    }, res => {
      let responseData = '';
      res.on('data', chunk => { responseData += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: responseData }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

describe('Server Integration', () => {
  before(async () => {
    process.env.LEASYS_WEBHOOK_PORT = '3199';
    const mod = await import('../src/server.mjs');
    server = mod.server;
    baseUrl = 'http://localhost:3199';
    await new Promise(resolve => setTimeout(resolve, 500));
  });

  after(() => {
    server.close();
  });

  it('health check returns ok', async () => {
    const res = await get('/health');
    assert.equal(res.status, 200);
    const json = JSON.parse(res.body);
    assert.equal(json.status, 'ok');
    assert.equal(json.service, 'leasys-call-center');
    assert.ok(json.uptime > 0);
  });

  it('POST /voice/incoming returns TwiML greeting', async () => {
    const res = await post('/voice/incoming', { CallSid: 'CA_test_1', From: '+39111' });
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/xml'));
    assert.ok(res.body.includes('<?xml'));
    assert.ok(res.body.includes('Leasys'));
    assert.ok(res.body.includes('<Gather'));
  });

  it('POST /voice/incoming/gather with accident speech routes correctly', async () => {
    const res = await post('/voice/incoming/gather', { CallSid: 'CA_test_2', From: '+39222', SpeechResult: 'I had an accident' });
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('accident-report'));
  });

  it('POST /voice/incoming/gather with empty speech re-prompts', async () => {
    const res = await post('/voice/incoming/gather', { CallSid: 'CA_test_3', From: '+39333' });
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('<Gather'));
  });

  it('POST /voice/flow/accident-report starts flow', async () => {
    const res = await post('/voice/flow/accident-report?from=%2B39444', { CallSid: 'CA_test_4', From: '+39444' });
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('accident'));
    assert.ok(res.body.includes('step=location'));
  });

  it('POST /voice/flow/body-shop-booking starts flow', async () => {
    const res = await post('/voice/flow/body-shop-booking?from=%2B39555', { CallSid: 'CA_test_5', From: '+39555' });
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('vehicle information'));
  });

  it('POST /voice/flow/roadside-assist starts flow', async () => {
    const res = await post('/voice/flow/roadside-assist?from=%2B39666', { CallSid: 'CA_test_6', From: '+39666' });
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('issue'));
  });

  it('POST /voice/flow/claim-status starts flow', async () => {
    const res = await post('/voice/flow/claim-status?from=%2B39777', { CallSid: 'CA_test_7', From: '+39777' });
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('case number'));
  });

  it('POST /voice/status returns 204', async () => {
    const res = await post('/voice/status', { CallSid: 'CA_test_8', CallStatus: 'completed', CallDuration: '60' });
    assert.equal(res.status, 204);
  });

  it('POST /voice/flow/unknown transfers to agent', async () => {
    const res = await post('/voice/flow/unknown', { CallSid: 'CA_test_9' });
    assert.equal(res.status, 200);
    assert.ok(res.body.includes('<Dial'));
  });
});

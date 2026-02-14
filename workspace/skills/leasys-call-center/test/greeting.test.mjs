import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { detectIntent, handleIncoming, handleIncomingGather, handleUnknownFlow } from '../src/flows/greeting.mjs';

function mockReq(body = {}, query = {}) {
  return { body: { CallSid: 'CA_test_123', From: '+391234567890', ...body }, query };
}

describe('detectIntent', () => {
  it('detects accident intent from various phrases', () => {
    assert.equal(detectIntent('I was in an accident'), 'accident');
    assert.equal(detectIntent('my car crashed'), 'accident');
    assert.equal(detectIntent('there was a collision'), 'accident');
    assert.equal(detectIntent('I got rear-ended'), 'accident');
    assert.equal(detectIntent('fender bender on the highway'), 'accident');
    assert.equal(detectIntent('my car is totaled'), 'accident');
  });

  it('detects body shop intent', () => {
    assert.equal(detectIntent('I need a repair appointment'), 'bodyShop');
    assert.equal(detectIntent('schedule body shop visit'), 'bodyShop');
    assert.equal(detectIntent('fix the scratch on my car'), 'bodyShop');
    assert.equal(detectIntent('I need bodywork done'), 'bodyShop');
    assert.equal(detectIntent('book a dent repair'), 'bodyShop');
  });

  it('detects roadside assistance intent', () => {
    assert.equal(detectIntent('I have a flat tire'), 'roadside');
    assert.equal(detectIntent('my battery is dead'), 'roadside');
    assert.equal(detectIntent('I am locked out of my car'), 'roadside');
    assert.equal(detectIntent('I need a tow truck'), 'roadside');
    assert.equal(detectIntent('my car had a breakdown'), 'roadside');
    assert.equal(detectIntent('engine is overheating'), 'roadside');
    assert.equal(detectIntent('I am stranded on the highway'), 'roadside');
  });

  it('detects claim status intent', () => {
    assert.equal(detectIntent('check my claim status'), 'claimStatus');
    assert.equal(detectIntent('what is the update on my case'), 'claimStatus');
    assert.equal(detectIntent('when will my repair be ready'), 'claimStatus');
    assert.equal(detectIntent('I want to check progress'), 'claimStatus');
    assert.equal(detectIntent('where is my car'), 'claimStatus');
  });

  it('returns null for unrecognized speech', () => {
    assert.equal(detectIntent('hello how are you'), null);
    assert.equal(detectIntent('what time is it'), null);
    assert.equal(detectIntent(''), null);
    assert.equal(detectIntent(null), null);
    assert.equal(detectIntent(undefined), null);
  });

  it('picks highest scoring intent when multiple match', () => {
    // "flat tire" is a 2-word phrase, scores higher than single words
    assert.equal(detectIntent('I have a flat tire and damage'), 'roadside');
    // "body shop" is a 2-word phrase
    assert.equal(detectIntent('I need a body shop for a scratch'), 'bodyShop');
  });

  it('is case insensitive', () => {
    assert.equal(detectIntent('I WAS IN AN ACCIDENT'), 'accident');
    assert.equal(detectIntent('FLAT TIRE'), 'roadside');
    assert.equal(detectIntent('Check My Claim Status'), 'claimStatus');
  });

  it('handles Italian keywords', () => {
    assert.equal(detectIntent('ho bisogno di carrozzeria'), 'bodyShop');
    assert.equal(detectIntent('soccorso stradale'), 'roadside');
    assert.equal(detectIntent('stato della pratica'), 'claimStatus');
  });
});

describe('handleIncoming', () => {
  it('returns TwiML with greeting and gather', () => {
    const twiml = handleIncoming(mockReq());
    const xml = twiml.toString();
    assert.ok(xml.includes('<Gather'));
    assert.ok(xml.includes('Leasys Drivers Assistance'));
    assert.ok(xml.includes('/voice/incoming/gather'));
  });
});

describe('handleIncomingGather', () => {
  it('redirects to accident flow when accident detected', () => {
    const twiml = handleIncomingGather(mockReq({ SpeechResult: 'I was in an accident' }));
    const xml = twiml.toString();
    assert.ok(xml.includes('/voice/flow/accident-report'));
  });

  it('redirects to body shop flow', () => {
    const twiml = handleIncomingGather(mockReq({ SpeechResult: 'I need to book a repair appointment' }));
    const xml = twiml.toString();
    assert.ok(xml.includes('/voice/flow/body-shop-booking'));
  });

  it('redirects to roadside flow', () => {
    const twiml = handleIncomingGather(mockReq({ SpeechResult: 'I have a flat tire' }));
    const xml = twiml.toString();
    assert.ok(xml.includes('/voice/flow/roadside-assist'));
  });

  it('redirects to claim status flow', () => {
    const twiml = handleIncomingGather(mockReq({ SpeechResult: 'check my claim status' }));
    const xml = twiml.toString();
    assert.ok(xml.includes('/voice/flow/claim-status'));
  });

  it('transfers to agent when explicitly requested', () => {
    const twiml = handleIncomingGather(mockReq({ SpeechResult: 'I want to speak to an agent' }));
    const xml = twiml.toString();
    assert.ok(xml.includes('<Dial'));
    assert.ok(xml.includes('live agent'));
  });

  it('transfers on "human" keyword', () => {
    const twiml = handleIncomingGather(mockReq({ SpeechResult: 'let me talk to a human' }));
    const xml = twiml.toString();
    assert.ok(xml.includes('<Dial'));
  });

  it('transfers on "operator" keyword', () => {
    const twiml = handleIncomingGather(mockReq({ SpeechResult: 'operator please' }));
    const xml = twiml.toString();
    assert.ok(xml.includes('<Dial'));
  });

  it('re-prompts when no speech detected', () => {
    const twiml = handleIncomingGather(mockReq({ SpeechResult: undefined }));
    const xml = twiml.toString();
    assert.ok(xml.includes('<Gather'));
    assert.ok(xml.includes("didn't catch that"));
  });

  it('re-prompts with suggestions on unrecognized speech', () => {
    const twiml = handleIncomingGather(mockReq({ SpeechResult: 'pizza delivery' }));
    const xml = twiml.toString();
    assert.ok(xml.includes('<Gather'));
    assert.ok(xml.includes('four things'));
  });

  it('encodes caller number in redirect URL', () => {
    const twiml = handleIncomingGather(mockReq({ SpeechResult: 'accident', From: '+39 123 456 7890' }));
    const xml = twiml.toString();
    assert.ok(xml.includes('from='));
  });
});

describe('handleUnknownFlow', () => {
  it('transfers to live agent', () => {
    const twiml = handleUnknownFlow(mockReq());
    const xml = twiml.toString();
    assert.ok(xml.includes('<Dial'));
  });
});

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data');
const CASES_FILE = join(DATA_DIR, 'cases.json');
const APPOINTMENTS_FILE = join(DATA_DIR, 'appointments.json');

import { handleEntry as accidentEntry, handleGather as accidentGather, handleFinalize as accidentFinalize } from '../src/flows/accident-report.mjs';
import { handleEntry as bodyShopEntry, handleGather as bodyShopGather, handleFinalize as bodyShopFinalize } from '../src/flows/body-shop-booking.mjs';
import { handleEntry as roadsideEntry, handleGather as roadsideGather, handleFinalize as roadsideFinalize } from '../src/flows/roadside-assist.mjs';
import { handleEntry as claimEntry, handleGather as claimGather } from '../src/flows/claim-status.mjs';
import { createCase } from '../src/services/salesforce-mock.mjs';

let originalCases, originalAppointments;

function mockReq(body = {}, query = {}) {
  return {
    body: { CallSid: `CA_test_${Date.now()}`, From: '+391234567890', ...body },
    query,
  };
}

function toXml(twiml) {
  return twiml.toString();
}

describe('Accident Report Flow', () => {
  beforeEach(() => {
    originalCases = readFileSync(CASES_FILE, 'utf-8');
    originalAppointments = readFileSync(APPOINTMENTS_FILE, 'utf-8');
    writeFileSync(CASES_FILE, '[]');
    writeFileSync(APPOINTMENTS_FILE, '[]');
  });

  afterEach(() => {
    writeFileSync(CASES_FILE, originalCases);
    writeFileSync(APPOINTMENTS_FILE, originalAppointments);
  });

  it('starts by asking for accident location', () => {
    const xml = toXml(accidentEntry(mockReq({}, { from: '+391234567890' })));
    assert.ok(xml.includes('where the accident occurred'));
    assert.ok(xml.includes('step=location'));
  });

  it('progresses through location -> description -> other_parties -> injuries -> police -> confirm', () => {
    const callSid = 'CA_progress_test';

    // Entry
    accidentEntry(mockReq({ CallSid: callSid }, { from: '+390001' }));

    // Location
    let xml = toXml(accidentGather(mockReq({ CallSid: callSid, SpeechResult: 'Via Roma 10 Milano' }, { step: 'location' })));
    assert.ok(xml.includes('step=description'));

    // Description
    xml = toXml(accidentGather(mockReq({ CallSid: callSid, SpeechResult: 'front bumper dented' }, { step: 'description' })));
    assert.ok(xml.includes('step=other_parties'));

    // Other parties
    xml = toXml(accidentGather(mockReq({ CallSid: callSid, SpeechResult: 'no other parties' }, { step: 'other_parties' })));
    assert.ok(xml.includes('step=injuries'));

    // No injuries
    xml = toXml(accidentGather(mockReq({ CallSid: callSid, SpeechResult: 'no' }, { step: 'injuries' })));
    assert.ok(xml.includes('step=police'));

    // Police report
    xml = toXml(accidentGather(mockReq({ CallSid: callSid, SpeechResult: 'no report' }, { step: 'police' })));
    assert.ok(xml.includes('step=confirm'));
    assert.ok(xml.includes('Via Roma 10 Milano'));
    assert.ok(xml.includes('front bumper dented'));
  });

  it('transfers to agent when injuries reported', () => {
    const callSid = 'CA_injury_test';
    accidentEntry(mockReq({ CallSid: callSid }, { from: '+390001' }));
    accidentGather(mockReq({ CallSid: callSid, SpeechResult: 'Via Test' }, { step: 'location' }));

    const xml = toXml(accidentGather(mockReq({ CallSid: callSid, SpeechResult: 'yes there are injuries' }, { step: 'injuries' })));
    assert.ok(xml.includes('<Dial'));
    assert.ok(xml.includes('emergency response'));
  });

  it('creates a case on finalize', async () => {
    const callSid = 'CA_finalize_test';
    accidentEntry(mockReq({ CallSid: callSid }, { from: '+390001' }));
    accidentGather(mockReq({ CallSid: callSid, SpeechResult: 'Via Roma' }, { step: 'location' }));
    accidentGather(mockReq({ CallSid: callSid, SpeechResult: 'bumper damage' }, { step: 'description' }));
    accidentGather(mockReq({ CallSid: callSid, SpeechResult: 'no other parties' }, { step: 'other_parties' }));
    accidentGather(mockReq({ CallSid: callSid, SpeechResult: 'no' }, { step: 'injuries' }));
    accidentGather(mockReq({ CallSid: callSid, SpeechResult: 'PD-99999' }, { step: 'police' }));
    accidentGather(mockReq({ CallSid: callSid, SpeechResult: 'yes' }, { step: 'confirm' }));

    const xml = toXml(await accidentFinalize(mockReq({ CallSid: callSid })));
    assert.ok(xml.includes('L E A'));
    assert.ok(xml.includes('<Hangup'));

    const cases = JSON.parse(readFileSync(CASES_FILE, 'utf-8'));
    assert.equal(cases.length, 1);
    assert.ok(cases[0].Subject.includes('Accident Report'));
  });

  it('restarts flow when confirmation denied', () => {
    const callSid = 'CA_deny_test';
    accidentEntry(mockReq({ CallSid: callSid }, { from: '+390001' }));
    accidentGather(mockReq({ CallSid: callSid, SpeechResult: 'Via Test' }, { step: 'location' }));

    const xml = toXml(accidentGather(mockReq({ CallSid: callSid, SpeechResult: 'no that is wrong' }, { step: 'confirm' })));
    assert.ok(xml.includes('/voice/flow/accident-report'));
  });
});

describe('Body Shop Booking Flow', () => {
  beforeEach(() => {
    originalCases = readFileSync(CASES_FILE, 'utf-8');
    originalAppointments = readFileSync(APPOINTMENTS_FILE, 'utf-8');
    writeFileSync(CASES_FILE, '[]');
    writeFileSync(APPOINTMENTS_FILE, '[]');
  });

  afterEach(() => {
    writeFileSync(CASES_FILE, originalCases);
    writeFileSync(APPOINTMENTS_FILE, originalAppointments);
  });

  it('starts by asking for vehicle info', () => {
    const xml = toXml(bodyShopEntry(mockReq({}, { from: '+390001' })));
    assert.ok(xml.includes('vehicle information'));
    assert.ok(xml.includes('step=vehicle_info'));
  });

  it('progresses through vehicle -> damage -> location -> shops', async () => {
    const callSid = 'CA_booking_test';
    bodyShopEntry(mockReq({ CallSid: callSid }, { from: '+390001' }));

    let xml = toXml(await bodyShopGather(mockReq({ CallSid: callSid, SpeechResult: '2024 Fiat 500' }, { step: 'vehicle_info' })));
    assert.ok(xml.includes('step=damage_type'));

    xml = toXml(await bodyShopGather(mockReq({ CallSid: callSid, SpeechResult: 'collision damage on the front' }, { step: 'damage_type' })));
    assert.ok(xml.includes('step=location'));

    xml = toXml(await bodyShopGather(mockReq({ CallSid: callSid, SpeechResult: 'Milano' }, { step: 'location' })));
    assert.ok(xml.includes('step=select_shop'));
    assert.ok(xml.includes('Option 1'));
  });

  it('creates case and appointment on finalize', async () => {
    const callSid = 'CA_book_finalize';
    bodyShopEntry(mockReq({ CallSid: callSid }, { from: '+390001' }));
    await bodyShopGather(mockReq({ CallSid: callSid, SpeechResult: '2024 Fiat 500' }, { step: 'vehicle_info' }));
    await bodyShopGather(mockReq({ CallSid: callSid, SpeechResult: 'paint scratch' }, { step: 'damage_type' }));
    await bodyShopGather(mockReq({ CallSid: callSid, SpeechResult: 'Milano' }, { step: 'location' }));
    await bodyShopGather(mockReq({ CallSid: callSid, SpeechResult: 'option 1' }, { step: 'select_shop' }));
    await bodyShopGather(mockReq({ CallSid: callSid, SpeechResult: 'tomorrow' }, { step: 'preferred_date' }));
    await bodyShopGather(mockReq({ CallSid: callSid, SpeechResult: 'yes' }, { step: 'confirm' }));

    const xml = toXml(bodyShopFinalize(mockReq({ CallSid: callSid })));
    assert.ok(xml.includes('L E A'));
    assert.ok(xml.includes('<Hangup'));

    const cases = JSON.parse(readFileSync(CASES_FILE, 'utf-8'));
    const appts = JSON.parse(readFileSync(APPOINTMENTS_FILE, 'utf-8'));
    assert.equal(cases.length, 1);
    assert.equal(appts.length, 1);
    assert.equal(appts[0].Status, 'Scheduled');
  });
});

describe('Roadside Assistance Flow', () => {
  beforeEach(() => {
    originalCases = readFileSync(CASES_FILE, 'utf-8');
    writeFileSync(CASES_FILE, '[]');
  });

  afterEach(() => {
    writeFileSync(CASES_FILE, originalCases);
  });

  it('starts by asking for issue type', () => {
    const xml = toXml(roadsideEntry(mockReq({}, { from: '+390001' })));
    assert.ok(xml.includes("What's the issue"));
    assert.ok(xml.includes('step=issue_type'));
  });

  it('skips issue type step when detected from initial speech', () => {
    const xml = toXml(roadsideEntry(mockReq({}, { from: '+390001', speech: 'I have a flat tire' })));
    assert.ok(xml.includes('flat tire'));
    assert.ok(xml.includes('step=location'));
  });

  it('transfers to agent for unsafe + critical issue', () => {
    const callSid = 'CA_unsafe_test';
    roadsideEntry(mockReq({ CallSid: callSid }, { from: '+390001', speech: 'I need a tow' }));
    roadsideGather(mockReq({ CallSid: callSid, SpeechResult: 'Highway A1' }, { step: 'location' }));
    roadsideGather(mockReq({ CallSid: callSid, SpeechResult: 'Red Fiat Panda' }, { step: 'vehicle_info' }));

    const xml = toXml(roadsideGather(mockReq({ CallSid: callSid, SpeechResult: 'no I am on the highway' }, { step: 'safe' })));
    assert.ok(xml.includes('<Dial'));
    assert.ok(xml.includes('emergency dispatch'));
  });

  it('does not transfer for unsafe + non-critical issue', () => {
    const callSid = 'CA_safe_flat';
    roadsideEntry(mockReq({ CallSid: callSid }, { from: '+390001' }));
    roadsideGather(mockReq({ CallSid: callSid, SpeechResult: 'flat tire' }, { step: 'issue_type' }));
    roadsideGather(mockReq({ CallSid: callSid, SpeechResult: 'Via Test' }, { step: 'location' }));
    roadsideGather(mockReq({ CallSid: callSid, SpeechResult: 'Blue Fiat' }, { step: 'vehicle_info' }));

    const xml = toXml(roadsideGather(mockReq({ CallSid: callSid, SpeechResult: 'no' }, { step: 'safe' })));
    assert.ok(xml.includes('step=confirm'));
    assert.ok(!xml.includes('emergency dispatch'));
  });

  it('creates dispatched case on finalize', () => {
    const callSid = 'CA_road_finalize';
    roadsideEntry(mockReq({ CallSid: callSid }, { from: '+390001' }));
    roadsideGather(mockReq({ CallSid: callSid, SpeechResult: 'dead battery' }, { step: 'issue_type' }));
    roadsideGather(mockReq({ CallSid: callSid, SpeechResult: 'Parking lot Via Roma' }, { step: 'location' }));
    roadsideGather(mockReq({ CallSid: callSid, SpeechResult: 'White Fiat Tipo ABC123' }, { step: 'vehicle_info' }));
    roadsideGather(mockReq({ CallSid: callSid, SpeechResult: 'yes safe' }, { step: 'safe' }));
    roadsideGather(mockReq({ CallSid: callSid, SpeechResult: 'yes please' }, { step: 'confirm' }));

    const xml = toXml(roadsideFinalize(mockReq({ CallSid: callSid })));
    assert.ok(xml.includes('dispatched'));
    assert.ok(xml.includes('<Hangup'));

    const cases = JSON.parse(readFileSync(CASES_FILE, 'utf-8'));
    assert.equal(cases.length, 1);
    assert.equal(cases[0].Status, 'Dispatched');
    assert.equal(cases[0].Type, 'Roadside Assistance');
  });
});

describe('Claim Status Flow', () => {
  beforeEach(() => {
    originalCases = readFileSync(CASES_FILE, 'utf-8');
    writeFileSync(CASES_FILE, '[]');
  });

  afterEach(() => {
    writeFileSync(CASES_FILE, originalCases);
  });

  it('auto-detects case from phone number', () => {
    createCase({ subject: 'Test Case', contactPhone: '+391234567890', type: 'Accident' });
    const xml = toXml(claimEntry(mockReq({ From: '+391234567890' }, { from: '+391234567890' })));
    assert.ok(xml.includes('I found your case'));
  });

  it('asks for case number when no phone match', () => {
    const xml = toXml(claimEntry(mockReq({ From: '+390000000000' }, { from: '+390000000000' })));
    assert.ok(xml.includes('case number'));
    assert.ok(xml.includes('step=identify'));
  });

  it('lists multiple cases when phone has several', () => {
    createCase({ subject: 'Case A', contactPhone: '+391111111111' });
    createCase({ subject: 'Case B', contactPhone: '+391111111111' });
    const xml = toXml(claimEntry(mockReq({ From: '+391111111111' }, { from: '+391111111111' })));
    assert.ok(xml.includes('Case 1'));
    assert.ok(xml.includes('Case 2'));
    assert.ok(xml.includes('step=select_case'));
  });

  it('handles goodbye in followup', () => {
    const callSid = 'CA_goodbye';
    const xml = toXml(claimGather(mockReq({ CallSid: callSid, SpeechResult: 'no thanks' }, { step: 'followup' })));
    assert.ok(xml.includes('<Hangup'));
    assert.ok(xml.includes('Have a great day'));
  });

  it('transfers to agent on request', () => {
    const callSid = 'CA_agent_req';
    const xml = toXml(claimGather(mockReq({ CallSid: callSid, SpeechResult: 'speak to an agent' }, { step: 'followup' })));
    assert.ok(xml.includes('<Dial'));
  });
});

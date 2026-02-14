import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'src', 'data');
const CASES_FILE = join(DATA_DIR, 'cases.json');
const APPOINTMENTS_FILE = join(DATA_DIR, 'appointments.json');

// Save original data
let originalCases, originalAppointments;

import {
  createCase, getCase, getCaseByPhone, updateCase, listCases,
  createAppointment, getAppointments, getAppointmentsByPhone, updateAppointment,
  createRoadsideCase,
} from '../src/services/salesforce-mock.mjs';

describe('Salesforce Mock - Cases', () => {
  beforeEach(() => {
    originalCases = existsSync(CASES_FILE) ? JSON.parse(readFileSync(CASES_FILE, 'utf-8')) : [];
    originalAppointments = existsSync(APPOINTMENTS_FILE) ? JSON.parse(readFileSync(APPOINTMENTS_FILE, 'utf-8')) : [];
    writeFileSync(CASES_FILE, '[]');
    writeFileSync(APPOINTMENTS_FILE, '[]');
  });

  afterEach(() => {
    writeFileSync(CASES_FILE, JSON.stringify(originalCases, null, 2));
    writeFileSync(APPOINTMENTS_FILE, JSON.stringify(originalAppointments, null, 2));
  });

  it('creates a case with all fields', () => {
    const c = createCase({
      subject: 'Test Accident',
      description: 'Front bumper damage',
      priority: 'High',
      contactName: 'Mario Rossi',
      contactPhone: '+39 333 1234567',
      type: 'Accident Report',
      location: 'Via Roma 1, Milano',
      otherParties: 'Blue Fiat Punto',
      injuries: false,
      policeReport: 'PD-12345',
    });

    assert.ok(c.Id);
    assert.ok(c.CaseNumber.startsWith('LEA-'));
    assert.equal(c.Subject, 'Test Accident');
    assert.equal(c.Status, 'New');
    assert.equal(c.Priority, 'High');
    assert.equal(c.Type, 'Accident Report');
    assert.equal(c.ContactName, 'Mario Rossi');
    assert.equal(c.Location, 'Via Roma 1, Milano');
    assert.equal(c.OtherParties, 'Blue Fiat Punto');
    assert.equal(c.Injuries, false);
    assert.equal(c.PoliceReport, 'PD-12345');
    assert.ok(c.CreatedDate);
  });

  it('generates unique case numbers', () => {
    const c1 = createCase({ subject: 'Case 1', contactPhone: '+1111' });
    const c2 = createCase({ subject: 'Case 2', contactPhone: '+2222' });
    assert.notEqual(c1.CaseNumber, c2.CaseNumber);
  });

  it('retrieves a case by case number', () => {
    const created = createCase({ subject: 'Lookup Test', contactPhone: '+3333' });
    const found = getCase(created.CaseNumber);
    assert.equal(found.Subject, 'Lookup Test');
    assert.equal(found.CaseNumber, created.CaseNumber);
  });

  it('returns null for nonexistent case number', () => {
    assert.equal(getCase('LEA-NONEXIST'), null);
  });

  it('finds cases by phone number', () => {
    createCase({ subject: 'Phone Test 1', contactPhone: '+39 333 1234567' });
    createCase({ subject: 'Phone Test 2', contactPhone: '+393331234567' });
    createCase({ subject: 'Other Phone', contactPhone: '+39 444 9999999' });

    const results = getCaseByPhone('+39 333 1234567');
    assert.equal(results.length, 2);
  });

  it('matches phone numbers with different formats', () => {
    createCase({ subject: 'Format Test', contactPhone: '+1-555-123-4567' });
    const results = getCaseByPhone('5551234567');
    assert.equal(results.length, 1);
  });

  it('returns empty array for unmatched phone', () => {
    const results = getCaseByPhone('+99 000 0000000');
    assert.equal(results.length, 0);
  });

  it('updates a case', () => {
    const created = createCase({ subject: 'Update Test', contactPhone: '+5555' });
    const updated = updateCase(created.CaseNumber, { Status: 'In Progress', Priority: 'High' });
    assert.equal(updated.Status, 'In Progress');
    assert.equal(updated.Priority, 'High');
    assert.ok(updated.LastModifiedDate);
    assert.equal(updated.Subject, 'Update Test');
  });

  it('returns null when updating nonexistent case', () => {
    assert.equal(updateCase('LEA-NONEXIST', { Status: 'Closed' }), null);
  });

  it('lists cases with filters', () => {
    createCase({ subject: 'A', contactPhone: '+1', type: 'Accident Report' });
    createCase({ subject: 'B', contactPhone: '+2', type: 'Roadside Assistance' });
    createCase({ subject: 'C', contactPhone: '+3', type: 'Accident Report' });

    const all = listCases();
    assert.equal(all.length, 3);

    const accidents = listCases({ type: 'Accident Report' });
    assert.equal(accidents.length, 2);
  });

  it('defaults priority to Medium and type to Drivers Assistance', () => {
    const c = createCase({ subject: 'Defaults', contactPhone: '+0000' });
    assert.equal(c.Priority, 'Medium');
    assert.equal(c.Type, 'Drivers Assistance');
  });
});

describe('Salesforce Mock - Appointments', () => {
  beforeEach(() => {
    originalCases = existsSync(CASES_FILE) ? JSON.parse(readFileSync(CASES_FILE, 'utf-8')) : [];
    originalAppointments = existsSync(APPOINTMENTS_FILE) ? JSON.parse(readFileSync(APPOINTMENTS_FILE, 'utf-8')) : [];
    writeFileSync(CASES_FILE, '[]');
    writeFileSync(APPOINTMENTS_FILE, '[]');
  });

  afterEach(() => {
    writeFileSync(CASES_FILE, JSON.stringify(originalCases, null, 2));
    writeFileSync(APPOINTMENTS_FILE, JSON.stringify(originalAppointments, null, 2));
  });

  it('creates an appointment with all fields', () => {
    const appt = createAppointment({
      caseNumber: 'LEA-000001',
      shopId: 'PS001',
      shopName: 'CarroFix Milano',
      dateTime: '2026-02-20T09:00:00Z',
      notes: 'Front bumper repair',
      contactName: 'Mario',
      contactPhone: '+39 333 1234567',
      vehicleInfo: '2024 Fiat 500',
      damageType: 'collision',
    });

    assert.ok(appt.Id);
    assert.equal(appt.CaseNumber, 'LEA-000001');
    assert.equal(appt.ShopId, 'PS001');
    assert.equal(appt.Status, 'Scheduled');
    assert.equal(appt.VehicleInfo, '2024 Fiat 500');
  });

  it('retrieves appointments by case number', () => {
    createAppointment({ caseNumber: 'LEA-000001', shopId: 'PS001', shopName: 'Shop 1', dateTime: '2026-02-20T09:00:00Z', contactPhone: '+111' });
    createAppointment({ caseNumber: 'LEA-000001', shopId: 'PS002', shopName: 'Shop 2', dateTime: '2026-02-21T10:00:00Z', contactPhone: '+111' });
    createAppointment({ caseNumber: 'LEA-000002', shopId: 'PS003', shopName: 'Shop 3', dateTime: '2026-02-22T11:00:00Z', contactPhone: '+222' });

    const results = getAppointments('LEA-000001');
    assert.equal(results.length, 2);
    assert.equal(results[0].ShopId, 'PS001'); // sorted by date
  });

  it('retrieves appointments by phone number', () => {
    createAppointment({ caseNumber: 'C1', shopId: 'S1', shopName: 'S1', dateTime: '2026-03-01T09:00:00Z', contactPhone: '+39 333 1234567' });
    createAppointment({ caseNumber: 'C2', shopId: 'S2', shopName: 'S2', dateTime: '2026-03-02T09:00:00Z', contactPhone: '+39 444 9999999' });

    const results = getAppointmentsByPhone('3331234567');
    assert.equal(results.length, 1);
  });

  it('updates an appointment', () => {
    const appt = createAppointment({ caseNumber: 'C1', shopId: 'S1', shopName: 'S1', dateTime: '2026-03-01T09:00:00Z', contactPhone: '+111' });
    const updated = updateAppointment(appt.Id, { Status: 'Completed' });
    assert.equal(updated.Status, 'Completed');
  });

  it('returns null when updating nonexistent appointment', () => {
    assert.equal(updateAppointment('fake_id', { Status: 'Cancelled' }), null);
  });
});

describe('Salesforce Mock - Roadside Cases', () => {
  beforeEach(() => {
    originalCases = existsSync(CASES_FILE) ? JSON.parse(readFileSync(CASES_FILE, 'utf-8')) : [];
    writeFileSync(CASES_FILE, '[]');
  });

  afterEach(() => {
    writeFileSync(CASES_FILE, JSON.stringify(originalCases, null, 2));
  });

  it('creates a roadside case with correct type and priority', () => {
    const c = createRoadsideCase({
      contactName: 'Test Driver',
      contactPhone: '+39 555 0000000',
      location: 'A1 Highway km 120',
      issueType: 'Towing',
      vehicleInfo: '2023 Alfa Romeo Giulia',
    });

    assert.equal(c.Type, 'Roadside Assistance');
    assert.equal(c.Priority, 'High'); // Towing = High
    assert.ok(c.Subject.includes('Roadside Assistance'));
    assert.ok(c.Subject.includes('Towing'));
  });

  it('sets Medium priority for non-towing issues', () => {
    const c = createRoadsideCase({
      contactPhone: '+39 555 1111111',
      location: 'Via Test',
      issueType: 'Flat Tire',
    });
    assert.equal(c.Priority, 'Medium');
  });
});

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const CASES_FILE = join(DATA_DIR, 'cases.json');
const APPOINTMENTS_FILE = join(DATA_DIR, 'appointments.json');

function loadJson(filePath) {
  if (!existsSync(filePath)) return [];
  return JSON.parse(readFileSync(filePath, 'utf-8'));
}

function saveJson(filePath, data) {
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function generateCaseNumber() {
  const ts = Date.now().toString(36).slice(-4).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
  return `LEA-${ts}${rand}`;
}

function generateId() {
  return 'sf_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function matchesPhone(stored, lookup) {
  if (!stored || !lookup) return false;
  const a = stored.replace(/\D/g, '');
  const b = lookup.replace(/\D/g, '');
  return a.endsWith(b.slice(-10)) || b.endsWith(a.slice(-10));
}

// --- Case Operations ---

export function createCase({ subject, description, priority, contactName, contactPhone, type, location, otherParties, injuries, policeReport }) {
  const cases = loadJson(CASES_FILE);
  const now = new Date().toISOString();
  const caseRecord = {
    Id: generateId(),
    CaseNumber: generateCaseNumber(),
    Subject: subject,
    Description: description,
    Status: 'New',
    Priority: priority || 'Medium',
    Type: type || 'Drivers Assistance',
    ContactName: contactName,
    ContactPhone: contactPhone,
    Location: location || null,
    OtherParties: otherParties || null,
    Injuries: injuries || false,
    PoliceReport: policeReport || null,
    CreatedDate: now,
    LastModifiedDate: now,
  };
  cases.push(caseRecord);
  saveJson(CASES_FILE, cases);
  return caseRecord;
}

export function getCase(caseNumber) {
  const cases = loadJson(CASES_FILE);
  return cases.find(c => c.CaseNumber === caseNumber) || null;
}

export function getCaseByPhone(phone) {
  const cases = loadJson(CASES_FILE);
  return cases
    .filter(c => matchesPhone(c.ContactPhone, phone))
    .sort((a, b) => new Date(b.CreatedDate) - new Date(a.CreatedDate));
}

export function updateCase(caseNumber, updates) {
  const cases = loadJson(CASES_FILE);
  const idx = cases.findIndex(c => c.CaseNumber === caseNumber);
  if (idx === -1) return null;
  cases[idx] = { ...cases[idx], ...updates, LastModifiedDate: new Date().toISOString() };
  saveJson(CASES_FILE, cases);
  return cases[idx];
}

export function listCases(filters = {}) {
  let cases = loadJson(CASES_FILE);
  if (filters.status) cases = cases.filter(c => c.Status === filters.status);
  if (filters.type) cases = cases.filter(c => c.Type === filters.type);
  if (filters.contactPhone) cases = cases.filter(c => c.ContactPhone === filters.contactPhone);
  return cases.sort((a, b) => new Date(b.CreatedDate) - new Date(a.CreatedDate));
}

// --- Appointment Operations ---

export function createAppointment({ caseNumber, shopId, shopName, dateTime, notes, contactName, contactPhone, vehicleInfo, damageType }) {
  const appointments = loadJson(APPOINTMENTS_FILE);
  const now = new Date().toISOString();
  const appointment = {
    Id: generateId(),
    CaseNumber: caseNumber || null,
    ShopId: shopId,
    ShopName: shopName,
    DateTime: dateTime,
    Status: 'Scheduled',
    Notes: notes || null,
    ContactName: contactName,
    ContactPhone: contactPhone,
    VehicleInfo: vehicleInfo || null,
    DamageType: damageType || null,
    CreatedDate: now,
    LastModifiedDate: now,
  };
  appointments.push(appointment);
  saveJson(APPOINTMENTS_FILE, appointments);
  return appointment;
}

export function getAppointments(caseNumber) {
  const appointments = loadJson(APPOINTMENTS_FILE);
  return appointments
    .filter(a => a.CaseNumber === caseNumber)
    .sort((a, b) => new Date(a.DateTime) - new Date(b.DateTime));
}

export function getAppointmentsByPhone(phone) {
  const appointments = loadJson(APPOINTMENTS_FILE);
  return appointments
    .filter(a => matchesPhone(a.ContactPhone, phone))
    .sort((a, b) => new Date(a.DateTime) - new Date(b.DateTime));
}

export function updateAppointment(appointmentId, updates) {
  const appointments = loadJson(APPOINTMENTS_FILE);
  const idx = appointments.findIndex(a => a.Id === appointmentId);
  if (idx === -1) return null;
  appointments[idx] = { ...appointments[idx], ...updates, LastModifiedDate: new Date().toISOString() };
  saveJson(APPOINTMENTS_FILE, appointments);
  return appointments[idx];
}

// --- Roadside Assistance Operations ---

export function createRoadsideCase({ contactName, contactPhone, location, issueType, vehicleInfo, description }) {
  return createCase({
    subject: `Roadside Assistance - ${issueType}`,
    description: description || `${issueType} reported at ${location}`,
    priority: issueType === 'Towing' ? 'High' : 'Medium',
    contactName,
    contactPhone,
    type: 'Roadside Assistance',
    location,
  });
}

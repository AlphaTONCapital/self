import { sayAndGather, sayAndHangup, redirect, transferToAgent } from '../services/twilio-voice.mjs';
import { createAppointment, createCase } from '../services/salesforce-mock.mjs';
import { findBestShops, formatShopForVoice } from '../services/body-shop-directory.mjs';

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

function parseDateFromSpeech(speech) {
  const lower = speech.toLowerCase();
  const now = new Date();

  if (lower.includes('tomorrow')) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }
  if (lower.includes('next week') || lower.includes('monday')) {
    const d = new Date(now);
    const daysUntilMonday = (8 - d.getDay()) % 7 || 7;
    d.setDate(d.getDate() + daysUntilMonday);
    d.setHours(9, 0, 0, 0);
    return d.toISOString();
  }
  if (lower.includes('today') || lower.includes('as soon as possible') || lower.includes('asap')) {
    const d = new Date(now);
    d.setHours(d.getHours() + 2);
    d.setMinutes(0, 0, 0);
    return d.toISOString();
  }

  const dateMatch = lower.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2})/);
  if (dateMatch) {
    const months = { january: 0, february: 1, march: 2, april: 3, may: 4, june: 5, july: 6, august: 7, september: 8, october: 9, november: 10, december: 11 };
    const d = new Date(now.getFullYear(), months[dateMatch[1]], parseInt(dateMatch[2]), 9, 0, 0);
    if (d < now) d.setFullYear(d.getFullYear() + 1);
    return d.toISOString();
  }

  const d = new Date(now);
  d.setDate(d.getDate() + 2);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

function formatDateTime(isoString) {
  const d = new Date(isoString);
  const options = { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' };
  return d.toLocaleDateString('en-US', options);
}

function detectDamageType(speech) {
  const lower = speech.toLowerCase();
  if (lower.includes('collision') || lower.includes('crash') || lower.includes('accident') || lower.includes('hit')) return 'collision';
  if (lower.includes('paint') || lower.includes('scratch') || lower.includes('key')) return 'paint';
  if (lower.includes('glass') || lower.includes('windshield') || lower.includes('window')) return 'glass';
  if (lower.includes('dent') || lower.includes('ding') || lower.includes('hail')) return 'dent';
  if (lower.includes('bumper')) return 'collision';
  return 'general';
}

export function handleEntry(req) {
  const callSid = req.body.CallSid;
  const callerNumber = req.query.from || req.body.From || 'Unknown';
  const state = getState(callSid);
  state.data.contactPhone = callerNumber;

  return sayAndGather(
    `I'll help you book a body shop appointment. First, can you tell me your vehicle information? ` +
    `Please include the make, model, and year. For example, "2024 Fiat 500".`,
    '/voice/flow/body-shop-booking/gather?step=vehicle_info',
    { timeout: 10 }
  );
}

export async function handleGather(req) {
  const callSid = req.body.CallSid;
  const speech = req.body.SpeechResult || '';
  const step = req.query.step || 'vehicle_info';
  const state = getState(callSid);

  switch (step) {
    case 'vehicle_info':
      state.data.vehicleInfo = speech;
      return sayAndGather(
        `Got it, ${speech}. What type of damage needs repair? ` +
        `For example: "collision damage", "paint scratch", "dent on door", or "windshield crack".`,
        '/voice/flow/body-shop-booking/gather?step=damage_type',
        { timeout: 10 }
      );

    case 'damage_type':
      state.data.damageDescription = speech;
      state.data.damageType = detectDamageType(speech);
      return sayAndGather(
        `What area are you located in? Please provide your city or zip code so I can find shops near you.`,
        '/voice/flow/body-shop-booking/gather?step=location',
        { timeout: 10 }
      );

    case 'location': {
      state.data.location = speech;

      const shops = await findBestShops(45.4642, 9.19, {
        damageType: state.data.damageType,
        maxResults: 3,
      });

      if (shops.length === 0) {
        cleanupState(callSid);
        return transferToAgent(
          `I wasn't able to find any body shops in your area. Let me connect you with an agent who can help.`
        );
      }

      state.data.availableShops = shops;
      const shopList = shops.map((s, i) => formatShopForVoice(s, i)).join(' ');

      return sayAndGather(
        `I found ${shops.length} body shop${shops.length > 1 ? 's' : ''} near you. ` +
        `${shopList} ` +
        `Which option would you like? Say "option 1", "option 2", or "option 3".`,
        '/voice/flow/body-shop-booking/gather?step=select_shop',
        { timeout: 10 }
      );
    }

    case 'select_shop': {
      const lower = speech.toLowerCase();
      let shopIndex = 0;
      if (lower.includes('2') || lower.includes('two') || lower.includes('second')) shopIndex = 1;
      if (lower.includes('3') || lower.includes('three') || lower.includes('third')) shopIndex = 2;

      const shops = state.data.availableShops || [];
      if (shopIndex >= shops.length) shopIndex = 0;
      state.data.selectedShop = shops[shopIndex];

      return sayAndGather(
        `Great choice. ${shops[shopIndex].name}. When would you like your appointment? ` +
        `You can say "tomorrow", "next week", "as soon as possible", or a specific date.`,
        '/voice/flow/body-shop-booking/gather?step=preferred_date',
        { timeout: 10 }
      );
    }

    case 'preferred_date': {
      const dateTime = parseDateFromSpeech(speech);
      state.data.dateTime = dateTime;
      const formatted = formatDateTime(dateTime);
      const shop = state.data.selectedShop;

      return sayAndGather(
        `Let me confirm your appointment. ` +
        `Vehicle: ${state.data.vehicleInfo}. ` +
        `Repair: ${state.data.damageDescription}. ` +
        `Body shop: ${shop.name} at ${shop.address}. ` +
        `Date and time: ${formatted}. ` +
        `Is this correct? Say "yes" to confirm or "no" to change something.`,
        '/voice/flow/body-shop-booking/gather?step=confirm',
        { timeout: 8 }
      );
    }

    case 'confirm': {
      const lower = speech.toLowerCase();
      const confirmed = lower.includes('yes') || lower.includes('correct') || lower.includes('right') || lower.includes('confirm');
      if (!confirmed) {
        cleanupState(callSid);
        return redirect('/voice/flow/body-shop-booking');
      }
      return redirect('/voice/flow/body-shop-booking/finalize');
    }

    default:
      cleanupState(callSid);
      return transferToAgent("I'm having trouble with the booking. Let me connect you with an agent.");
  }
}

export function handleFinalize(req) {
  const callSid = req.body.CallSid;
  const state = getState(callSid);
  const shop = state.data.selectedShop;

  const caseRecord = createCase({
    subject: `Body Shop Appointment - ${state.data.damageType}`,
    description: `Vehicle: ${state.data.vehicleInfo}. Damage: ${state.data.damageDescription}. Shop: ${shop.name}`,
    priority: 'Medium',
    contactName: null,
    contactPhone: state.data.contactPhone,
    type: 'Body Shop Booking',
    location: state.data.location,
  });

  createAppointment({
    caseNumber: caseRecord.CaseNumber,
    shopId: shop.id,
    shopName: shop.name,
    dateTime: state.data.dateTime,
    notes: `Damage: ${state.data.damageDescription}`,
    contactName: null,
    contactPhone: state.data.contactPhone,
    vehicleInfo: state.data.vehicleInfo,
    damageType: state.data.damageType,
  });

  const formatted = formatDateTime(state.data.dateTime);

  const response = sayAndHangup(
    `Your appointment has been booked. ` +
    `Your case number is ${caseRecord.CaseNumber.split('').join(' ')}. ` +
    `You're scheduled at ${shop.name}, ${shop.address}, on ${formatted}. ` +
    `${shop.phone ? 'The shop phone number is ' + shop.phone.split('').join(' ') + '. ' : ''}` +
    `Please arrive 10 minutes early with your rental agreement and ID. ` +
    `Thank you for calling Leasys Drivers Assistance.`
  );

  cleanupState(callSid);
  return response;
}

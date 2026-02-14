import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import https from 'node:https';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PARTNER_SHOPS_FILE = join(__dirname, '..', 'data', 'partner-shops.json');

const EARTH_RADIUS_KM = 6371;
const DEFAULT_RADIUS_KM = 30;
const MAX_RESULTS = 3;

function loadPartnerShops() {
  if (!existsSync(PARTNER_SHOPS_FILE)) return [];
  return JSON.parse(readFileSync(PARTNER_SHOPS_FILE, 'utf-8'));
}

function haversineDistance(lat1, lng1, lat2, lng2) {
  const toRad = deg => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          return;
        }
        resolve(JSON.parse(data));
      });
      res.on('error', reject);
    }).on('error', reject);
  });
}

export function findPartnerShops(lat, lng, { radiusKm = DEFAULT_RADIUS_KM, damageType = null, maxResults = MAX_RESULTS } = {}) {
  const shops = loadPartnerShops();
  const results = shops
    .map(shop => ({
      ...shop,
      distance: haversineDistance(lat, lng, shop.lat, shop.lng),
    }))
    .filter(shop => shop.distance <= radiusKm)
    .filter(shop => !damageType || shop.specialties.includes(damageType))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxResults);
  return results;
}

export async function findNearbyShopsGoogle(lat, lng, { radiusMeters = 30000, maxResults = MAX_RESULTS } = {}) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&type=car_repair&keyword=body+shop+carrozzeria&key=${apiKey}`;
  const data = await httpGet(url);

  if (data.status !== 'OK' || !data.results) return [];

  return data.results.slice(0, maxResults).map(place => ({
    id: place.place_id,
    name: place.name,
    address: place.vicinity,
    lat: place.geometry.location.lat,
    lng: place.geometry.location.lng,
    phone: null,
    rating: place.rating || null,
    distance: haversineDistance(lat, lng, place.geometry.location.lat, place.geometry.location.lng),
    source: 'google_places',
    specialties: ['general'],
  }));
}

export async function findBestShops(lat, lng, options = {}) {
  const partnerShops = findPartnerShops(lat, lng, options);

  if (partnerShops.length >= (options.maxResults || MAX_RESULTS)) {
    return partnerShops.map(s => ({ ...s, source: 'partner' }));
  }

  const googleShops = await findNearbyShopsGoogle(lat, lng, options);
  const combined = [
    ...partnerShops.map(s => ({ ...s, source: 'partner' })),
    ...googleShops,
  ];

  const seen = new Set();
  return combined.filter(shop => {
    const key = `${shop.lat.toFixed(4)},${shop.lng.toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, options.maxResults || MAX_RESULTS);
}

export function getPartnerShopById(shopId) {
  const shops = loadPartnerShops();
  return shops.find(s => s.id === shopId) || null;
}

export function getPartnerShopByName(name) {
  const shops = loadPartnerShops();
  const lower = name.toLowerCase();
  return shops.find(s => s.name.toLowerCase().includes(lower)) || null;
}

export function listAllPartnerShops() {
  return loadPartnerShops();
}

export function formatShopForVoice(shop, index) {
  const distStr = shop.distance ? `${shop.distance.toFixed(1)} kilometers away` : '';
  const ratingStr = shop.rating ? `, rated ${shop.rating} out of 5` : '';
  const sourceStr = shop.source === 'partner' ? ', a Leasys partner shop' : '';
  return `Option ${index + 1}: ${shop.name}${sourceStr}, located at ${shop.address}${distStr ? ', ' + distStr : ''}${ratingStr}.`;
}

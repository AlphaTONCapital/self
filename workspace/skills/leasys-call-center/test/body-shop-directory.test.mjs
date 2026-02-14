import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { findPartnerShops, findBestShops, getPartnerShopById, getPartnerShopByName, listAllPartnerShops, formatShopForVoice } from '../src/services/body-shop-directory.mjs';

describe('Body Shop Directory - Partner Shops', () => {
  it('loads all partner shops', () => {
    const shops = listAllPartnerShops();
    assert.ok(shops.length >= 8);
    assert.ok(shops[0].id);
    assert.ok(shops[0].name);
    assert.ok(shops[0].lat);
    assert.ok(shops[0].lng);
  });

  it('finds partner shops near Milan', () => {
    const shops = findPartnerShops(45.4642, 9.19);
    assert.ok(shops.length > 0);
    assert.ok(shops[0].distance < 30); // within default radius
    // Should be sorted by distance
    for (let i = 1; i < shops.length; i++) {
      assert.ok(shops[i].distance >= shops[i - 1].distance);
    }
  });

  it('finds no shops when far from any partner', () => {
    const shops = findPartnerShops(0, 0); // middle of the ocean
    assert.equal(shops.length, 0);
  });

  it('filters by damage type specialty', () => {
    const shops = findPartnerShops(45.4642, 9.19, { damageType: 'glass', radiusKm: 500 });
    for (const shop of shops) {
      assert.ok(shop.specialties.includes('glass'));
    }
  });

  it('respects maxResults limit', () => {
    const shops = findPartnerShops(45.4642, 9.19, { radiusKm: 1000, maxResults: 2 });
    assert.ok(shops.length <= 2);
  });

  it('respects radiusKm parameter', () => {
    const nearShops = findPartnerShops(45.4642, 9.19, { radiusKm: 10 });
    const farShops = findPartnerShops(45.4642, 9.19, { radiusKm: 1000 });
    assert.ok(farShops.length >= nearShops.length);
  });

  it('gets partner shop by ID', () => {
    const shop = getPartnerShopById('PS001');
    assert.ok(shop);
    assert.equal(shop.id, 'PS001');
    assert.equal(shop.name, 'CarroFix Milano Centro');
  });

  it('returns null for unknown shop ID', () => {
    assert.equal(getPartnerShopById('NONEXISTENT'), null);
  });

  it('gets partner shop by name', () => {
    const shop = getPartnerShopByName('CarroFix');
    assert.ok(shop);
    assert.ok(shop.name.includes('CarroFix'));
  });

  it('name search is case insensitive', () => {
    const shop = getPartnerShopByName('carrofix');
    assert.ok(shop);
  });

  it('returns null for unknown shop name', () => {
    assert.equal(getPartnerShopByName('NonExistentShop'), null);
  });
});

describe('Body Shop Directory - findBestShops', () => {
  it('returns partner shops first when available', async () => {
    const shops = await findBestShops(45.4642, 9.19, { radiusKm: 50 });
    assert.ok(shops.length > 0);
    assert.equal(shops[0].source, 'partner');
  });

  it('returns empty for remote locations without Google API key', async () => {
    const original = process.env.GOOGLE_PLACES_API_KEY;
    delete process.env.GOOGLE_PLACES_API_KEY;
    const shops = await findBestShops(0, 0); // middle of ocean, no partners, no Google
    assert.equal(shops.length, 0);
    if (original) process.env.GOOGLE_PLACES_API_KEY = original;
  });

  it('deduplicates by location', async () => {
    const shops = await findBestShops(45.4642, 9.19, { radiusKm: 500, maxResults: 10 });
    const coords = shops.map(s => `${s.lat.toFixed(3)},${s.lng.toFixed(3)}`);
    const unique = new Set(coords);
    assert.equal(coords.length, unique.size);
  });
});

describe('formatShopForVoice', () => {
  it('formats partner shop with full details', () => {
    const shop = {
      name: 'Test Shop',
      address: 'Via Test 1, Roma',
      distance: 5.3,
      rating: 4.5,
      source: 'partner',
    };
    const result = formatShopForVoice(shop, 0);
    assert.ok(result.includes('Option 1'));
    assert.ok(result.includes('Test Shop'));
    assert.ok(result.includes('partner'));
    assert.ok(result.includes('5.3 kilometers'));
    assert.ok(result.includes('4.5 out of 5'));
  });

  it('formats google shop without partner label', () => {
    const shop = {
      name: 'Google Shop',
      address: 'Via Google 1',
      distance: 2.1,
      source: 'google_places',
    };
    const result = formatShopForVoice(shop, 1);
    assert.ok(result.includes('Option 2'));
    assert.ok(!result.includes('partner'));
  });

  it('handles missing distance and rating', () => {
    const shop = {
      name: 'Bare Shop',
      address: 'Via Bare 1',
      source: 'partner',
    };
    const result = formatShopForVoice(shop, 0);
    assert.ok(result.includes('Bare Shop'));
    assert.ok(!result.includes('kilometers'));
    assert.ok(!result.includes('rated'));
  });
});

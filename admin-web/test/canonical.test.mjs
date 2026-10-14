import { test } from 'node:test';
import assert from 'node:assert/strict';

// Import from canonical.ts using compiled code or pure domain functions
import {
  getZoneByDistrict,
  getZoneByCoordinates,
  resolveOperationalZone,
  normalizeDistrictName,
} from '../src/types/canonical.ts';

import {
  getDefaultVisitFee,
  formatPriceCents,
  solesToCents,
  centsToSoles,
  resolvePricingPolicy,
} from '../src/services/pricingPolicyService.ts';

test('Canonical: District normalization trims and removes diacritics', () => {
  assert.equal(normalizeDistrictName('  Jesús María  '), 'JESUS MARIA');
  assert.equal(normalizeDistrictName('DISTRITO DE LOS OLIVOS'), 'LOS OLIVOS');
  assert.equal(normalizeDistrictName(''), '');
});

test('Canonical: District resolves to exact OperationalZone without Lima Centro bias', () => {
  assert.equal(getZoneByDistrict('Comas'), 'LIMA_NORTE');
  assert.equal(getZoneByDistrict('Los Olivos'), 'LIMA_NORTE');
  assert.equal(getZoneByDistrict('Miraflores'), 'LIMA_CENTRO');
  assert.equal(getZoneByDistrict('San Juan de Miraflores'), 'LIMA_SUR');
  assert.equal(getZoneByDistrict('Callao'), 'CALLAO');
  assert.equal(getZoneByDistrict('Ate'), 'LIMA_ESTE');
  assert.equal(getZoneByDistrict('Distrito Inexistente'), 'UNKNOWN');
});

test('Canonical: Coordinates resolve within bounding box', () => {
  // Los Olivos / Comas approx (-11.95, -77.06) -> LIMA_NORTE
  assert.equal(getZoneByCoordinates(-11.95, -77.06), 'LIMA_NORTE');
  // Miraflores (-12.12, -77.03) -> LIMA_CENTRO
  assert.equal(getZoneByCoordinates(-12.08, -77.03), 'LIMA_CENTRO');
  // Coordinates outside Lima Metropolitan area -> UNKNOWN
  assert.equal(getZoneByCoordinates(0, 0), 'UNKNOWN');
  assert.equal(getZoneByCoordinates(NaN, NaN), 'UNKNOWN');
});

test('Canonical: Fallback resolution never defaults to Lima Centro', () => {
  const resolved = resolveOperationalZone({ district: 'Cusco' });
  assert.equal(resolved, 'UNKNOWN');
});

test('Pricing: Monetary values integer cents round-trip', () => {
  assert.equal(solesToCents(50), 5000);
  assert.equal(solesToCents(85.50), 8550);
  assert.equal(solesToCents('120.00'), 12000);
  assert.equal(centsToSoles(5000), 50.00);
  assert.equal(centsToSoles(8550), 85.50);
  assert.equal(formatPriceCents(5000), 'S/. 50.00');
});

test('Pricing: Default visit fee policy resolves active 2026 policy', () => {
  const policy = resolvePricingPolicy('LIMA_NORTE', 'Gasfitero');
  assert.equal(policy.defaultVisitFeeCents, 5000);
  assert.equal(policy.currency, 'PEN');
  assert.equal(getDefaultVisitFee('LIMA_NORTE', 'Gasfitero'), 50);
});

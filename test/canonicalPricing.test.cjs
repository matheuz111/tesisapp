const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const context = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/services/pricing.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  context
);
const { parsePriceCents, formatPrice } = context.exports;

test('Canonical pricing validates integer cents and bounds', () => {
  // Positive integers within bounds (1 to 9999999 cents = S/ 0.01 to S/ 99,999.99)
  assert.equal(parsePriceCents('50.00'), 5000);
  assert.equal(parsePriceCents('50'), 5000);
  assert.equal(parsePriceCents('120.50'), 12050);
  assert.equal(parsePriceCents('99999.99'), 9999999);

  // Invalids: 0, negatives, exceeds max, non-numeric
  assert.equal(parsePriceCents('0'), null);
  assert.equal(parsePriceCents('-50'), null);
  assert.equal(parsePriceCents('100000.00'), null);
  assert.equal(parsePriceCents('abc'), null);
});

test('Canonical pricing object adheres to firestore.rules contract', () => {
  const amountCents = parsePriceCents('50.00');
  assert.ok(amountCents !== null);

  const prevVersion = 0;
  const canonicalPricing = {
    amountCents,
    price: amountCents / 100,
    currency: 'PEN',
    description: 'Tarifa de visita técnica y diagnóstico inicial',
    assignedBy: 'OPERATOR_123',
    version: prevVersion + 1,
  };

  assert.equal(Number.isInteger(canonicalPricing.amountCents), true);
  assert.ok(canonicalPricing.amountCents > 0 && canonicalPricing.amountCents <= 9999999);
  assert.equal(canonicalPricing.currency, 'PEN');
  assert.ok(canonicalPricing.description.length > 0 && canonicalPricing.description.length <= 300);
  assert.equal(canonicalPricing.version, 1);
  assert.equal(formatPrice(canonicalPricing.amountCents), 'S/ 50.00');
});

test('Price formatting matches Peruvian Soles representation', () => {
  assert.equal(formatPrice(5000), 'S/ 50.00');
  assert.equal(formatPrice(100), 'S/ 1.00');
  assert.equal(formatPrice(99), 'S/ 0.99');
});

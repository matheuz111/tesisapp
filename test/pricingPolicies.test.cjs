const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const context = { exports: {}, require: (mod) => {
  if (mod === './pricing') {
    const pContext = { exports: {} };
    vm.runInNewContext(
      ts.transpileModule(fs.readFileSync('src/services/pricing.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
      }).outputText,
      pContext
    );
    return pContext.exports;
  }
  if (mod === '../types/canonical') {
    const cContext = { exports: {} };
    vm.runInNewContext(
      ts.transpileModule(fs.readFileSync('src/types/canonical.ts', 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.CommonJS },
      }).outputText,
      cContext
    );
    return cContext.exports;
  }
  throw new Error(`Unknown require: ${mod}`);
}};

vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/services/pricingPolicyService.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  context
);

const {
  DEFAULT_TECHNICAL_VISIT_POLICY,
  resolvePricingPolicy,
  getFormattedVisitFee,
  solesToCents,
  centsToSoles,
} = context.exports;

test('Default pricing policy has audited validity, conditions, and deductible visit fee', () => {
  assert.equal(DEFAULT_TECHNICAL_VISIT_POLICY.defaultVisitFeeCents, 5000);
  assert.equal(DEFAULT_TECHNICAL_VISIT_POLICY.currency, 'PEN');
  assert.equal(DEFAULT_TECHNICAL_VISIT_POLICY.deductibleFromTotal, true);
  assert.equal(DEFAULT_TECHNICAL_VISIT_POLICY.isActive, true);
  assert.ok(DEFAULT_TECHNICAL_VISIT_POLICY.conditions.length >= 3);
  assert.equal(getFormattedVisitFee(DEFAULT_TECHNICAL_VISIT_POLICY), 'Visita técnica: S/ 50.00 (Deducible)');
});

test('Resolves zone-specific policies when configured', () => {
  const callaoPolicy = resolvePricingPolicy('CALLAO', 'Electricidad', '2026-05-01');
  assert.equal(callaoPolicy.id, 'POL-VISIT-CALLAO-2026');
  assert.equal(callaoPolicy.zone, 'CALLAO');
});

test('Falls back to default policy when outside validity or no zone override', () => {
  const defaultPolicy = resolvePricingPolicy('LIMA_NORTE', 'Gasfitería', '2026-05-01');
  assert.equal(defaultPolicy.id, 'POL-VISIT-2026-BASE');
});

test('Currency conversion utilities correctly convert between soles and integer cents', () => {
  assert.equal(solesToCents(50), 5000);
  assert.equal(solesToCents('50.00'), 5000);
  assert.equal(solesToCents('35.50'), 3550);
  assert.equal(solesToCents(0.29), 29);
  assert.equal(centsToSoles(5000), 50.00);
  assert.equal(centsToSoles(3550), 35.50);
  assert.equal(centsToSoles(29), 0.29);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const context = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/services/locationCompliance.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  context,
);
const { isWithinWorkHours, evaluateLocationCompliance, shouldRemind, REMINDER_COOLDOWN_MS, LOCATION_REMINDER_COPY } = context.exports;

// Hora de Lima = UTC-5. Miércoles 11 nov 2026, 10:00 en Lima = 15:00 UTC.
const wed10 = new Date(Date.UTC(2026, 10, 11, 15, 0));

test('Horario laboral: lunes a sábado de 08:00 a 18:00 hora de Lima', () => {
  assert.equal(isWithinWorkHours(wed10), true);
  assert.equal(isWithinWorkHours(new Date(Date.UTC(2026, 10, 11, 13, 0))), true, '08:00 en Lima: incluido');
  assert.equal(isWithinWorkHours(new Date(Date.UTC(2026, 10, 11, 12, 59))), false, '07:59 en Lima: antes de la jornada');
  assert.equal(isWithinWorkHours(new Date(Date.UTC(2026, 10, 11, 22, 59))), true, '17:59 en Lima: aún dentro');
  assert.equal(isWithinWorkHours(new Date(Date.UTC(2026, 10, 11, 23, 0))), false, '18:00 en Lima: fuera');
});

test('Horario laboral: el domingo no corresponde avisar', () => {
  const sunday10 = new Date(Date.UTC(2026, 10, 15, 15, 0));
  assert.equal(isWithinWorkHours(sunday10), false);
  assert.equal(isWithinWorkHours(new Date(Date.UTC(2026, 10, 14, 15, 0))), true, 'el sábado sí es laborable');
});

test('Horario laboral: usa Lima y no la zona del teléfono (UTC-5 sin horario de verano)', () => {
  // 23:30 UTC del martes ya es 18:30 en Lima: fuera de jornada aunque en UTC sea tarde de martes.
  assert.equal(isWithinWorkHours(new Date(Date.UTC(2026, 10, 10, 23, 30))), false);
  // 02:00 UTC del miércoles es 21:00 del martes en Lima.
  assert.equal(isWithinWorkHours(new Date(Date.UTC(2026, 10, 11, 2, 0))), false);
});

test('Cumplimiento: solo se avisa al técnico disponible, en horario y con un problema real', () => {
  const ok = { available: true, servicesEnabled: true, permissionGranted: true, now: wed10 };
  assert.equal(evaluateLocationCompliance(ok), null);
  assert.equal(evaluateLocationCompliance({ ...ok, servicesEnabled: false }), 'SERVICES_OFF');
  assert.equal(evaluateLocationCompliance({ ...ok, permissionGranted: false }), 'PERMISSION_DENIED');
  assert.equal(evaluateLocationCompliance({ ...ok, permissionGranted: false, servicesEnabled: false }), 'PERMISSION_DENIED', 'el permiso es lo primero');
  assert.equal(evaluateLocationCompliance({ ...ok, servicesEnabled: false, available: false }), null, 'desconectado: no se avisa');
  assert.equal(evaluateLocationCompliance({ ...ok, servicesEnabled: false, now: new Date(Date.UTC(2026, 10, 11, 4, 0)) }), null, 'fuera de horario: no se avisa');
});

test('Recordatorios: máximo uno cada 15 minutos', () => {
  const now = 1_000_000_000;
  assert.equal(shouldRemind(null, now), true);
  assert.equal(shouldRemind(now - REMINDER_COOLDOWN_MS + 1, now), false);
  assert.equal(shouldRemind(now - REMINDER_COOLDOWN_MS, now), true);
});

test('Textos: cada problema tiene título, mensaje y acción, sin emojis', () => {
  for (const issue of ['SERVICES_OFF', 'PERMISSION_DENIED']) {
    const copy = LOCATION_REMINDER_COPY[issue];
    assert.ok(copy.title && copy.body && copy.action);
    assert.doesNotMatch(copy.title + copy.body + copy.action, /[\u{1F300}-\u{1FAFF}]/u);
  }
});

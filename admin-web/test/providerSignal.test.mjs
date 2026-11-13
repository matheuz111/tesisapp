import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findStaleProviders, isWithinWorkHours } from '../src/utils/providerSignal.ts';

// Miércoles 11 nov 2026, 10:00 en Lima (UTC-5) = 15:00 UTC.
const NOW = new Date(Date.UTC(2026, 10, 11, 15, 0));
const ago = (minutes) => ({ toMillis: () => NOW.getTime() - minutes * 60000 });

const presence = [
  { providerId: 'a', providerName: 'Juan Ramos', providerPhone: '999111222', status: 'AVAILABLE', lastSeenAt: ago(5) },
  { providerId: 'b', providerName: 'Pedro Pérez', status: 'AVAILABLE', lastSeenAt: ago(35) },
  { providerId: 'c', providerName: 'Luis Díaz', status: 'BUSY', lastSeenAt: ago(90) },
  { providerId: 'd', providerName: 'Sin datos', status: 'AVAILABLE' },
  { providerId: 'e', providerName: 'Desconectado', status: 'OFFLINE', lastSeenAt: ago(500) },
];

test('Horario laboral: lunes a sábado, 08:00 a 18:00 hora de Lima', () => {
  assert.equal(isWithinWorkHours(NOW), true);
  assert.equal(isWithinWorkHours(new Date(Date.UTC(2026, 10, 11, 23, 0))), false);
  assert.equal(isWithinWorkHours(new Date(Date.UTC(2026, 10, 15, 15, 0))), false, 'domingo');
});

test('Sin señal: lista a los conectados con más de 20 minutos, del más silencioso al menos', () => {
  const stale = findStaleProviders(presence, NOW);
  assert.deepEqual(stale.map((s) => s.providerId), ['d', 'c', 'b']);
  assert.equal(stale.find((s) => s.providerId === 'b').minutesSilent, 35);
  assert.equal(stale.find((s) => s.providerId === 'd').minutesSilent, null, 'nunca reportó');
});

test('Sin señal: los desconectados y los que reportan al día no cuentan', () => {
  const ids = findStaleProviders(presence, NOW).map((s) => s.providerId);
  assert.ok(!ids.includes('a'));
  assert.ok(!ids.includes('e'));
});

test('Sin señal: fuera de horario laboral no se reporta a nadie', () => {
  assert.deepEqual(findStaleProviders(presence, new Date(Date.UTC(2026, 10, 11, 4, 0))), []);
});

test('Sin señal: el umbral es configurable', () => {
  assert.deepEqual(findStaleProviders(presence, NOW, 60).map((s) => s.providerId), ['d', 'c']);
});

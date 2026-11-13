import { test } from 'node:test';
import assert from 'node:assert/strict';
import { actorLabel, describeTransition, formatDuration, roleLabel } from '../src/utils/historyPresentation.ts';

test('Roles: nombres en español y sin valores crudos de la base de datos', () => {
  assert.equal(roleLabel('CLIENT'), 'Cliente');
  assert.equal(roleLabel('PROVIDER'), 'Técnico');
  assert.equal(roleLabel('OPERATOR'), 'Central');
  assert.equal(roleLabel(undefined), 'Sistema');
  assert.equal(roleLabel('LO_QUE_SEA'), 'Sistema');
});

test('Actor: usa el nombre real y nunca el identificador', () => {
  const ctx = { clientName: 'Rosa Quispe', providerName: 'Juan Ramos' };
  assert.equal(actorLabel({ actorRole: 'CLIENT', actorId: 'EnYW3eX7' }, ctx), 'Rosa Quispe (Cliente)');
  assert.equal(actorLabel({ actorRole: 'PROVIDER', actorId: 'R698PbaS' }, ctx), 'Juan Ramos (Técnico)');
  assert.equal(actorLabel({ actorRole: 'OPERATOR', actorId: 'gwblSVHB' }, ctx), 'Central de operaciones');
  assert.equal(actorLabel({ actorRole: 'CLIENT', actorId: 'EnYW3eX7' }, {}), 'Cliente');
});

test('Transiciones: la misma entrada PENDING_ASSIGNMENT se explica según de dónde viene', () => {
  assert.equal(describeTransition({ toStatus: 'PENDING_ASSIGNMENT' }).title, 'Solicitud recibida');
  assert.equal(describeTransition({ fromStatus: 'QUOTED', toStatus: 'PENDING_ASSIGNMENT' }).title, 'El cliente aprobó la cotización');
  assert.equal(describeTransition({ toStatus: 'REQUIRES_REASSIGNMENT' }).tone, 'warning');
  assert.equal(describeTransition({ toStatus: 'CANCELLED_BY_CLIENT' }).tone, 'danger');
  assert.equal(describeTransition({ toStatus: 'VALIDATED' }).tone, 'success');
});

test('Transiciones: estados desconocidos no muestran el código en mayúsculas', () => {
  assert.equal(describeTransition({ toStatus: 'ALGO_NUEVO' }).title, 'Algo nuevo');
  assert.equal(describeTransition({}).title, 'Cambio de estado');
});

test('Duración: segundos, minutos, horas y días', () => {
  assert.equal(formatDuration(45_000), '45 s');
  assert.equal(formatDuration(114_000), '1 min 54 s');
  assert.equal(formatDuration(5 * 60_000), '5 min');
  assert.equal(formatDuration(75 * 60_000), '1 h 15 min');
  assert.equal(formatDuration(27 * 3_600_000), '1 d 3 h');
  assert.equal(formatDuration(-1), null);
  assert.equal(formatDuration(null), null);
});

test('Motivos: traduce los códigos y respeta el texto libre', async () => {
  const { formatReason } = await import('../src/utils/historyPresentation.ts');
  assert.equal(formatReason('OUT_OF_SPECIALTY'), 'Fuera de la especialidad del técnico');
  assert.equal(formatReason('DISTANCE'), 'Distancia excesiva o fuera de zona');
  assert.equal(formatReason('CLIENT_NO_SHOW'), 'Client no show');
  assert.equal(formatReason('Cambié de opinión'), 'Cambié de opinión');
  assert.equal(formatReason(''), '');
  assert.equal(formatReason(undefined), '');
});

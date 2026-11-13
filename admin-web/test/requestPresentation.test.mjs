import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  explainStage,
  formatElapsed,
  getWarranty,
  canAssign,
  describeSla,
  buildTimeline,
} from '../src/components/dashboard/requestPresentation.ts';

const day = 24 * 60 * 60 * 1000;

test('Etapas: la central solo debe actuar en por asignar, reasignar y completado', () => {
  const needs = (status) => explainStage({ id: 'x', status }).needsAction;
  assert.equal(needs('PENDING_ASSIGNMENT'), true);
  assert.equal(needs('REQUIRES_REASSIGNMENT'), true);
  assert.equal(needs('COMPLETED'), true);
  assert.equal(needs('ACCEPTED'), false);
  assert.equal(needs('IN_PROGRESS'), false);
  assert.equal(needs('CANCELLED_BY_CLIENT'), false);
});

test('Etapas: usa el nombre del técnico cuando existe y un genérico cuando no', () => {
  assert.match(explainStage({ id: 'x', status: 'ACCEPTED', providerName: 'Juan Ramos' }).what, /Juan Ramos/);
  assert.match(explainStage({ id: 'x', status: 'ACCEPTED' }).what, /^El técnico/);
});

test('Asignación: solo se ofrece cuando está por asignar o reasignar', () => {
  assert.equal(canAssign({ id: 'x', status: 'PENDING_ASSIGNMENT' }), true);
  assert.equal(canAssign({ id: 'x', status: 'REQUIRES_REASSIGNMENT' }), true);
  assert.equal(canAssign({ id: 'x', status: 'PENDING' }), false);
});

test('formatElapsed: minutos, horas y días legibles', () => {
  assert.equal(formatElapsed(0), 'menos de 1 min');
  assert.equal(formatElapsed(45), '45 min');
  assert.equal(formatElapsed(60), '1 h');
  assert.equal(formatElapsed(75), '1 h 15 min');
  assert.equal(formatElapsed(24 * 60), '1 d');
  assert.equal(formatElapsed(50 * 60), '2 d 2 h');
});

test('describeSla: sin siglas internas', () => {
  assert.equal(describeSla({ metric: 'T_VIS', elapsedMinutes: 20, level: 'GREEN', label: '', subtext: '' }), 'En ruta hace 20 min');
  assert.equal(describeSla({ metric: 'T_ASIG', elapsedMinutes: 5, level: 'GREEN', label: '', subtext: '' }), 'Asignado hace 5 min');
  assert.equal(describeSla({ metric: 'CLOSED', elapsedMinutes: 0, level: 'GREEN', label: '', subtext: '' }), '');
});

test('Garantía: 30 días desde la validación; solo en servicios cerrados', () => {
  const now = new Date(2026, 9, 7).getTime();
  const validated = { toMillis: () => now - 10 * day };
  const active = getWarranty({ id: 'x', status: 'VALIDATED', validatedAt: validated }, now);
  assert.equal(active.active, true);
  assert.equal(active.label, 'Garantía vigente');
  const old = { toMillis: () => now - 40 * day };
  assert.equal(getWarranty({ id: 'x', status: 'VALIDATED', validatedAt: old }, now).label, 'Garantía vencida');
  assert.equal(getWarranty({ id: 'x', status: 'IN_PROGRESS', validatedAt: validated }, now), null);
});

test('Línea de tiempo: siete hitos en orden', () => {
  const steps = buildTimeline({ id: 'x', status: 'PENDING' });
  assert.equal(steps.length, 7);
  assert.equal(steps[0].key, 'created');
  assert.equal(steps[6].key, 'validated');
});

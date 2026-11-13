import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeDashboardStats, toMillis } from '../src/utils/dashboardStats.ts';

const NOW = new Date(2026, 9, 7, 15, 30).getTime(); // 7 oct 2026, 15:30 hora local
const at = (h, d = 7) => ({ toMillis: () => new Date(2026, 9, d, h, 0).getTime() });

const sample = [
  { id: '1', status: 'PENDING_ASSIGNMENT' },
  { id: '2', status: 'REQUIRES_REASSIGNMENT' },
  { id: '3', status: 'QUOTED' },
  { id: '4', status: 'PENDING' },
  { id: '5', status: 'ACCEPTED' },
  { id: '6', status: 'ACCEPTED' },
  { id: '7', status: 'IN_PROGRESS' },
  { id: '8', status: 'COMPLETED', finishedAt: at(9) },
  { id: '9', status: 'VALIDATED', validatedAt: at(11) },
  { id: '10', status: 'COMPLETED', finishedAt: at(10, 6) },
  { id: '11', status: 'CANCELLED_BY_CLIENT' },
];

test('Stats: separa por asignar, en ruta, en ejecución y concluidas', () => {
  const s = computeDashboardStats(sample, NOW);
  assert.equal(s.total, 11);
  assert.equal(s.toAssign, 2, 'PENDING_ASSIGNMENT + REQUIRES_REASSIGNMENT');
  assert.equal(s.reassign, 1);
  assert.equal(s.pending, 3, 'incluye cotizadas');
  assert.equal(s.inTransit, 2);
  assert.equal(s.executing, 1);
  assert.equal(s.inProgress, 4, 'PENDING + ACCEPTED + IN_PROGRESS');
  assert.equal(s.completed, 3);
});

test('Stats: "concluidas hoy" solo cuenta el día local actual', () => {
  const s = computeDashboardStats(sample, NOW);
  assert.equal(s.completedToday, 2, 'la del día 6 no cuenta');
});

test('Stats: activas excluye concluidas y canceladas', () => {
  assert.equal(computeDashboardStats(sample, NOW).active, 7);
});

test('Stats: bandeja vacía no divide por cero', () => {
  const s = computeDashboardStats([], NOW);
  assert.equal(s.total, 0);
  assert.equal(s.completionRate, '0');
  assert.equal(s.auditRate, '0');
});

test('toMillis: acepta Timestamp, segundos, Date y rechaza basura', () => {
  assert.equal(toMillis({ seconds: 10 }), 10000);
  assert.equal(toMillis(new Date(5000)), 5000);
  assert.equal(toMillis({ toMillis: () => 7 }), 7);
  assert.equal(toMillis(null), null);
  assert.equal(toMillis('no-es-fecha'), null);
});

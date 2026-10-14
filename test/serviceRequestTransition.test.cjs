const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

function loadModule() {
  const source = fs.readFileSync('src/domain/serviceRequestTransition.ts', 'utf8');
  const context = {
    exports: {},
    require: (name) => {
      if (name === 'firebase/firestore') {
        return {
          collection: (_db, ...segments) => ({ type: 'collection', path: segments.join('/') }),
          doc: (_dbOrCol, ...segments) => ({ type: 'doc', path: segments.join('/') }),
          serverTimestamp: () => ({ _methodName: 'serverTimestamp' }),
          writeBatch: (_db) => ({
            update: (ref, fields) => { context._batchUpdates.push({ ref, fields }); },
            set: (ref, fields) => { context._batchSets.push({ ref, fields }); },
            commit: async () => {},
          }),
        };
      }
      return {};
    },
    _batchUpdates: [],
    _batchSets: [],
  };
  const transpiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  vm.runInNewContext(transpiled, context);
  return { ...context.exports, context };
}

test('getAutomaticTransitionFields assigns timestamps according to canonical contract', () => {
  const { getAutomaticTransitionFields } = loadModule();

  const quoted = getAutomaticTransitionFields('QUOTED');
  assert.equal(quoted.status, 'QUOTED');
  assert.ok(quoted.firstResponseAt);
  assert.ok(quoted.quotedAt);

  const pending = getAutomaticTransitionFields('PENDING');
  assert.equal(pending.status, 'PENDING');
  assert.ok(pending.assignedAt);

  const accepted = getAutomaticTransitionFields('ACCEPTED');
  assert.equal(accepted.status, 'ACCEPTED');
  assert.ok(accepted.acceptedAt);

  const inProgress = getAutomaticTransitionFields('IN_PROGRESS');
  assert.equal(inProgress.status, 'IN_PROGRESS');
  assert.ok(inProgress.startedAt);
  assert.ok(inProgress.pinValidatedAt);
  assert.equal(inProgress.serviceStarted, true);

  const completed = getAutomaticTransitionFields('COMPLETED');
  assert.equal(completed.status, 'COMPLETED');
  assert.ok(completed.finishedAt);

  const validated = getAutomaticTransitionFields('VALIDATED');
  assert.equal(validated.status, 'VALIDATED');
  assert.ok(validated.validatedAt);

  const cancelled = getAutomaticTransitionFields('CANCELLED_BY_CLIENT');
  assert.equal(cancelled.status, 'CANCELLED_BY_CLIENT');
  assert.ok(cancelled.cancelledAt);
});

test('applyTransitionToBatch records audit entry in status_history and updates request', () => {
  const { applyTransitionToBatch, context } = loadModule();
  const batch = {
    update: (ref, fields) => context._batchUpdates.push({ ref, fields }),
    set: (ref, fields) => context._batchSets.push({ ref, fields }),
  };

  const actor = { uid: 'worker-101', role: 'PROVIDER' };
  applyTransitionToBatch(batch, {}, 'req-abc', 'ACCEPTED', actor, {
    fromStatus: 'PENDING',
    notes: 'Aceptado por técnico',
  });

  assert.equal(context._batchUpdates.length, 1);
  assert.equal(context._batchUpdates[0].fields.status, 'ACCEPTED');
  assert.ok(context._batchUpdates[0].fields.acceptedAt);

  assert.equal(context._batchSets.length, 1);
  assert.equal(context._batchSets[0].fields.fromStatus, 'PENDING');
  assert.equal(context._batchSets[0].fields.toStatus, 'ACCEPTED');
  assert.equal(context._batchSets[0].fields.actorId, 'worker-101');
  assert.equal(context._batchSets[0].fields.actorRole, 'PROVIDER');
  assert.equal(context._batchSets[0].fields.notes, 'Aceptado por técnico');
});

test('createInitialStatusHistoryRecord creates root PENDING_ASSIGNMENT audit record', () => {
  const { createInitialStatusHistoryRecord, context } = loadModule();
  const batch = {
    set: (ref, fields) => context._batchSets.push({ ref, fields }),
  };

  const actor = { uid: 'client-55', role: 'CLIENT' };
  createInitialStatusHistoryRecord(batch, {}, 'req-001', actor, 'Creación inicial');

  assert.equal(context._batchSets.length, 1);
  assert.equal(context._batchSets[0].fields.fromStatus, null);
  assert.equal(context._batchSets[0].fields.toStatus, 'PENDING_ASSIGNMENT');
  assert.equal(context._batchSets[0].fields.actorId, 'client-55');
  assert.equal(context._batchSets[0].fields.actorRole, 'CLIENT');
  assert.equal(context._batchSets[0].fields.notes, 'Creación inicial');
});

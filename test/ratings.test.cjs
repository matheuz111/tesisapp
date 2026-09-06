const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const context = {
  exports: {},
  require: (id) => {
    if (id === 'firebase/firestore') {
      return {
        doc: (db, coll, id) => ({ path: `${coll}/${id}` }),
        increment: (val) => ({ _type: 'increment', val }),
        serverTimestamp: () => ({ _type: 'serverTimestamp' }),
        writeBatch: () => ({
          update: (ref, data) => {},
          commit: async () => {},
        }),
      };
    }
    if (id === '../config/firebase') {
      return { db: {} };
    }
    if (id === './async') {
      return { withTimeout: (promise) => promise };
    }
    throw new Error(`Mock not found for module: ${id}`);
  },
};

vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/services/ratings.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  context
);

const { validateRating, sanitizeReviewComment, submitServiceRating, MAX_REVIEW_COMMENT_LENGTH } = context.exports;

test('validateRating accepts integers from 1 to 5', () => {
  for (let r = 1; r <= 5; r++) {
    assert.equal(validateRating(r), true);
  }
});

test('validateRating rejects out-of-range, decimals, strings and invalid types', () => {
  for (const invalid of [0, 6, -1, 3.5, 4.2, NaN, Infinity, '5', null, undefined, {}, []]) {
    assert.equal(validateRating(invalid), false);
  }
});

test('sanitizeReviewComment trims and handles empty or whitespace input', () => {
  assert.equal(sanitizeReviewComment('   Buen servicio   '), 'Buen servicio');
  assert.equal(sanitizeReviewComment(''), null);
  assert.equal(sanitizeReviewComment('    '), null);
  assert.equal(sanitizeReviewComment(null), null);
  assert.equal(sanitizeReviewComment(undefined), null);
});

test('sanitizeReviewComment caps length at MAX_REVIEW_COMMENT_LENGTH (300 chars)', () => {
  const longText = 'a'.repeat(350);
  const sanitized = sanitizeReviewComment(longText);
  assert.equal(sanitized?.length, MAX_REVIEW_COMMENT_LENGTH);
  assert.equal(sanitized, 'a'.repeat(300));
});

test('submitServiceRating throws on invalid requestId or rating', async () => {
  await assert.rejects(
    async () => submitServiceRating({ requestId: '', rating: 5 }),
    /Identificador de servicio inválido/
  );
  await assert.rejects(
    async () => submitServiceRating({ requestId: 'req-123', rating: 0 }),
    /La calificación debe ser un número entero entre 1 y 5/
  );
  await assert.rejects(
    async () => submitServiceRating({ requestId: 'req-123', rating: 6 }),
    /La calificación debe ser un número entero entre 1 y 5/
  );
});

test('submitServiceRating creates batch with request and provider updates', async () => {
  let batchCommitted = false;
  const updates = [];

  const testContext = {
    exports: {},
    require: (id) => {
      if (id === 'firebase/firestore') {
        return {
          doc: (db, coll, id) => ({ path: `${coll}/${id}` }),
          increment: (val) => ({ _type: 'increment', val }),
          serverTimestamp: () => ({ _type: 'serverTimestamp' }),
          writeBatch: () => ({
            update: (ref, data) => {
              updates.push({ ref, data });
            },
            commit: async () => {
              batchCommitted = true;
            },
          }),
        };
      }
      if (id === '../config/firebase') return { db: {} };
      if (id === './async') return { withTimeout: (promise) => promise };
      throw new Error(`Mock not found: ${id}`);
    },
  };

  vm.runInNewContext(
    ts.transpileModule(fs.readFileSync('src/services/ratings.ts', 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS },
    }).outputText,
    testContext
  );

  await testContext.exports.submitServiceRating({
    requestId: 'req-abc',
    providerId: 'prov-xyz',
    rating: 5,
    comment: '  Excelente trabajo!  ',
  });

  assert.equal(batchCommitted, true);
  assert.equal(updates.length, 2);

  // Verificación del documento del servicio
  assert.equal(updates[0].ref.path, 'service_requests/req-abc');
  assert.equal(updates[0].data.rating_given, 5);
  assert.equal(updates[0].data.review_comment, 'Excelente trabajo!');

  // Verificación del documento del técnico (únicamente llaves permitidas por firestore.rules)
  assert.equal(updates[1].ref.path, 'users/prov-xyz');
  assert.deepEqual(Object.keys(updates[1].data).sort(), ['review_count', 'total_rating']);
  assert.equal(updates[1].data.total_rating._type, 'increment');
  assert.equal(updates[1].data.total_rating.val, 5);
  assert.equal(updates[1].data.review_count._type, 'increment');
  assert.equal(updates[1].data.review_count.val, 1);
});

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const updates = [];

const context = {
  exports: {},
  require: (id) => {
    if (id === 'firebase/firestore') {
      return {
        doc: (db, coll, id) => ({ path: `${coll}/${id}` }),
        serverTimestamp: () => ({ _type: 'serverTimestamp' }),
        updateDoc: async (ref, data) => {
          updates.push({ ref, data });
        },
      };
    }
    if (id === '../config/firebase') return { db: {} };
    if (id === './async') return { withTimeout: (promise) => promise };
    throw new Error(`Mock not found: ${id}`);
  },
};

vm.runInNewContext(
  ts.transpileModule(fs.readFileSync('src/services/payment.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  context
);

const { isValidPaymentMethod, submitClientPayment, confirmProviderPayment, PAYMENT_METHODS } = context.exports;

test('isValidPaymentMethod recognizes valid methods and rejects invalid', () => {
  for (const method of ['YAPE', 'PLIN', 'CASH', 'TRANSFER']) {
    assert.equal(isValidPaymentMethod(method), true);
  }
  for (const invalid of ['BITCOIN', 'CREDIT_CARD', '', null, undefined, 123]) {
    assert.equal(isValidPaymentMethod(invalid), false);
  }
});

test('submitClientPayment throws on empty requestId or invalid method', async () => {
  await assert.rejects(
    async () => submitClientPayment({ requestId: '', method: 'YAPE' }),
    /Identificador de servicio inválido/
  );
  await assert.rejects(
    async () => submitClientPayment({ requestId: 'req-1', method: 'UNKNOWN' }),
    /Método de pago no reconocido/
  );
});

test('submitClientPayment updates document with paymentStatus PAID and voucher', async () => {
  updates.length = 0;
  await submitClientPayment({
    requestId: 'req-payment-1',
    method: 'YAPE',
    voucherPhoto: 'https://storage/voucher.jpg',
  });

  assert.equal(updates.length, 1);
  assert.equal(updates[0].ref.path, 'service_requests/req-payment-1');
  assert.equal(updates[0].data.paymentStatus, 'PAID');
  assert.equal(updates[0].data.paymentMethod, 'YAPE');
  assert.equal(updates[0].data.paymentVoucher, 'https://storage/voucher.jpg');
  assert.equal(updates[0].data.paidAt._type, 'serverTimestamp');
});

test('confirmProviderPayment updates document with paymentStatus CONFIRMED', async () => {
  updates.length = 0;
  await confirmProviderPayment('req-payment-2');

  assert.equal(updates.length, 1);
  assert.equal(updates[0].ref.path, 'service_requests/req-payment-2');
  assert.equal(updates[0].data.paymentStatus, 'CONFIRMED');
  assert.equal(updates[0].data.paymentConfirmedByProvider, true);
  assert.equal(updates[0].data.paymentConfirmedAt._type, 'serverTimestamp');
});

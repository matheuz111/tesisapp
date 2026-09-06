const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const context = { exports: {}, setTimeout, clearTimeout, Date, Promise };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('src/services/locationPublisher.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText, context);
const { createLocationPublisher } = context.exports;
const tick = () => new Promise((resolve) => setImmediate(resolve));

test('offline GPS writes stay bounded after timeout and recover after confirmation', async () => {
  let resolve;
  let writes = 0;
  const states = [];
  const publisher = createLocationPublisher(() => { writes++; return new Promise((done) => { resolve = done; }); },
    (state) => states.push(state), { timeoutMs: 10, intervalMs: 0 });
  publisher.publish();
  await new Promise((done) => setTimeout(done, 25));
  for (let index = 0; index < 100; index++) publisher.publish();
  assert.equal(writes, 1);
  assert.deepEqual(states, ['waiting']);
  resolve();
  await tick();
  assert.deepEqual(states, ['waiting', 'confirmed']);
  publisher.publish();
  await tick();
  assert.equal(writes, 2);
  publisher.dispose();
  resolve();
});

test('logout/dispose ignores late updates and rejects subsequent publication', async () => {
  let resolve;
  let writes = 0;
  const states = [];
  const publisher = createLocationPublisher(() => { writes++; return new Promise((done) => { resolve = done; }); },
    (state) => states.push(state), { timeoutMs: 10, intervalMs: 0 });
  publisher.publish();
  await tick();
  publisher.dispose();
  resolve();
  await tick();
  publisher.publish();
  assert.equal(writes, 1);
  assert.deepEqual(states, []);
});

test('GPS publication throttles frequent samples and recovers after a failed write', async () => {
  let time = 0;
  let writes = 0;
  const states = [];
  const publisher = createLocationPublisher(async () => { if (++writes === 1) throw new Error('Permission'); },
    (state) => states.push(state), { now: () => time });
  publisher.publish();
  await tick();
  time = 9999;
  publisher.publish();
  assert.equal(writes, 1);
  time = 10000;
  publisher.publish();
  await tick();
  assert.equal(writes, 2);
  assert.deepEqual(states, ['failed', 'confirmed']);
  publisher.dispose();
});

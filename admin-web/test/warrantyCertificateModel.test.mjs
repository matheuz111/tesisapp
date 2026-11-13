import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  buildVerifyUrl,
  formatCertificateCode,
  generateCertificateCode,
  isValidCertificateCode,
  maskName,
  normalizeCertificateCode,
  resolveCertificateState,
  scanDocId,
  utcDayKey,
} from '../src/services/warrantyCertificateModel.ts';

test('Código: 16 caracteres válidos, sin símbolos ambiguos y distintos entre sí', () => {
  const seen = new Set();
  for (let i = 0; i < 500; i++) {
    const code = generateCertificateCode();
    assert.equal(code.length, 16);
    assert.ok(isValidCertificateCode(code), code);
    assert.doesNotMatch(code, /[01ILOU]/);
    seen.add(code);
  }
  assert.equal(seen.size, 500, 'sin repeticiones');
});

test('Código: descarta bytes que sesgarían la distribución', () => {
  // Los bytes ≥ 240 se rechazan; con un generador que solo da 255 y luego 0 se debe seguir produciendo un código válido.
  let call = 0;
  const code = generateCertificateCode((length) => new Uint8Array(length).fill(call++ === 0 ? 255 : 0));
  assert.equal(code, 'A'.repeat(16));
});

test('Código: se normaliza lo que escribe una persona', () => {
  const code = generateCertificateCode();
  const spaced = formatCertificateCode(code).toLowerCase();
  assert.equal(normalizeCertificateCode(spaced), code);
  assert.equal(normalizeCertificateCode(code), code);
  assert.equal(normalizeCertificateCode('SOL-POST-0009'), null);
  assert.equal(normalizeCertificateCode('ABC'), null);
});

test('Código: formato visible GAR-XXXX-XXXX-XXXX-XXXX', () => {
  assert.equal(formatCertificateCode('ABCDEFGHJKMNPQRS'), 'GAR-ABCD-EFGH-JKMN-PQRS');
});

test('Nombre: se enmascara sin revelar el apellido completo', () => {
  assert.equal(maskName('Rosa Quispe'), 'Ros*** Qui***');
  assert.equal(maskName('jonathanrujel4'), 'jon***');
  assert.equal(maskName('Ana de la Cruz'), 'Ana*** d* l* Cru***');
  assert.equal(maskName(''), 'Cliente');
  assert.equal(maskName(undefined), 'Cliente');
});

test('URL de verificación: sin barras duplicadas', () => {
  assert.equal(buildVerifyUrl('https://x.web.app/', 'ABC'), 'https://x.web.app/verificar/ABC');
  assert.equal(buildVerifyUrl('https://x.web.app', 'ABC'), 'https://x.web.app/verificar/ABC');
});

test('Estado: anulado manda sobre vencido, y el vencimiento sale de la fecha', () => {
  const now = Date.UTC(2026, 10, 12);
  assert.equal(resolveCertificateState({ status: 'ACTIVE', validUntil: now + 1000 }, now), 'ACTIVE');
  assert.equal(resolveCertificateState({ status: 'ACTIVE', validUntil: now - 1000 }, now), 'EXPIRED');
  assert.equal(resolveCertificateState({ status: 'REVOKED', validUntil: now + 1000 }, now), 'REVOKED');
  assert.equal(resolveCertificateState({ status: 'REVOKED', validUntil: now - 1000 }, now), 'REVOKED');
});

test('Escaneos: un documento por certificado y día UTC', () => {
  const day = new Date(Date.UTC(2026, 10, 12, 23, 59));
  assert.equal(utcDayKey(day), '20261112');
  assert.equal(scanDocId('ABCDEFGHJKMNPQRS', day), 'ABCDEFGHJKMNPQRS_20261112');
  assert.equal(scanDocId('ABCDEFGHJKMNPQRS', addDays(day, 1)), 'ABCDEFGHJKMNPQRS_20261113');
});

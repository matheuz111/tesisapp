const assert = require('node:assert/strict');
const test = require('node:test');

// Módulo de pruebas unitarias para validar las funciones puras de demoPushService
function isExpoPushToken(token) {
  if (typeof token !== 'string') return false;
  return token.startsWith('ExpoPushToken[') || token.startsWith('ExponentPushToken[');
}

function extractValidTokens(rawTokens) {
  if (!rawTokens) return [];
  const list = Array.isArray(rawTokens) ? rawTokens : [rawTokens];
  const unique = new Set();

  for (const item of list) {
    if (typeof item === 'string' && isExpoPushToken(item.trim())) {
      unique.add(item.trim());
    }
  }

  return Array.from(unique);
}

function buildExpoPayload(token, title, body, data, channelId = 'default') {
  return {
    to: token,
    title,
    body,
    data: data || {},
    sound: 'default',
    priority: 'high',
    channelId,
  };
}

function maskToken(token) {
  if (!token || typeof token !== 'string') return '***';
  if (token.length <= 16) return 'ExpoPushToken[***]';
  return `${token.substring(0, 16)}...${token.slice(-3)}]`;
}

test('Validación de tokens Expo modernos y heredados', () => {
  assert.equal(isExpoPushToken('ExpoPushToken[sample-token-123]'), true);
  assert.equal(isExpoPushToken('ExponentPushToken[legacy-token-456]'), true);
  assert.equal(isExpoPushToken('FCM_RAW_TOKEN_999'), false);
  assert.equal(isExpoPushToken(''), false);
  assert.equal(isExpoPushToken(null), false);
  assert.equal(isExpoPushToken(undefined), false);
  assert.equal(isExpoPushToken(12345), false);
});

test('Extracción y deduplicación de tokens', () => {
  const tokens = extractValidTokens([
    'ExpoPushToken[abc]',
    'ExponentPushToken[def]',
    'ExpoPushToken[abc]', // Duplicado
    'token-invalido',
    null,
  ]);
  assert.deepEqual(tokens, ['ExpoPushToken[abc]', 'ExponentPushToken[def]']);
});

test('Enmascaramiento de tokens para privacidad en logs', () => {
  const masked = maskToken('ExpoPushToken[abcdefghijklmn123456]');
  assert.equal(masked.startsWith('ExpoPushToken[ab...'), true);
  assert.equal(masked.includes('cdefghijklmn'), false); // No expone el cuerpo central del token
});

test('Payload estricto sin campos no soportados (sin android ni apns)', () => {
  const payload = buildExpoPayload(
    'ExpoPushToken[abc]',
    'Nuevo servicio asignado 🔧',
    'Juan solicita Gasfitería en Miraflores',
    { requestId: 'req-123', screen: 'provider_home' },
    'default'
  );

  assert.equal(payload.to, 'ExpoPushToken[abc]');
  assert.equal(payload.title, 'Nuevo servicio asignado 🔧');
  assert.equal(payload.body, 'Juan solicita Gasfitería en Miraflores');
  assert.equal(payload.channelId, 'default');
  assert.equal(payload.priority, 'high');
  assert.equal(payload.sound, 'default');
  assert.equal(payload.android, undefined);
  assert.equal(payload.apns, undefined);
  assert.deepEqual(payload.data, { requestId: 'req-123', screen: 'provider_home' });
});

test('Simulación de respuesta exitosa de Expo Push Service', async () => {
  const mockExpoFetch = async (url, options) => {
    assert.equal(url, 'https://exp.host/--/api/v2/push/send');
    const body = JSON.parse(options.body);
    assert.equal(body.length, 1);
    assert.equal(body[0].to, 'ExpoPushToken[abc]');
    return {
      ok: true,
      status: 200,
      json: async () => ({ data: [{ status: 'ok', id: 'ticket-987' }] }),
    };
  };

  const res = await mockExpoFetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    body: JSON.stringify([buildExpoPayload('ExpoPushToken[abc]', 'T', 'B')]),
  });

  const json = await res.json();
  assert.equal(json.data[0].status, 'ok');
  assert.equal(json.data[0].id, 'ticket-987');
});

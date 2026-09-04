const assert = require("node:assert/strict");
const test = require("node:test");
const {
  createMessage,
  getUserPushTokens,
  isExpoPushToken,
  sendExpoNotifications,
} = require("./push");

test("acepta tokens Expo actuales y heredados", () => {
  assert.equal(isExpoPushToken("ExpoPushToken[current-token]"), true);
  assert.equal(isExpoPushToken("ExponentPushToken[legacy-token]"), true);
  assert.equal(isExpoPushToken("invalid-token"), false);
});

test("combina y deduplica tokens de un usuario", () => {
  assert.deepEqual(
    getUserPushTokens({
      tokens: ["ExpoPushToken[private]"],
      expoPushTokens: ["ExpoPushToken[one]", "invalid"],
      expoPushToken: "ExpoPushToken[one]",
      pushToken: "ExponentPushToken[two]",
    }),
    ["ExpoPushToken[private]", "ExpoPushToken[one]", "ExponentPushToken[two]"]
  );
});

test("genera únicamente campos soportados por Expo Push API", () => {
  const message = createMessage(
    "ExpoPushToken[one]",
    "Título",
    "Contenido",
    {requestId: "request-1"},
    "default"
  );

  assert.equal(message.android, undefined);
  assert.equal(message.apns, undefined);
  assert.equal(message.channelId, "default");
  assert.equal(message.priority, "high");
});

test("envía un lote válido y devuelve tickets", async () => {
  let sentBody;
  const fetchImpl = async (_url, request) => {
    sentBody = JSON.parse(request.body);
    return {
      ok: true,
      status: 200,
      json: async () => ({data: [{status: "ok", id: "ticket-1"}]}),
    };
  };

  const result = await sendExpoNotifications(
    ["ExpoPushToken[one]"],
    "Título",
    "Contenido",
    {},
    {fetchImpl}
  );

  assert.equal(sentBody.length, 1);
  assert.equal(sentBody[0].to, "ExpoPushToken[one]");
  assert.deepEqual(result, [{status: "ok", id: "ticket-1"}]);
});

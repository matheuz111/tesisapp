const fetch = require("node-fetch");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const MAX_MESSAGES_PER_REQUEST = 100;
const EXPO_TOKEN_PATTERN = /^(?:Expo|Exponent)PushToken\[[^\]]+\]$/;

function isExpoPushToken(token) {
  return typeof token === "string" && EXPO_TOKEN_PATTERN.test(token);
}

function getUserPushTokens(userData = {}) {
  const candidates = [
    ...(Array.isArray(userData.tokens) ? userData.tokens : []),
    ...(Array.isArray(userData.expoPushTokens) ? userData.expoPushTokens : []),
    userData.expoPushToken,
    userData.pushToken,
  ];

  return [...new Set(candidates.filter(isExpoPushToken))];
}

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function createMessage(token, title, body, data, channelId) {
  return {
    to: token,
    sound: "default",
    title,
    body,
    data,
    priority: "high",
    channelId,
    ttl: 3600,
  };
}

async function sendExpoNotifications(tokens, title, body, data = {}, options = {}) {
  const validTokens = [...new Set(tokens.filter(isExpoPushToken))];
  if (validTokens.length === 0) {
    console.warn("No hay Expo Push Tokens válidos para enviar la notificación.");
    return [];
  }

  const fetchImpl = options.fetchImpl || fetch;
  const accessToken = options.accessToken || process.env.EXPO_ACCESS_TOKEN;
  const channelId = options.channelId || "default";
  const tickets = [];

  for (const tokenChunk of chunk(validTokens, MAX_MESSAGES_PER_REQUEST)) {
    const messages = tokenChunk.map((token) =>
      createMessage(token, title, body, data, channelId)
    );
    const headers = {
      Accept: "application/json",
      "Accept-Encoding": "gzip, deflate",
      "Content-Type": "application/json",
    };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const response = await fetchImpl(EXPO_PUSH_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(messages),
      timeout: 10000,
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(`Expo Push API respondió ${response.status}: ${JSON.stringify(result)}`);
    }

    const batchTickets = Array.isArray(result.data) ? result.data : [result.data];
    batchTickets.forEach((ticket, index) => {
      if (ticket?.status === "error") {
        console.error("Expo rechazó una notificación", {
          tokenSuffix: tokenChunk[index]?.slice(-12),
          message: ticket.message,
          error: ticket.details?.error,
        });
      }
    });
    tickets.push(...batchTickets);
  }

  return tickets;
}

module.exports = {
  createMessage,
  getUserPushTokens,
  isExpoPushToken,
  sendExpoNotifications,
};

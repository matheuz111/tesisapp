// ═══════════════════════════════════════════════════════════════════
//  CLOUD FUNCTIONS — TesisApp Push Notifications
//  Proyecto: tesis-servicios
//
//  Estas funciones se ejecutan en los servidores de Firebase,
//  garantizando entrega de notificaciones independientemente de
//  si la app del cliente o del proveedor está abierta.
// ═══════════════════════════════════════════════════════════════════

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch");

admin.initializeApp();
const db = admin.firestore();

// ────────────────────────────────────────────────────────────────
// HELPER: Enviar push via Expo Push API
// ────────────────────────────────────────────────────────────────
async function sendExpoNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken || !expoPushToken.startsWith("ExponentPushToken[")) {
    console.log("Token inválido o faltante:", expoPushToken);
    return null;
  }

  const message = {
    to: expoPushToken,
    sound: "default",
    title,
    body,
    data,
    priority: "high",
    channelId: "default",
    ttl: 3600,
    android: {
      priority: "high",
      sound: "default",
      channelId: "default",
    },
    apns: {
      payload: {
        aps: {
          "content-available": 1,
          sound: "default",
        },
      },
      headers: {
        "apns-priority": "10",
      },
    },
  };

  try {
    const response = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });
    const result = await response.json();
    console.log(`Push enviado a token ${expoPushToken.substring(0, 30)}...:`, JSON.stringify(result));
    return result;
  } catch (error) {
    console.error("Error enviando push:", error);
    return null;
  }
}

// ────────────────────────────────────────────────────────────────
// FUNCIÓN 1: Se dispara cuando se crea una NUEVA solicitud (PENDING)
// → Notifica al PROVEEDOR
// ────────────────────────────────────────────────────────────────
exports.onNewServiceRequest = functions.firestore
  .document("service_requests/{requestId}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const requestId = context.params.requestId;

    // Solo procesar solicitudes PENDING
    if (data.status !== "PENDING") {
      console.log(`Request ${requestId} creada con status ${data.status}, ignorando.`);
      return null;
    }

    const providerId = data.providerId;
    if (!providerId) {
      console.log("No hay providerId en la solicitud:", requestId);
      return null;
    }

    // Obtener el push token del proveedor
    const providerDoc = await db.collection("users").doc(providerId).get();
    if (!providerDoc.exists) {
      console.log("Proveedor no encontrado:", providerId);
      return null;
    }

    const providerData = providerDoc.data();
    const expoPushToken = providerData.expoPushToken;
    const clientName = data.clientName || "Un cliente";
    const serviceType = data.serviceType || "servicio";

    console.log(`Nueva solicitud ${requestId} → notificando a proveedor ${providerId}`);

    return sendExpoNotification(
      expoPushToken,
      "¡NUEVA SOLICITUD! 🚨",
      `${clientName} necesita tus servicios. Abre la app para aceptar.`,
      {
        screen: "provider_home",
        requestId,
        type: "NEW_REQUEST",
      }
    );
  });

// ────────────────────────────────────────────────────────────────
// FUNCIÓN 2: Se dispara cuando cambia el STATUS de una solicitud
// → Notifica al CLIENTE según el nuevo estado
// ────────────────────────────────────────────────────────────────
exports.onRequestStatusChange = functions.firestore
  .document("service_requests/{requestId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();
    const requestId = context.params.requestId;

    // Si el status no cambió, no hacer nada
    if (before.status === after.status) {
      return null;
    }

    console.log(`Request ${requestId}: ${before.status} → ${after.status}`);

    const clientId = after.clientId;
    const providerId = after.providerId;
    const providerName = after.providerName || "El técnico";
    const clientName = after.clientName || "El cliente";

    // Obtener tokens según a quién hay que notificar
    let targetUserId = null;
    let title = "";
    let body = "";
    let notifData = { requestId, screen: "client_home" };

    switch (after.status) {
      // Proveedor aceptó → notificar al CLIENTE
      case "ACCEPTED":
        targetUserId = clientId;
        title = "¡TÉCNICO EN CAMINO! 🚀";
        body = `${providerName} ha aceptado tu solicitud y va en camino.`;
        notifData = { requestId, screen: "client_home", type: "ACCEPTED" };
        break;

      // Proveedor rechazó → notificar al CLIENTE
      case "CANCELLED_BY_PROVIDER":
        targetUserId = clientId;
        title = "Solicitud Rechazada 😔";
        body = "El técnico no está disponible. Intenta con otro profesional.";
        notifData = { requestId, screen: "client_home", type: "CANCELLED_BY_PROVIDER" };
        break;

      // Cliente canceló → notificar al PROVEEDOR
      case "CANCELLED_BY_CLIENT":
        targetUserId = providerId;
        title = "Solicitud Cancelada";
        body = `${clientName} ha cancelado la solicitud.`;
        notifData = { requestId, screen: "provider_home", type: "CANCELLED_BY_CLIENT" };
        break;

      // Proveedor completó el trabajo → notificar al CLIENTE
      case "COMPLETED":
        targetUserId = clientId;
        title = "¡Trabajo Culminado! 🎉";
        body = `${providerName} ha completado el trabajo. Entra a calificar.`;
        notifData = { requestId, screen: "client_home", type: "COMPLETED" };
        break;

      default:
        console.log(`Status ${after.status} no requiere push notification.`);
        return null;
    }

    if (!targetUserId) {
      console.log("No hay targetUserId para notificar.");
      return null;
    }

    // Obtener el push token del usuario objetivo
    const userDoc = await db.collection("users").doc(targetUserId).get();
    if (!userDoc.exists) {
      console.log("Usuario objetivo no encontrado:", targetUserId);
      return null;
    }

    const expoPushToken = userDoc.data().expoPushToken;
    return sendExpoNotification(expoPushToken, title, body, notifData);
  });

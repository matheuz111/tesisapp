// ═══════════════════════════════════════════════════════════════════
//  CLOUD FUNCTIONS — TesisApp Push Notifications
//  Proyecto: tesis-servicios
//
//  Estas funciones se ejecutan en los servidores de Firebase,
//  garantizando entrega de notificaciones independientemente de
//  si la app del cliente o del proveedor está abierta.
// ═══════════════════════════════════════════════════════════════════

// La ruta /v1 mantiene la API `firestore.document(...).onCreate/onUpdate`
// con firebase-functions v6 y evita una migración destructiva de los triggers.
const functions = require("firebase-functions/v1");
const admin = require("firebase-admin");
const {getUserPushTokens, sendExpoNotifications} = require("./push");

admin.initializeApp();
const db = admin.firestore();

// ────────────────────────────────────────────────────────────────
// HELPER: Enviar push a todos los dispositivos registrados del usuario
// ────────────────────────────────────────────────────────────────
async function notifyUser(userId, title, body, data = {}) {
  if (!userId) {
    console.warn("No se puede notificar: falta el id del usuario.");
    return [];
  }

  const [userDoc, tokenDoc] = await Promise.all([
    db.collection("users").doc(userId).get(),
    db.collection("push_tokens").doc(userId).get(),
  ]);
  if (!userDoc.exists) {
    console.warn("No se puede notificar: usuario no encontrado", userId);
    return [];
  }

  // Los campos del perfil son fallback temporal para instalaciones anteriores.
  const tokens = getUserPushTokens({
    ...userDoc.data(),
    ...(tokenDoc.exists ? tokenDoc.data() : {}),
  });
  if (tokens.length === 0) {
    console.warn("El usuario no tiene tokens push válidos", userId);
    return [];
  }

  const tickets = await sendExpoNotifications(tokens, title, body, data);
  console.log("Notificación entregada a Expo", {
    userId,
    devices: tokens.length,
    accepted: tickets.filter((ticket) => ticket?.status === "ok").length,
  });
  return tickets;
}

async function notifyOperators(title, body, data = {}) {
  const snapshot = await db.collection("users").where("role", "in", ["OPERATOR", "ADMIN"]).get();
  if (snapshot.empty) {
    console.warn("No hay operadores registrados para recibir la alerta.");
    return [];
  }
  return Promise.all(snapshot.docs.map((operator) => notifyUser(operator.id, title, body, data)));
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

    if (data.status === "PENDING_ASSIGNMENT") {
      const serviceType = data.serviceLabel || data.specialty || data.serviceType || "servicio";
      return notifyOperators(
        data.priority === "HIGH" ? "Solicitud urgente por asignar 🚨" : "Nueva solicitud por asignar",
        `${data.clientName || "Un cliente"} solicita ${serviceType} en ${data.district || "Lima"}.`,
        {screen: "operator_home", requestId, type: "PENDING_ASSIGNMENT"}
      );
    }

    // Compatibilidad con solicitudes creadas por la versión anterior.
    if (data.status !== "PENDING") {
      console.log(`Request ${requestId} creada con status ${data.status}, ignorando.`);
      return null;
    }

    const providerId = data.providerId;
    if (!providerId) {
      console.log("No hay providerId en la solicitud:", requestId);
      return null;
    }

    const clientName = data.clientName || "Un cliente";
    const serviceType = data.specialty || data.serviceType || "servicio";

    console.log(`Nueva solicitud ${requestId} → notificando a proveedor ${providerId}`);

    return notifyUser(
      providerId,
      "¡NUEVA SOLICITUD! 🚨",
      `${clientName} necesita un servicio de ${serviceType}. Abre la app para aceptar.`,
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

    if (after.status === "REQUIRES_REASSIGNMENT") {
      return notifyOperators(
        "Servicio requiere reasignación",
        `${providerName} no puede atender la solicitud de ${clientName}.`,
        {requestId, screen: "operator_home", type: "REQUIRES_REASSIGNMENT"}
      );
    }

    if (after.status === "PENDING" && before.status !== "PENDING") {
      return Promise.all([
        notifyUser(
          providerId,
          "Nuevo servicio asignado 🔧",
          `${clientName} solicita ${after.serviceLabel || after.specialty || "un servicio"} en ${after.district || "Lima"}.`,
          {requestId, screen: "provider_home", type: "ASSIGNED"}
        ),
        notifyUser(
          clientId,
          "Técnico seleccionado",
          `${providerName} fue asignado a tu solicitud. Estamos esperando su confirmación.`,
          {requestId, screen: "client_home", type: "PROVIDER_ASSIGNED"}
        ),
      ]);
    }

    switch (after.status) {
      // Proveedor aceptó → notificar al CLIENTE
      case "ACCEPTED":
        targetUserId = clientId;
        title = "¡TÉCNICO EN CAMINO! 🚀";
        body = `${providerName} ha aceptado tu solicitud y va en camino.`;
        notifData = { requestId, screen: "client_home", type: "ACCEPTED" };
        break;

      case "IN_PROGRESS":
        targetUserId = clientId;
        title = "Servicio iniciado 🛠️";
        body = `${providerName} validó el PIN e inició el trabajo.`;
        notifData = { requestId, screen: "client_home", type: "IN_PROGRESS" };
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

    if (after.status === "COMPLETED") {
      return Promise.all([
        notifyUser(targetUserId, title, body, notifData),
        notifyOperators(
          "Servicio pendiente de validación",
          `${providerName} registró la culminación del servicio de ${clientName}.`,
          {requestId, screen: "operator_home", type: "PENDING_VALIDATION"}
        ),
      ]);
    }

    return notifyUser(targetUserId, title, body, notifData);
  });

// ────────────────────────────────────────────────────────────────
// FUNCIÓN 3: Un mensaje nuevo notifica al otro participante.
// El envío se mantiene en backend para no exponer ni confiar en tokens ajenos.
// ────────────────────────────────────────────────────────────────
exports.onNewChatMessage = functions.firestore
  .document("service_requests/{requestId}/messages/{messageId}")
  .onCreate(async (snap, context) => {
    const message = snap.data();
    const requestId = context.params.requestId;
    const requestDoc = await db.collection("service_requests").doc(requestId).get();

    if (!requestDoc.exists) {
      console.warn("Solicitud del mensaje no encontrada", requestId);
      return null;
    }

    const request = requestDoc.data();
    const senderIsClient = message.senderId === request.clientId;
    const senderIsProvider = message.senderId === request.providerId;
    if (!senderIsClient && !senderIsProvider) {
      console.warn("El remitente no pertenece a la solicitud", {
        requestId,
        senderId: message.senderId,
      });
      return null;
    }

    const targetUserId = senderIsClient ? request.providerId : request.clientId;
    const senderName = senderIsClient
      ? request.clientName || "Cliente"
      : request.providerName || "Técnico";
    const preview = message.type === "image"
      ? "📷 Imagen"
      : String(message.text || "Nuevo mensaje").slice(0, 80);

    return notifyUser(targetUserId, `💬 ${senderName}`, preview, {
      screen: "chat",
      requestId,
      type: "NEW_MESSAGE",
    });
  });

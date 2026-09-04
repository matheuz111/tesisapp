# 🚀 Documentación Integral del Proyecto: TesisApp

Este documento resume la **arquitectura**, las **tecnologías utilizadas**, el **modelo de base de datos** y **todas las funcionalidades implementadas** en la aplicación móvil **TesisApp**.

---

## 📌 1. Visión General del Proyecto

**TesisApp** es una plataforma móvil *On-Demand* orientada a la contratación de servicios del hogar y asistencia técnica en tiempo real (Gasfitería, Electricidad, Limpieza, Albañilería, Pintura, Soporte Técnico PC, etc.). Conecta a **Clientes** que necesitan resolver una necesidad inmediata con **Proveedores/Técnicos** cercanos mediante geolocalización, sincronización en tiempo real, chat bidireccional y notificaciones push.

---

## 🛠️ 2. Stack Tecnológico

### 📱 Frontend Móvil
* **Framework Principal:** [React Native](https://reactnative.dev/) `0.81.5` con [React](https://react.dev/) `19.1.0`.
* **Plataforma & Tooling:** [Expo SDK](https://expo.dev/) `~54.0.33` (entorno administrado / prebuild con soporte Android e iOS).
* **Lenguaje:** [TypeScript](https://www.typescriptlang.org/) `~5.9.2` con tipado estricto.
* **Enrutamiento y Navegación:** [Expo Router](https://docs.expo.dev/router/introduction/) `~6.0.23` (Navegación declarativa basada en el sistema de archivos `app/`).
* **Navegación Base:** `@react-navigation/native` `^7.1.28`, `@react-navigation/bottom-tabs`, `@react-navigation/native-stack`.

### 🎨 Diseño, Estilos e Interfaz
* **Estilos:** `StyleSheet` nativo de React Native con soporte multi-tema (Dark Mode / Light Mode) mediante contexto global (`ThemeContext`).
* **Iconografía:** `@expo/vector-icons` (Ionicons).
* **Animaciones & Gestos:** `react-native-reanimated` `~4.1.1` y `react-native-gesture-handler` `~2.28.0`.
* **Notificaciones en Pantalla (Toast):** `react-native-toast-message` `^2.3.3`.
* **Área Segura & Renderizado:** `react-native-safe-area-context` y `react-native-screens`.
* **Respuesta Háptica:** `expo-haptics` (vibraciones táctiles al aceptar servicios o presionar botones clave).

### 🗺️ Mapas, Geolocalización y Algoritmos Geoespaciales
* **Renderizado de Mapas:** `react-native-maps` `1.20.1` (con soporte para OpenStreetMap / Tiles y Google Maps).
* **Ubicación en Tiempo Real:** `expo-location` `~19.0.8`.
* **Cálculo de Distancias:** `geolib` `^3.3.4` (cálculo de distancias euclidianas / geodésicas en metros/km).
* **Indexación Geoespacial:** `geofire-common` `^6.0.0` (generación de GeoHashes para consultas espaciales).

### 📷 Hardware, Multimedia y Utilidades
* **Cámara:** `expo-camera` `~17.0.10` (captura de evidencia fotográfica del trabajo terminado).
* **Selector de Galería:** `expo-image-picker` `~17.0.10` (envío de imágenes en chat y fotos de perfil).
* **Imágenes Optimizadas:** `expo-image` `~3.0.11`.
* **Portapapeles:** `expo-clipboard` `~8.0.8` (copiado rápido de mensajes y direcciones).
* **Persistencia Local:** `@react-native-async-storage/async-storage` `2.2.0` (persistencia de sesión de Firebase y configuraciones locales).

---

## ☁️ 3. Backend, Base de Datos y Servicios Cloud (Firebase)

El backend opera bajo una arquitectura **Serverless & Event-Driven** basada en **Firebase (Google Cloud)**:

### A. Firebase Authentication
* **Método:** Autenticación por Correo Electrónico y Contraseña (`createUserWithEmailAndPassword`, `signInWithEmailAndPassword`).
* **Persistencia:** Integrada con `AsyncStorage` mediante `getReactNativePersistence` para mantener sesiones activas al reiniciar la app.
* **Control de Acceso por Roles (RBAC):** Redirección automática en el arranque (`app/index.tsx`) según el rol del usuario: `CLIENT` o `PROVIDER`.

### B. Cloud Firestore (Base de Datos NoSQL en Tiempo Real)
Base de datos documental reactiva mediante *listeners* `onSnapshot` para sincronización instantánea de solicitudes, chats y ubicaciones.

#### 🗄️ Colecciones Principales y Esquema de Datos:

1. **`users`** (Documento: `userId` = `auth.uid`)
   * `name`: Nombre y apellido del usuario.
   * `email`: Correo electrónico.
   * `phone`: Teléfono de contacto (9 dígitos - Perú).
   * `dni`: Documento Nacional de Identidad (8 dígitos).
   * `role`: `'CLIENT'` | `'PROVIDER'`.
   * `expoPushToken`: Token único de Expo para recepción de notificaciones remotas.
   * `createdAt`: Timestamp de registro en el servidor.
   * *(Campos exclusivos de Proveedores)*:
     * `specialty`: Especialidad técnica (Gasfitería, Electricidad, etc.).
     * `price`: Precio base estimado o tarifa por hora.
     * `isActive`: Booleano (conectado/disponible para recibir solicitudes).
     * `serviceRadius`: Radio de cobertura en kilómetros.
     * `location`: Objeto `GeoPoint` (latitud, longitud).
     * `geohash`: Hash geográfico para indexación espacial.
     * `rating`: Calificación acumulada o promedio (ej. `4.8`).
     * `reviewCount`: Cantidad de evaluaciones recibidas.
     * `jobsCompleted`: Contador total de trabajos culminados.

2. **`service_requests`** (Documento: `requestId`)
   * `clientId`: ID del cliente que solicita.
   * `clientName`: Nombre del cliente.
   * `clientPhone`: Teléfono del cliente.
   * `providerId`: ID del técnico asignado.
   * `providerName`: Nombre del técnico.
   * `serviceType`: Tipo de servicio solicitado.
   * `status`: Estado del servicio (`PENDING` ➔ `ACCEPTED` ➔ `IN_PROGRESS` ➔ `COMPLETED` | `CANCELLED_BY_CLIENT` | `CANCELLED_BY_PROVIDER`).
   * `clientLocation`: Objeto `{ latitude, longitude, address }`.
   * `providerLocation`: Objeto `{ latitude, longitude }`.
   * `securityPin`: Código PIN de 4 dígitos generado aleatoriamente para validar el inicio del servicio.
   * `price_agreed`: Precio acordado.
   * `evidencePhoto`: Foto en base64 o URL de evidencia tomada por el técnico.
   * `createdAt`: Timestamp de creación.
   * `acceptedAt`, `startedAt`, `completedAt`: Marcas de tiempo de cada etapa.
   * `rating`: Puntuación otorgada por el cliente al finalizar (1 a 5 estrellas).

3. **`service_requests/{requestId}/messages`** (Subcolección de Chat en Tiempo Real)
   * `senderId`: ID del usuario que emite el mensaje.
   * `text`: Contenido textual del mensaje.
   * `type`: `'text'` | `'image'`.
   * `mediaUrl`: Enlace o Base64 de la imagen adjunta.
   * `createdAt`: Timestamp del servidor.

### C. Firebase Cloud Functions (Node.js)
Ubicadas en `functions/index.js`, reaccionan a eventos en tiempo real en Firestore:
* **`onNewServiceRequest` (Trigger `onCreate`):**
  Detecta cuando un cliente genera una nueva solicitud en estado `PENDING` y envía inmediatamente una notificación Push de alta prioridad (`¡NUEVA SOLICITUD! 🚨`) al teléfono del técnico asignado.
* **`onRequestStatusChange` (Trigger `onUpdate`):**
  Detecta transiciones de estado en la solicitud y despacha las notificaciones push pertinentes:
  * De `PENDING` a `ACCEPTED` ➔ Notifica al cliente: *"¡TÉCNICO EN CAMINO! 🚀"*.
  * Cancelación por técnico ➔ Notifica al cliente: *"Solicitud Rechazada 😔"*.
  * Cancelación por cliente ➔ Notifica al técnico: *"Solicitud Cancelada"*.
  * `COMPLETED` ➔ Notifica al cliente: *"¡Trabajo Culminado! 🎉 Entra a calificar"*.

### D. Seguridad en Firestore (`firestore.rules`)
* Reglas configuradas para validar que cualquier operación de lectura o escritura requiera token de autenticación válido (`request.auth != null`).

---

## ⚙️ 4. Módulos y Funcionalidades Implementadas

```
                           ┌─────────────────────────┐
                           │      PANTALLA RAIZ      │
                           │     app/index.tsx       │
                           │  (Verificación de Rol)  │
                           └────────────┬────────────┘
                                        │
                   ┌────────────────────┴────────────────────┐
                   ▼                                         ▼
        ┌─────────────────────┐                   ┌─────────────────────┐
        │     ROL CLIENTE     │                   │    ROL PROVEEDOR    │
        └──────────┬──────────┘                   └──────────┬──────────┘
                   │                                         │
     ┌─────────────┼─────────────┐             ┌─────────────┼─────────────┐
     ▼             ▼             ▼             ▼             ▼             ▼
┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐   ┌─────────┐
│  Home   │   │Historial│   │ Perfil  │   │  Home   │   │Historial│   │ Perfil  │
│  Mapa   │   │Servicios│   │Ajustes/ │   │ Radar/  │   │Ganancias│   │Ajustes/ │
│Pedidos  │   │Anterior │   │  Tema   │   │Trabajo  │   │Trabajos │   │  Tema   │
└────┬────┘   └─────────┘   └─────────┘   └────┬────┘   └─────────┘   └─────────┘
     │                                         │
     └────────────────────┬────────────────────┘
                          ▼
              ┌───────────────────────┐
              │  CHAT EN TIEMPO REAL  │
              │   app/chat/[id].tsx   │
              │  Mensajes, Fotos,     │
              │  Typing, Llamadas     │
              └───────────────────────┘
```

### 1. Módulo de Autenticación (`app/auth/`)
* **Registro (`register.tsx`):**
  * Validación específica para Perú: **DNI de 8 dígitos** numéricos y **Teléfono de 9 dígitos** que empieza en `9`.
  * Validación de contraseñas robustas (mínimo 8 caracteres, mayúsculas, minúsculas, números y caracteres especiales).
  * Selector de rol con inicialización de perfil en Firestore.
* **Inicio de Sesión (`login.tsx`):**
  * Sanitización de correos (minúsculas, sin espacios).
  * Recuperación de contraseña mediante enlace de restablecimiento oficial de Firebase Auth.
  * Selector para alternar visibilidad de contraseña.

### 2. Módulo de Cliente (`app/client/`)
* **Pantalla Principal y Radar de Técnicos (`home.tsx`):**
  * Mapa con geolocalización GPS del cliente.
  * Marcadores dinámicos de técnicos disponibles en un radio configurable (5 km a 50 km).
  * Filtro interactivo por categorías de oficio.
  * Cálculo y visualización de distancias exactas hacia cada técnico.
  * Ficha de detalle del proveedor seleccionado con calificación por estrellas y precio.
  * Modal de confirmación de solicitud y aceptación de términos.
  * **Barra de estado persistente:** Seguimiento reactivo del estado de la solicitud (Buscando ➔ Aceptado ➔ En progreso ➔ Culminado).
  * **Sistema de Calificación:** Modal post-servicio para evaluar al técnico con estrellas, actualizando automáticamente el promedio del técnico en Firestore.
* **Historial de Servicios (`history.tsx`):**
  * Listado de todos los servicios solicitados con estado, fecha, monto acordado y nombre del técnico.
  * Opción de repetir solicitud rápida.

### 3. Módulo de Proveedor / Técnico (`app/provider/`)
* **Panel de Control y Modo Disponible (`home.tsx`):**
  * Interruptor de disponibilidad (`isActive`) que actualiza la posición GPS y activa/desactiva al técnico en el mapa de clientes.
  * Ajuste de radio de servicio (cobertura en km) y tarifa estimada.
  * Métricas de desempeño (Rating promedio, total de reseñas, trabajos completados).
  * **Alerta sonora y modal de solicitud entrante:** Muestra cliente, oficio, distancia en km y botones para Aceptar o Rechazar.
  * **Flujo de Trabajo Seguro:**
    * **Validación por Código PIN:** El cliente le proporciona un código PIN de 4 dígitos al técnico para que este lo ingrese y desbloquee el estado `IN_PROGRESS`.
    * **Cronómetro en vivo:** Tiempo transcurrido durante la ejecución de la tarea.
    * **Evidencia Fotográfica:** Apertura de la cámara nativa para capturar la foto del trabajo culminado antes de dar por finalizada la orden.
* **Historial y Ganancias (`history.tsx`):**
  * Balance de ingresos generados en el mes y servicios concluidos con éxito.

### 4. Módulo de Chat en Tiempo Real (`app/chat/[id].tsx`)
* Mensajería instantánea sincronizada mediante subcolección de Firestore.
* **Optimistic UI:** Los mensajes aparecen de inmediato en pantalla antes de confirmarse en el servidor.
* **Indicador de escritura en vivo:** Notifica cuando el cliente o técnico está *"Escribiendo..."*.
* **Multimedia:** Envío de imágenes capturadas con la cámara o seleccionadas de la galería con vista previa antes de enviar.
* **Paginación eficiente:** Carga inicial de 50 mensajes con botón para cargar historial anterior.
* **Acciones rápidas:** Copiado de mensajes con pulsación prolongada (*long press*) y botón de llamada directa (`tel:`) utilizando la API nativa de llamadas.

### 5. Módulo de Perfil y Preferencias (`app/profile/`)
* Datos del usuario autenticado con badge de rol.
* Switch interactivo para alternar entre **Modo Claro** y **Modo Oscuro** guardado en el contexto de la aplicación.
* Pantalla de ayuda y preguntas frecuentes (`help.tsx`).
* Cierre de sesión seguro limpiando credenciales de Firebase y storage local.

---

## 📁 5. Estructura de Directorios del Proyecto

```text
TesisApp/
├── app/                              # Rutas y Pantallas (Expo Router)
│   ├── (tabs)/                       # Navegación por pestañas (si aplica)
│   ├── _layout.tsx                   # Layout global (Theme Provider, Toasts, Stack)
│   ├── index.tsx                     # Enrutador inicial por verificación de rol
│   ├── auth/
│   │   ├── login.tsx                 # Inicio de sesión y recuperación
│   │   └── register.tsx              # Registro con validaciones DNI/Teléfono
│   ├── client/
│   │   ├── home.tsx                  # Mapa, radar de técnicos, solicitud y estados
│   │   ├── map.tsx                   # Vista alternativa de mapa
│   │   └── history.tsx               # Historial de servicios del cliente
│   ├── provider/
│   │   ├── home.tsx                  # Radar de pedidos, PIN, cronómetro y cámara
│   │   └── history.tsx               # Historial y balance de trabajos del técnico
│   ├── chat/
│   │   └── [id].tsx                  # Chat en tiempo real con fotos y typing
│   ├── profile/
│   │   ├── index.tsx                 # Perfil, cambio de tema y logout
│   │   └── help.tsx                  # Preguntas frecuentes y soporte
│   └── onboarding/
│       └── index.tsx                 # Pantallas de bienvenida / tutorial inicial
├── components/                       # Componentes reutilizables de UI
├── config/                           # Configuraciones de inicialización
├── functions/                        # Firebase Cloud Functions (Node.js)
│   ├── index.js                      # Triggers para Push Notifications automáticas
│   └── package.json                  # Dependencias de Cloud Functions
├── hooks/                            # Custom Hooks (temas, colores)
├── src/
│   ├── config/
│   │   └── firebase.ts               # Inicialización de Auth, Firestore y Storage
│   └── context/
│       └── ThemeContext.tsx          # Proveedor global de modo Claro / Oscuro
├── utils/
│   └── pushNotifications.ts          # Utilidades para registro y envío de Push Expo
├── firestore.rules                   # Reglas de seguridad de Firestore
├── app.config.js                     # Configuración dinámica de Expo y plugins
└── package.json                      # Dependencias y scripts de ejecución
```

---

## 📊 6. Resumen de Tecnologías por Capa

| Capa | Tecnología / Herramienta | Propósito en el Proyecto |
| :--- | :--- | :--- |
| **Mobile Core** | React Native 0.81 + Expo 54 | Desarrollo multiplataforma en iOS y Android |
| **Lenguaje** | TypeScript 5.9 | Tipado estricto, interfaces de datos y consistencia |
| **Navegación** | Expo Router v6 | Sistema de rutas basado en archivos tipo Next.js |
| **Base de Datos** | Cloud Firestore | Base de datos NoSQL reactiva en tiempo real |
| **Autenticación** | Firebase Auth | Registro, inicio de sesión seguro y roles |
| **Serverless Logic** | Firebase Cloud Functions | Despacho automático de notificaciones push ante eventos |
| **Push Service** | Expo Push Notifications API | Entrega de notificaciones remotas en segundo plano |
| **Geo & Mapas** | React Native Maps + Geolib | Visualización de mapa, cálculo de distancias y cercanía |
| **Hardware** | Expo Camera & Location | Captura de foto de evidencia y tracking GPS |
| **Estado de Tema** | React Context API | Soporte y persistencia de temas Light / Dark |

---
*Documento generado para fines de documentación técnica, sustentación de tesis y referencia del equipo de desarrollo.*

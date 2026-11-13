# 🛠️ Maestro a Domicilio Perú — TesisApp

Plataforma integral de gestión, asignación geoespacial y trazabilidad en tiempo real para servicios técnicos domiciliarios (Gasfitería, Electricidad, Cerrajería, etc.) en Lima Metropolitana.

Desarrollado como proyecto de tesis de Ingeniería de Sistemas Computacionales:
> **"Implementación de aplicativo móvil para mejorar la eficiencia operativa en una empresa multiservicios de Lima, 2026"**

---

## 📌 Componentes del Sistema

El ecosistema está conformado por dos aplicaciones conectadas mediante una arquitectura Cloud en tiempo real:

1. **Aplicativo Móvil (`app/`)**:
   - **Tecnologías:** React Native (`v0.81.5`), Expo SDK 54 (`~54.0.33`), Expo Router v6 (`~6.0.23`), TypeScript.
   - **Roles:**
     - **Cliente:** Solicitud con geolocalización asistida, seguimiento de técnico, validación presencial por PIN de seguridad y chat interactivo.
     - **Técnico / Proveedor:** Control de disponibilidad, aceptación de despachos, navegación, validación de PIN en sitio, cronómetro de trabajo y registro de evidencia fotográfica obligatoria.
     - **Operador / Monitor:** Vista básica de supervisión móvil.

2. **Panel Web de Administración y Despacho (`admin-web/`)**:
   - **Tecnologías:** Vite + React 19 + TypeScript + Leaflet + Recharts + jsPDF + XLSX.
   - **Funciones:** Bandeja reactiva de solicitudes en tiempo real, baremo de tarifas institucional, despacho de técnicos por cercanía (Geohash), mapas de monitoreo en vivo, auditoría de fotos y exportación de métricas de tesis (TTR, TAS, TVA, TES) para SPSS/Excel.

3. **Backend & Base de Datos**:
   - **Firebase Authentication:** Manejo de sesiones y control de acceso basado en roles (RBAC).
   - **Cloud Firestore:** Base de datos NoSQL con listeners reactivos (`onSnapshot`), índices geoespaciales y reglas de seguridad auditadas (`firestore.rules`).

---

## 🚀 Inicio Rápido

### Prerrequisitos
- Node.js (v20 o superior recomendado)
- npm o yarn
- Expo CLI (`npx expo`)
- Dispositivo Android con Expo Go o Emulador Android configurado

### 1. Aplicativo Móvil
```bash
# Instalar dependencias
npm install

# Iniciar servidor Expo
npx expo start
```

### 2. Panel Web Administrativo
```bash
# Entrar a la carpeta web e instalar dependencias
cd admin-web
npm install

# Iniciar en modo desarrollo (http://localhost:5173)
npm run dev
```

---

## 📚 Documentación Esencial del Proyecto

Para consultar los detalles técnicos, metodológicos y operativos, revisa los documentos dedicados:

- **[RESUMEN_ARQUITECTURA_Y_TECNOLOGIAS.md](RESUMEN_ARQUITECTURA_Y_TECNOLOGIAS.md)**: Arquitectura de software, esquema de base de datos Firestore, reglas de seguridad, colecciones y estructura del código.
- **[ANALISIS_Y_ESTADO_TESIS.md](ANALISIS_Y_ESTADO_TESIS.md)**: Modelo operativo de central vs. marketplace, justificación técnica, límites de notificaciones/FCM y argumentación para la sustentación.
- **[GUIA_COORDINACION_GIT_Y_PRUEBAS.md](GUIA_COORDINACION_GIT_Y_PRUEBAS.md)**: Flujo de trabajo en equipo sin conflictos Git, plan maestro de pruebas (IEEE 829 / ISO 29119) y matriz de casos de prueba CP-WEB y CP-MOV.
- **[GUIA_INSTALACION_ENTORNO.md](GUIA_INSTALACION_ENTORNO.md)**: Manual detallado paso a paso para configurar el entorno de desarrollo y variables `.env`.
- **[PROPUESTA_MAESTRO_A_DOMICILIO.md](PROPUESTA_MAESTRO_A_DOMICILIO.md)**: Planteamiento del problema, hipótesis, pregunta de investigación y objetivos generales y específicos de la tesis.

---

## 🧪 Pruebas Unitarias

Para ejecutar la batería completa de pruebas unitarias móviles:
```bash
npm test
```
Para validar la compilación del panel web:
```bash
npm --prefix admin-web run build
```

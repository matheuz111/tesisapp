# 📋 Guía Completa de Instalación y Configuración del Entorno - TesisApp

Este documento especifica todos los requisitos de software, herramientas y pasos detallados para que **cada integrante del grupo de tesis** pueda configurar su PC e inicializar el proyecto correctamente sin errores.

---

## 📌 1. Arquitectura y Tecnologías del Proyecto

* **Móvil / Frontend:** React Native (`v0.81.5`) + **Expo SDK 54** (`~54.0.33`) + Expo Router v6 (`~6.0.23`).
* **Lenguaje:** TypeScript (`~5.9.2`) / JavaScript.
* **Backend / Servicios Cloud:** Firebase (Firestore, Auth, Storage, Cloud Messaging / Notifications).
* **Cloud Functions:** Node.js 20 (ubicadas en el directorio `/functions`).
* **Servicios de Mapas:** Google Maps API (Android / Web) gestionado con `react-native-maps` y `expo-location`.

---

## 🛠️ 2. Requisitos de Software que debe Instalar cada Integrante

### A. Herramientas Obligatorias (Todos los integrantes)

1. **Node.js (Versión Recomendada: LTS 20.x)**
   * **¿Por qué?** El proyecto requiere Node.js >= 18 para Expo SDK 54, y las Firebase Cloud Functions en `/functions/package.json` especifican explícitamente la versión 20 de Node.
   * 📥 **Descargar:** [Node.js Official Web (LTS v20.x)](https://nodejs.org/)
   * 🔍 **Verificación en la consola (CMD / PowerShell / Bash):**
     ```bash
     node -v
     npm -v
     ```
     *(Verifica que `node -v` devuelva `v20.x.x` o superior).*

2. **Git**
   * **¿Por qué?** Control de versiones para clonar, actualizar y enviar cambios al repositorio.
   * 📥 **Descargar:** [Git SCM](https://git-scm.com/)
   * 🔍 **Verificación en consola:**
     ```bash
     git --version
     ```

3. **Editor de Código: Visual Studio Code (VS Code)**
   * 📥 **Descargar:** [Visual Studio Code](https://code.visualstudio.com/)
   * 🔌 **Extensiones Recomendadas de VS Code para instalar:**
     * **Expo Tools** (Autocompletado y validación de `app.json` / `app.config.js`).
     * **ES7+ React/Redux/React-Native snippets** (Snippets de desarrollo rápido).
     * **Prettier - Code formatter** (Formateo automático de código).
     * **Tailwind CSS IntelliSense** (Opcional si se usan estilos utilitarios).

---

### B. Herramientas de Pruebas y Ejecución (Según preferencia o tarea)

#### Opción 1: Celular Físico con Expo Go (Recomendado para pruebas rápidas)
* Instalar la aplicación **Expo Go** en tu smartphone:
  * 🤖 Android: [Expo Go en Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)
  * 🍎 iOS: [Expo Go en App Store](https://apps.apple.com/app/expo-go/id982107779)
* **Requisito de red:** La PC y el celular deben estar conectados a la **MISMA red Wi-Fi**.

#### Opción 2: Emulador de Android (Para pruebas nativas de Android / Google Maps)
1. Instalar **Android Studio**: [Android Studio Official](https://developer.android.com/studio)
2. Dentro de Android Studio, ir a `SDK Manager` e instalar:
   * **Android SDK Platform** (Android 14.0 / API 34 o superior).
   * **Android SDK Build-Tools** y **Platform-Tools**.
3. Crear un dispositivo virtual en `Virtual Device Manager` (ej. Pixel 6 con versión de Android con Google Play APIs).
4. Instalar **JDK 17 (Java Development Kit 17)** para compilar Android.
5. **Configurar Variables de Entorno en Windows:**
   * Crear la variable de sistema `ANDROID_HOME` apuntando a:  
     `C:\Users\<TU_USUARIO>\AppData\Local\Android\Sdk`
   * Crear o verificar `JAVA_HOME` apuntando a JDK 17 (ej. `C:\Program Files\Java\jdk-17`).
   * Agregar a la variable de entorno `PATH`:
     * `%ANDROID_HOME%\platform-tools`
     * `%ANDROID_HOME%\emulator`

#### Opción 3: Firebase CLI (Recomendado si trabajas en el Backend / Cloud Functions / Firestore)
* Instalar Firebase CLI globalmente en tu equipo:
  ```bash
  npm install -g firebase-tools
  ```
* Autenticarte en Firebase:
  ```bash
  firebase login
  ```

---

## 🚀 3. Guía Paso a Paso para Inicializar el Proyecto

### Paso 1: Clonar el Repositorio
```bash
git clone <URL_DEL_REPOSITORIO_GIT>
cd TesisApp
```

### Paso 2: Crear y Configurar el Archivo `.env`
1. En la **raíz del proyecto** (junto a `package.json`), crea un archivo llamado `.env` (sin extensión).
2. Agrega la variable de entorno para la clave de API de Google Maps:
   ```env
   EXPO_PUBLIC_GOOGLE_API_KEY=TU_CLAVE_DE_API_DE_GOOGLE_MAPS
   ```
   > ⚠️ **Nota:** Solicita la API Key válida al administrador o compañero encargado del proyecto de Google Cloud / Maps. Puedes revisar `.env.example` como plantilla.

### Paso 3: Instalar las Dependencias de la Aplicación Principal
Ejecuta el siguiente comando en la raíz del proyecto (`TesisApp`):
```bash
npm install
```

### Paso 4: Instalar las Dependencias del Backend (`/functions`)
Si vas a ejecutar o desplegar las funciones de Firebase Cloud Functions:
```bash
cd functions
npm install
cd ..
```

---

## 🏃‍♂️ 4. Cómo Iniciar y Probar la Aplicación Sin Errores

### 1. Iniciar el Servidor de Desarrollo Expo
Desde la raíz del proyecto, ejecuta:
```bash
npm start
```
*(O su equivalente: `npx expo start`)*

### 2. Opciones de Ejecución:

* **En Celular Físico (Expo Go):**
  1. Abre **Expo Go** en tu smartphone.
  2. Escanea el **código QR** que aparece en la terminal (Android) o desde la cámara (iOS).
  3. *Nota de red:* Si no logra conectar por restricciones de tu router/Wi-Fi, ejecuta:
     ```bash
     npx expo start --tunnel
     ```

* **En Emulador Android:**
  * Con el emulador ya abierto en tu PC, presiona la tecla **`a`** en la consola interactiva de Expo, o ejecuta:
    ```bash
    npm run android
    ```

* **En el Navegador Web:**
  * Presiona la tecla **`w`** en la consola, o ejecuta:
    ```bash
    npm run web
    ```

---

## ⚡ 5. Solución de Errores Comunes (Troubleshooting)

| Error / Síntoma | Causa Principal | Solución |
| :--- | :--- | :--- |
| **Google Maps muestra pantalla gris / sin mapa** | Falta la API Key en `.env` | Asegúrate de haber creado el archivo `.env` en la raíz con `EXPO_PUBLIC_GOOGLE_API_KEY=...` y vuelve a iniciar con `npm start`. |
| **`Node.js version mismatch` al desplegar/probar funciones** | Usando versión de Node previa a v18/v20 | Actualiza Node.js a la versión v20 LTS. |
| **`Unable to resolve module ...`** | Dependencias desactualizadas o fallas en `node_modules` | Elimina la carpeta `node_modules` y `package-lock.json` y ejecuta `npm install`. |
| **Expo Go dice "Could not connect to server"** | Redes distintas entre PC y Móvil | Conecta ambos a la misma red Wi-Fi o ejecuta con `npx expo start --tunnel`. |
| **Error de caché en Expo** | Cambios en paquetes o expo-router | Limpia la caché ejecutando `npx expo start -c`. |
| **Error con `google-services.json`** | El archivo no está presente en la raíz | Asegúrate de mantener el archivo `google-services.json` en la raíz del proyecto para Firebase Android (`com.jonathan.tesisapp`). |

---

## 📋 Lista de Verificación (Checklist) para Cada Integrante

- [ ] Node.js (v20 LTS) instalado (`node -v`).
- [ ] Git instalado (`git --version`).
- [ ] VS Code instalado con las extensiones recomendadas.
- [ ] Repositorio clonado en la PC.
- [ ] Archivo `.env` creado en la raíz con `EXPO_PUBLIC_GOOGLE_API_KEY`.
- [ ] Ejecutado `npm install` en la raíz del proyecto.
- [ ] Ejecutado `npm install` dentro de la carpeta `functions`.
- [ ] Aplicación iniciada con éxito usando `npm start`.

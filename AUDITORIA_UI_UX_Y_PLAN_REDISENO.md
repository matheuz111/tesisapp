# Auditoría UI/UX y plan de rediseño — Maestro a Domicilio (app móvil)

**Rama analizada:** `feature/mobile-qa-app`
**Stack:** Expo SDK 57, React Native 0.86.3, expo-router, reanimated 4.5.1, TypeScript
**Fecha:** 2026-11-12

> Uso recomendado: abrir este archivo en Claude Code desktop, crear una rama nueva `feature/ui-redesign` a partir de `feature/mobile-qa-app` y trabajar por fases (sección 5). Adjuntar capturas y assets de la sección 6.

---

## 1. Lo que ya está bien

- Sistema de diseño documentado: `DISENO_UI_UX_MAESTRO_A_DOMICILIO.md`.
- Tokens con contraste WCAG AA (`src/theme/tokens.ts`).
- Componentes base reutilizables (`src/components/base/`: BaseButton, BaseCard, BaseInput, BaseBottomSheet, etc.).
- Estados de servicio con color e icono propios (`StatusTokens`).
- Reanimated, expo-haptics y expo-image ya instalados.

## 2. Hallazgos (problemas encontrados)

| # | Hallazgo | Evidencia | Impacto |
|---|----------|-----------|---------|
| 1 | **Sin identidad de marca al abrir la app.** El splash es el placeholder de Expo (círculos con cuadrícula). El logo real solo existe en `admin-web/public/logo-maestro.png`; el login usa un ícono genérico de llave. | `assets/images/splash-icon.png`, `app.config.js`, `app/auth/login.tsx:167` | Alto |
| 2 | **Dos sistemas de diseño en paralelo.** `BaseTokens.ts` (colores fijos) y `theme/tokens.ts` + `ThemeContext` (claro/oscuro). Los componentes base no leen el tema, así que el **modo oscuro no funciona** en las pantallas que los usan. | `BaseButton.tsx:13`, solo 14 archivos usan `useTheme` | Alto |
| 3 | **Colores y tamaños hardcodeados.** Hex: `chat/[id]` 87, `ProviderDashboard` 65, `client/home` 62, `CsatSurveyModal` 47, `ClientConformityView` 44. `fontSize` literales: `client/home` 49, `chat/[id]` 27, `operator/home` 19. | grep sobre `app/` y `src/components/` | Alto (bloquea rediseño) |
| 4 | **Pantallas gigantes** que mezclan lógica y UI: `client/home.tsx` 2038 líneas, `chat/[id].tsx` 1529, `provider/home.tsx` 889. | `wc -l` | Alto |
| 5 | **Tipografía prometida pero no cargada.** Los tokens declaran IBM Plex Sans/Mono, pero no hay `useFonts` en ningún archivo: se usa la fuente del sistema. | `src/theme/tokens.ts:190` | Medio |
| 6 | **Onboarding sin pulir.** Colores fuera de paleta (`#007bff`, `#9b59b6`, `#2ecc71`), sin swipe, íconos planos, estilos inline. | `app/onboarding/index.tsx` | Medio |
| 7 | **Restos de la plantilla Expo.** `app/(tabs)/`, `app/modal.tsx`, `components/hello-wave.tsx`, `parallax-scroll-view.tsx`, assets `react-logo*`, `partial-react-logo.png`. Header global fijo en blanco. | `app/_layout.tsx:128` | Bajo/Medio |
| 8 | **Poca animación.** Solo `AnimatedFadeIn` y `AnimatedPressable`. Sin transiciones entre pantallas ni micro-interacciones. | `src/components/Animated*.tsx` | Medio |
| 9 | **Pantalla de arranque pobre.** `app/index.tsx` muestra un spinner con texto crudo mientras resuelve la sesión. | `app/index.tsx` | Medio |
| 10 | **Color de marca inconsistente.** Logo en azul brillante + gris; la app usa `#0369A1`; notificaciones usan `#007bff`. | `app.config.js`, `BaseTokens.ts` | Medio |
| 11 | **Seguridad (fuera de diseño).** `google-services.json` está versionado en git. `firebase-adminsdk-service-account.json` está en la carpeta (ignorado por git, pero verificar que nunca se haya subido a historial). | `git ls-files` | Revisar |

## 3. Splash con logo + animación antes del login

**Viabilidad: alta.**

1. **Splash nativo (estático):** reemplazar `splash-icon.png` por el logo con fondo de marca en `app.config.js` (`splash` y plugin `expo-splash-screen`, incluido el bloque `dark`). Requiere **nuevo build EAS**; no se ve en Expo Go.
2. **Splash animado (JS):** componente propio (p. ej. `src/components/AnimatedSplash.tsx`) con `react-native-reanimated`:
   - Mantener el splash nativo con `SplashScreen.preventAutoHideAsync()` hasta que carguen fuentes y sesión.
   - Animación sugerida: la casa se dibuja (trazo), la llave rota y encaja, aparece el texto "maestro / adomicilio.com", y luego fade/escala hacia login (o directo a la home del rol si ya hay sesión).
   - Integrar en `app/_layout.tsx` / `app/index.tsx`, reemplazando el spinner actual.
3. **Limitación:** el logo actual es PNG horizontal con fondo blanco. Para animar bien se necesita **SVG** (con `react-native-svg`, hay que instalarlo) o el ícono separado del texto.

## 4. Rediseño radical: viabilidad y riesgos

**Viable, pero por fases.** No hacerlo de un solo salto por los hallazgos 2, 3 y 4. Un rediseño sobre colores hardcodeados y archivos de 2000 líneas genera regresiones. El flujo core está cubierto por 79 pruebas (`npm test`), úsalas como red de seguridad (las pruebas son de lógica, no visuales: la verificación visual es manual).

Antes de empezar hay que definir la **dirección visual** (referencias y paleta, ver sección 6).

## 5. Plan por fases

**Fase 0 — Preparación**
- Crear rama `feature/ui-redesign` desde `feature/mobile-qa-app`.
- Definir dirección visual, paleta y tipografía.

**Fase 1 — Cimientos**
- Unificar `BaseTokens.ts` y `theme/tokens.ts` en un único sistema con claro/oscuro.
- Hacer que los componentes base lean el tema (`useTheme`).
- Cargar fuentes (`expo-font` / `@expo-google-fonts/*`) con `useFonts`.
- Eliminar restos de plantilla (`(tabs)`, `modal`, `hello-wave`, `react-logo*`).

**Fase 2 — Primera impresión (alto impacto, bajo riesgo)**
- Splash nativo con logo + splash animado.
- Rediseñar login, registro y onboarding (con swipe y paleta de marca).
- Pantalla de arranque/carga con skeleton o animación de marca.

**Fase 3 — Componentes base**
- Rediseñar Button, Card, Input, Header, BottomSheet, Badge, Tile.
- Agregar transiciones de pantalla y micro-interacciones.

**Fase 4 — Pantallas principales (una por una)**
- Partir `client/home.tsx` en componentes y rediseñar.
- `provider/home.tsx` + `ProviderDashboard`.
- `chat/[id].tsx`, historiales, perfil, operador.
- Cada pantalla: sustituir hex/fontSize literales por tokens.

**Fase 5 — Cierre**
- Revisión de contraste y accesibilidad (WCAG AA), modo oscuro completo.
- Pruebas en dispositivo real, `npm test`, `npx tsc --noEmit`, `npm run lint`.
- Nuevo build EAS (`npm run build:preview:android`).

## 6. Qué entregar para empezar

Colocar en una carpeta nueva `assets/brand/` (o adjuntar en el chat):

- [ ] Logo en **SVG** (o PNG transparente de alta resolución).
- [ ] **Ícono solo** (casa + llave) en alta resolución, para splash e ícono de app.
- [ ] **Paleta de marca** en hex (hoy: azul del logo vs `#0369A1` de la app: hay que decidir cuál manda).
- [ ] **2–3 referencias visuales** (apps que te gusten, p. ej. Uber, Rappi, Airbnb) o descripción del estilo: oscuro/premium, limpio/minimal, con gradientes, etc.
- [ ] **Capturas de las pantallas actuales** (cliente, técnico, chat, login) para ver qué cambiar.
- [ ] Fuente de marca `.ttf`, si existe.

## 7. Claude Code: ¿escritorio o CLI?

Para este trabajo sirven ambos; el código es el mismo. Lo que más importa en diseño es **ver el resultado**:

- La app de **escritorio** facilita adjuntar capturas y referencias visuales, útil para iterar el diseño.
- Flujo recomendado: correr `npm start` con emulador o dispositivo, tomar capturas de cada cambio, adjuntarlas y pedir ajustes.
- Trabajar siempre en la rama `feature/ui-redesign` para no mezclar con el trabajo de QA de la tesis.

## 8. Prompt sugerido para arrancar en Claude Code desktop

```
Lee AUDITORIA_UI_UX_Y_PLAN_REDISENO.md. Estoy en la rama feature/ui-redesign.
Empieza por la Fase 2: splash nativo con mi logo (assets/brand/) y un splash
animado con reanimated que haga transición fluida al login o a la home si ya
hay sesión. No toques lógica de negocio ni las pruebas existentes.
Al terminar, corre npx tsc --noEmit y npm run lint.
```

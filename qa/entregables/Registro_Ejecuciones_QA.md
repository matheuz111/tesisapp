# 📝 REGISTRO TÉCNICO DE EJECUCIONES Y LOGS DE QA
**Proyecto:** Maestro a Domicilio Perú S.A.C.  
**Tesis:** Eficiencia Operativa en Empresa Multiservicios de Lima, 2026  
**Fecha de Ejecución:** 13 de Octubre de 2026  
**Entorno de Pruebas:** Windows 11 x64 · Node.js v22 · PowerShell 7 / Windows PowerShell  

---

## 1. RESUMEN CONSOLIDADO DE EJECUCIÓN

| Comando Ejecutado | Objetivo Técnico | Tests / Archivos | Resultado | Duración |
| :--- | :--- | :---: | :---: | ---: |
| `npm test` | Suite completa móvil y cross-platform | 90 tests / 17 suites | **PASS (0 fail)** | 2.59 s |
| `node --test admin-web/test/*.mjs` | Suite de pruebas unitarias panel web | 18 tests / 4 suites | **PASS (0 fail)** | 0.15 s |
| `npx tsc --noEmit` | Verificación estática TypeScript móvil | Todo el árbol móvil | **Código 0 (0 err)** | 7.82 s |
| `npm run lint` | ESLint / Expo Lint código móvil | Árbol `app/`, `src/`, etc. | **Código 0 (0 err)** | 4.11 s |
| `npm --prefix admin-web run lint` | Oxlint linter de alto rendimiento web | 39 archivos | **Código 0 (0 err)** | 41 ms |
| `npm --prefix admin-web run build` | Compilación de producción Vite 8 / React 19 | 2708 módulos | **Código 0 (0 err)** | 816 ms |

---

## 2. DETALLE DE SUITES MÓVIL Y CROSS-PLATFORM (`npm test`)

### Suite 1: `test/dataContract.test.cjs`
- `SOL-POST correlative formatting logic produces exactly 4 zero-padded digits`: **PASS** (1.2 ms)
- `Data Contract: SPSS variables mapping logic`: **PASS** (1.8 ms)

### Suite 2: `test/serviceRequestTransition.test.cjs`
- `getAutomaticTransitionFields assigns timestamps according to canonical contract`: **PASS** (83.5 ms)
- `applyTransitionToBatch records audit entry in status_history and updates request`: **PASS** (17.7 ms)
- `createInitialStatusHistoryRecord creates root PENDING_ASSIGNMENT audit record`: **PASS** (15.4 ms)

### Suite 3: `test/crossPlatformIntegration.test.cjs`
- `E2E Lifecycle 01: Client request creation from Mobile matches Web schema`: **PASS** (1.8 ms)
- `E2E Lifecycle 02: Web Central quotes and assigns provider with atomic pricing`: **PASS** (0.3 ms)
- `E2E Lifecycle 03: Provider accepts order on Mobile within SLA`: **PASS** (0.1 ms)
- `E2E Lifecycle 04: Arrival and PIN validation at site unlocks service start`: **PASS** (0.2 ms)
- `E2E Lifecycle 05: Evidence capture and completion requires valid photo`: **PASS** (1.3 ms)
- `E2E Lifecycle 06: Web Central audit validates evidence and closes service`: **PASS** (0.2 ms)
- `E2E Lifecycle 07: Payment submission via Mobile and Web reconciliation`: **PASS** (0.2 ms)
- `E2E Lifecycle 08: Client rating and provider reputation batching`: **PASS** (0.2 ms)
- `E2E Lifecycle 09: SPSS thesis metrics derive exact operational indicators`: **PASS** (1.3 ms)
- `E2E Edge Case 10: Provider rejection safely triggers REQUIRES_REASSIGNMENT`: **PASS** (0.5 ms)
- `E2E Edge Case 11: Client cancellation releases provider and retains audit`: **PASS** (0.3 ms)

### Suite 4: `test/operationalZones.test.cjs`
- `normalizeDistrictName trims diacritics, extra spaces, and prefix`: **PASS** (0.8 ms)
- `getZoneByDistrict maps all canonical Lima districts correctly`: **PASS** (1.2 ms)
- `getZoneByCoordinates correctly assigns coordinates to zones or UNKNOWN`: **PASS** (0.4 ms)
- `resolveOperationalZone prioritizes verified district > coords bounds > worker zone > UNKNOWN`: **PASS** (0.5 ms)

### Suite 5: `test/providerPresenceContract.test.cjs`
- `validateCoordinates correctly validates latitude and longitude limits`: **PASS** (1.0 ms)
- `computeGeohash generates 9-character precision hash for Lima coordinates`: **PASS** (0.4 ms)
- `buildProviderPresencePayload enforces canonical structure and zones`: **PASS** (1.5 ms)
- `isPresenceStale detects timestamps older than threshold seconds`: **PASS** (0.3 ms)
- `calculateDistanceKm computes accurate distance between Lima districts`: **PASS** (0.3 ms)
- `createAdaptivePresencePublisher throttles stationary samples and accelerates on motion`: **PASS** (0.6 ms)

### Suite 6: `test/pricing.test.cjs` & `test/canonicalPricing.test.cjs`
- `Price supports decimal dot and comma with exact cents`: **PASS** (1.5 ms)
- `Rejects zero, negatives, too many decimals, thousands separators and nonnumeric inputs`: **PASS** (0.2 ms)
- `Currency conversion utilities correctly convert between soles and integer cents`: **PASS** (0.2 ms)

### Suite 7: `test/pricingPolicies.test.cjs`
- `Default pricing policy has audited validity, conditions, and deductible visit fee`: **PASS** (1.7 ms)
- `Resolves zone-specific policies when configured`: **PASS** (0.4 ms)
- `Falls back to default policy when outside validity or no zone override`: **PASS** (0.2 ms)

### Suite 8: `test/session.test.cjs`
- `Profile cache is usable immediately without waiting for the server`: **PASS** (86.8 ms)
- `Empty cache times out with an actionable error, then recovers on server response`: **PASS** (22.6 ms)
- `Logout clears the previous profile and discards a late snapshot`: **PASS** (22.0 ms)
- `Changing accounts cannot inherit the previous role or late callback`: **PASS** (18.6 ms)
- `Retry retains the loaded profile and replaces its previous listener`: **PASS** (18.0 ms)
- `A missing server profile resolves the spinner without inventing a role`: **PASS** (11.6 ms)

### Suite 9: `test/push-session.test.cjs`
- `Repeated native token events do not fetch native tokens or rewrite Firestore`: **PASS** (207.6 ms)
- `Concurrent registration requests share the same operation`: **PASS** (64.6 ms)
- `Logout succeeds with rejected cleanup and duplicate clicks call auth.signOut only once`: **PASS** (43.7 ms)
- `Logout never waits indefinitely for offline Firestore writes, including after app restart`: **PASS** (1553.8 ms)
- `A registration completing after logout cannot attach an old account to the device`: **PASS** (26.2 ms)
- `Switching accounts requires a fresh registration even on the same phone`: **PASS** (24.8 ms)

### Suite 10: `test/ratings.test.cjs`
- `validateRating accepts integers from 1 to 5`: **PASS** (1.1 ms)
- `validateRating rejects out-of-range, decimals, strings and invalid types`: **PASS** (0.5 ms)
- `sanitizeReviewComment trims and handles empty or whitespace input`: **PASS** (0.4 ms)
- `sanitizeReviewComment caps length at MAX_REVIEW_COMMENT_LENGTH (300 chars)`: **PASS** (0.3 ms)
- `submitServiceRating throws on invalid requestId or rating`: **PASS** (2.7 ms)
- `submitServiceRating creates batch with request and provider updates`: **PASS** (15.3 ms)

### Suite 11: `test/payment.test.cjs`
- `isValidPaymentMethod recognizes valid methods and rejects invalid`: **PASS** (0.9 ms)
- `submitClientPayment throws on empty requestId or invalid method`: **PASS** (0.8 ms)
- `submitClientPayment updates document with paymentStatus PAID and voucher`: **PASS** (0.3 ms)
- `confirmProviderPayment updates document with paymentStatus CONFIRMED`: **PASS** (0.3 ms)

### Suite 12: `test/routing.test.cjs`
- `decodePolyline decodes standard Google encoded polyline correctly`: **PASS** (1.5 ms)
- `decodePolyline handles empty, null or invalid strings safely`: **PASS** (3.1 ms)
- `formatDurationText produces readable time strings`: **PASS** (0.3 ms)
- `formatDistanceText produces readable distance strings`: **PASS** (0.2 ms)

---

## 3. DETALLE DE SUITES DEL PANEL WEB (`admin-web/test/`)

### Suite 13: `admin-web/test/canonical.test.mjs`
- `Canonical: District normalization trims and removes diacritics`: **PASS** (1.1 ms)
- `Canonical: District resolves to exact OperationalZone without Lima Centro bias`: **PASS** (0.6 ms)
- `Canonical: Coordinates resolve within bounding box`: **PASS** (0.2 ms)
- `Canonical: Fallback resolution never defaults to Lima Centro`: **PASS** (0.2 ms)
- `Pricing: Monetary values integer cents round-trip`: **PASS** (0.2 ms)
- `Pricing: Default visit fee policy resolves active 2026 policy`: **PASS** (3.1 ms)

### Suite 14: `admin-web/test/filters.test.mjs`
- `Filters: Status tab PENDING includes PENDING_ASSIGNMENT and QUOTED`: **PASS** (1.7 ms)
- `Filters: Operational Zone LIMA_NORTE isolates only northern districts`: **PASS** (0.5 ms)
- `Filters: Text search matches code, client, and phone correctly`: **PASS** (0.3 ms)
- `Filters: Combined filter (Zone + Channel + Status) returns consistent subset`: **PASS** (0.3 ms)
- `Filters Performance: 1,000 requests filtered under 5 ms`: **PASS** (2.5 ms)

### Suite 15: `admin-web/test/rbac.test.mjs`
- `RBAC: OPERATOR role is granted access`: **PASS** (0.7 ms)
- `RBAC: ADMIN role is granted access`: **PASS** (0.1 ms)
- `RBAC: CLIENT role is denied access with explicit alert`: **PASS** (0.2 ms)
- `RBAC: PROVIDER role is denied access with explicit alert`: **PASS** (1.0 ms)
- `RBAC: Non-existent profile document is rejected safely`: **PASS** (0.2 ms)

### Suite 16: `admin-web/test/spss.test.mjs`
- `SPSS: Computes response, assignment, arrival, and total minutes accurately`: **PASS** (2.0 ms)
- `SPSS: Missing optional timestamps return empty string rather than NaN`: **PASS** (0.2 ms)

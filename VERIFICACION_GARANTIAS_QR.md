# Verificación de garantías con QR (plan gratuito de Firebase)

Cada certificado de garantía lleva un código QR que abre una página pública para confirmar que es auténtico. Funciona **sin Cloud Functions**: solo usa Firestore y Hosting, que están incluidos en el plan Spark.

## Cómo funciona

1. La central abre una garantía y pulsa **Emitir certificado verificable** (o directamente *Imprimir*, *Descargar PDF* o *Enviar por WhatsApp*, que lo emiten si hace falta).
2. Se crea el documento `warranty_certificates/<código>`. El código tiene 16 letras y números aleatorios (unos 78 bits) y no se puede deducir del correlativo `SOL-POST-xxxx`.
3. El QR del certificado apunta a `https://<tu-dominio>/verificar/<código>`.
4. Esa página lee un solo documento y muestra: estado (vigente, vencida o anulada), servicio, titular enmascarado (`Ros*** Qui***`) y fechas. Nunca muestra teléfono, dirección, técnico ni PIN.
5. Cada visita se registra como máximo una vez por día y por certificado (`warranty_scans`). Los registros se conservan 12 meses: la central los limpia sola al abrir el panel (una vez al día), porque la política TTL de Firestore exige facturación y no está disponible en el plan gratuito.

## Anulación

La central puede **anular** un certificado desde el mismo modal (con un motivo de al menos 5 caracteres). Es irreversible: si la garantía debe continuar, se emite uno nuevo. El QR ya impreso pasa a mostrar "Certificado anulado". El motivo queda en una subcolección que solo lee la central.

## Seguridad: qué garantizan las reglas de Firestore

| Qué | Regla |
| --- | --- |
| Leer un certificado | Cualquiera, **solo si conoce el código** (`get`) |
| Listar certificados | Solo la central (`list`); el público no puede recorrer la colección |
| Crear | Solo la central; código válido, 30 días exactos, sin campos extra, estado `ACTIVE` |
| Modificar | Solo anular, una vez y sin tocar otros datos |
| Borrar | Nadie |
| Motivo de anulación | Solo la central |
| Registrar escaneo | Cualquiera, un documento por certificado y día, solo si el certificado existe y con esquema fijo |
| Leer escaneos | Solo la central |
| Borrar escaneos | Solo la central y solo los que ya cumplieron 12 meses |

Los datos públicos no incluyen información personal completa, así que, aunque alguien tenga un código, solo ve lo mismo que muestra el QR.

## Límites (por no usar servidor)

- **No hay límite de consultas por persona.** Cualquiera puede probar códigos, pero con 78 bits es inviable acertar uno. Cada intento fallido cuenta como lectura en tu cuota gratuita (50 000 lecturas por día); un ataque masivo podría agotarla. Si algún día pasa, la mitigación gratuita es activar **Firebase App Check** en el proyecto.
- El estado "vencida" se calcula con la fecha del navegador de quien consulta; si su reloj está mal, podría ver un estado erróneo. La anulación sí es exacta, porque la decide la central.
- Los escaneos se cuentan por **días distintos**, no por cada visita. Es lo que permite limitar las escrituras sin servidor.

## Despliegue (todo gratuito)

```bash
# 1. Construir el panel (incluye la página /verificar)
cd admin-web
npm run build
cd ..

# 2. Publicar las reglas de Firestore y Hosting (no uses firestore:indexes: no hace falta y puede preguntar por índices ajenos)
npx firebase-tools deploy --only firestore:rules
npx firebase-tools deploy --only hosting
```

- La dirección del QR usa el dominio donde esté publicado el panel. Si lo abres desde `localhost` para probar, el QR apuntaría a `localhost`. Para fijar el dominio real, crea `admin-web/.env.production` con:
  `VITE_PUBLIC_BASE_URL=https://tesis-servicios.web.app` (o tu dominio propio) y vuelve a construir.
- No se usa TTL de Firestore (devuelve "billing disabled" en el plan gratuito). La retención de 12 meses la hace `purgeExpiredScans()` al abrir el panel; si algún día activas facturación, puedes cambiarlo por una política TTL sobre `expireAt`.
- Las pruebas de reglas están en `test/firestore.rules.test.cjs` y se ejecutan con `npm run test:rules` (requieren el CLI de Firebase y Java instalados).

## Archivos

- `admin-web/src/services/warrantyCertificateModel.ts`: código, máscara de nombre, estado y claves de escaneo (funciones puras, con pruebas).
- `admin-web/src/services/warrantyCertificateService.ts`: emitir, anular, consultar y registrar escaneo.
- `admin-web/src/components/VerifyCertificatePage.tsx`: página pública.
- `admin-web/src/components/WarrantyCertificateModal.tsx`: emisión, QR, anulación y envío.
- `admin-web/src/utils/pdfGenerator.ts`: el PDF incluye el QR.
- `firestore.rules`, `firestore.indexes.json`, `firebase.json`: reglas, TTL y cabeceras (`noindex`).

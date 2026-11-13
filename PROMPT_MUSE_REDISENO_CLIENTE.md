# Rediseño de la app del cliente — propuestas y prompt para Muse

## Parte 1. Diagnóstico: por qué hay tanto scroll hoy

La pantalla `/client/home` (cuando no hay servicio activo) apila, de arriba abajo:

1. Cabecera (logo, saludo, zona, llamar, tema).
2. Selector de modalidad (Con Cotización / Atención Simple).
3. Grilla de 8 especialidades.
4. Formulario largo "Detalles de la Visita": descripción, distrito, referencia, mapa, foto, "¿Cuándo lo necesitas?", tarifa de visita, método de pago, botón de solicitar.

El usuario decide **todo a la vez** y debe recorrer unas 3 pantallas de alto antes de poder pedir el servicio. El problema es de estructura, no de estilo: hay que mostrar **una decisión a la vez** y dejar visible siempre lo importante (qué pido, cuánto cuesta, el botón).

Principios para las tres propuestas:

- Máximo **una pantalla de alto** en reposo; el formulario se divide en pasos o secciones plegables.
- **Un solo botón principal** siempre visible (barra fija inferior, por encima de la barra flotante).
- Elegir con **toques** (chips, tarjetas, selectores), escribir lo mínimo.
- Mostrar el **precio oficial** desde el primer paso (transparencia del baremo).
- Recordar datos: última dirección y último oficio pedido, a un toque.
- Movimiento con sentido: los pasos deslizan, el resumen se actualiza en vivo, el botón se llena al completar.

## Parte 2. Las tres propuestas

### Propuesta A — "Asistente por pasos" (la más guiada)
La home en reposo es corta: saludo, tarjeta de **"Pedir un maestro"** y servicios recientes. Al tocar, se abre un flujo de 4 pasos a pantalla completa con barra de progreso y un solo botón "Continuar".

- Paso 1: **Oficio** (grilla 2x4 de tarjetas grandes con icono duotono y precio de visita).
- Paso 2: **Problema** (chips de fallas frecuentes del oficio elegido + foto opcional + texto corto).
- Paso 3: **Dónde y cuándo** (dirección guardada con mapa pequeño, "Ahora" o "Programar" con franjas).
- Paso 4: **Confirmar** (resumen, tarifa de visita deducible, método de pago, botón "Solicitar maestro").
- Ventaja: cero scroll, lo entiende cualquiera. Desventaja: más toques para quien sabe lo que quiere.

### Propuesta B — "Mapa + hoja inferior" (la más vistosa, estilo Uber)
La home es un **mapa a pantalla completa** con la ubicación del cliente. Arriba, un buscador "¿Qué necesitas arreglar?". Abajo, una **hoja arrastrable** con tres alturas: compacta (oficios en carrusel horizontal), media (chips de fallas + descripción) y completa (confirmación).

- Los maestros cercanos se ven como puntos en el mapa (refuerza confianza y rapidez).
- El formulario vive dentro de la hoja; al elegir oficio la hoja sube sola.
- Ventaja: muy visual, poco texto. Desventaja: requiere más trabajo de mapa y gestos.

### Propuesta C — "Tablero de acciones" (la más rápida para clientes frecuentes)
Una sola pantalla con módulos: tarjeta del **servicio activo** (si existe), botón grande **"Urgente ahora"** (un toque, usa última dirección y último oficio), **accesos por oficio** en una fila deslizable, **servicios recientes** para repetir, y un bloque de garantía ("30 días de garantía institucional").
- Ventaja: pedir de nuevo toma 2 toques. Desventaja: el cliente nuevo ve menos guía.

**Recomendación:** A para el primer pedido del cliente nuevo y C como pantalla de inicio de quien ya pidió antes (se pueden combinar: la home es C y "Pedir un maestro" abre A). B se evalúa después por costo.

### Mejoras comunes a las tres
- Barra de resumen fija sobre la barra flotante: *"Gasfitería · Los Olivos · Visita S/ 45.00 · [Solicitar]"*.
- Segmentado simple para modalidad: *Con cotización | Atención simple*, con una línea explicativa que cambia.
- Estados vacíos con ilustración (herramientas), esqueletos con la silueta real, y confeti discreto al crear la solicitud.
- Seguimiento como **línea de tiempo vertical** con el PIN en tarjeta ámbar y el mapa con "Llega en 18 min".

---

## Parte 3. Prompt completo para Muse

> Copia desde la siguiente línea hasta el final del archivo.

### CONTEXTO DEL PRODUCTO

Diseña la interfaz móvil (Android, 1080x2340 px, relación 9:19.5) de **"Maestro a Domicilio"**, una app peruana de servicios técnicos a domicilio en Lima y Callao (gasfitería, electricidad, pintura, carpintería, albañilería, cerrajería, línea blanca/TV y otros). La empresa asigna técnicos homologados, fija tarifas por baremo oficial, valida la llegada con un PIN de 4 dígitos y exige foto de evidencia al terminar. Voz: profesional, cercana, transparente. Idioma de TODA la interfaz: **español peruano**. Moneda: **S/** (soles).

Quiero **3 propuestas distintas (A, B y C)** para cada pantalla indicada, para compararlas lado a lado.

### OBJETIVO DEL REDISEÑO
- Que el cliente pida un servicio en **menos de 60 segundos** y **sin hacer scroll** en la pantalla principal.
- Que se vea **vistoso y moderno** sin perder seriedad corporativa.
- Que sea **interactivo y entendible**: una decisión por vez, precio visible desde el inicio, un solo botón principal.

### SISTEMA VISUAL (obligatorio, igual en todas las propuestas)
- **Estilo:** "Precisión industrial, cercana". Superficies sólidas, **sin degradados, sin vidrio, sin neón, sin emojis**. Se permiten bloques de color sólido, ilustraciones planas de herramientas y iconos duotono (trazo + relleno suave de una sola familia, estilo Ionicons).
- **Colores:** fondo oscuro `#0B1329`, superficie `#131D38`, borde `#233055`, texto `#F8FAFC`, texto secundario `#94A3B8`, acción primaria `#0369A1` (texto blanco), azul claro de acento `#38BDF8`, **acento cálido ámbar `#F59E0B` solo para lo que pide atención (PIN, ofertas, tarifa)**. Estados: pendiente `#FBBF24`, en camino `#60A5FA`, en ejecución `#A78BFA`, completado `#4ADE80`, urgente/cancelado `#F87171`. Entrega **cada pantalla en modo oscuro y en modo claro** (claro: fondo `#F8FAFC`, superficie `#FFFFFF`, borde `#E2E8F0`, texto `#0F172A`).
- **Forma:** tarjetas con radio 12 px y borde de 1 px; botones de 48 px de alto (radio 12); la barra de navegación es una **píldora flotante** (ver abajo).
- **Tipografía:** títulos en sans geométrica tipo Plus Jakarta Sans 700/800; cuerpo 14-16 px tipo sistema; **cifras, precios y códigos en monoespaciada** (`S/ 45.00`, `SOL-POST-0142`, `4821`).
- **Barra de navegación (en todas las pantallas principales):** píldora flotante separada de los bordes (20 px) y del borde inferior, con 3 pestañas: **Servicio** (herramientas), **Historial** (recibo), **Mi Perfil** (persona). La pestaña activa es un bloque azul `#0369A1` con icono blanco y etiqueta; las inactivas solo icono. Detrás, una franja con desenfoque. En modo claro la píldora es blanca con borde fino; en oscuro, superficie `#131D38`.
- **Accesibilidad:** contraste mínimo 4.5:1, áreas táctiles de 48 px.
- **Datos de ejemplo (usa estos):** cliente "Rosa Quispe", distrito "Los Olivos", dirección "Av. Las Palmeras 1240, Dpto 302", técnico "Juan Carlos Ramos" (4.9 estrellas, gasfitero homologado), código `SOL-POST-0142`, PIN `4821`, tarifa de visita `S/ 45.00` (deducible de la cotización final).

### PANTALLAS A DISEÑAR (cada una con propuestas A, B y C)

**C-01 · Inicio en reposo** — ruta `/client/home` (sin servicio activo). Es la pantalla más importante.
- Elementos: logo, saludo "Hola, Rosa", zona "Los Olivos · LIMA NORTE", botón llamar a la central, interruptor de tema; selector de **modalidad** (Con cotización / Atención simple); **8 oficios** (Gasfitería `water-outline`, Electricidad `flash-outline`, Pintura `color-palette-outline`, Carpintería `hammer-outline`, Albañilería `construct-outline`, Cerrajería `key-outline`, Línea blanca / TV `tv-outline`, Otro servicio `apps-outline`); acceso a servicios recientes; botón principal "Solicitar maestro".
- Propuesta A: tarjeta "Pedir un maestro" + recientes, el flujo se abre aparte. Propuesta B: mapa a pantalla completa con buscador "¿Qué necesitas arreglar?" y hoja inferior. Propuesta C: tablero con botón "Urgente ahora", fila de oficios y recientes.
- **Regla:** todo lo esencial visible sin scroll.

**C-02 · Flujo de solicitud** — componentes `SpecialtyGrid`, `ServiceModeSelector`, formulario "Detalles de la Visita".
- Pasos: Oficio → Problema (chips de fallas del oficio, p. ej. Gasfitería: "Fuga de agua", "Desagüe atorado", "Terma no calienta", "Grifería"; foto opcional; texto corto de hasta 500 caracteres) → Dónde (distrito entre los 43 de Lima/Callao, referencia "piso, torre, interior", punto en mapa) → Cuándo ("Ahora" / "Programar" con franjas "Mañana 10am-1pm") → Confirmar (tarifa de visita `S/ 45.00`, método de pago Yape / Plin / Efectivo, botón "Solicitar maestro").
- Diseña los pasos con barra de progreso, botón "Continuar" fijo y una **barra de resumen** persistente: "Gasfitería · Los Olivos · Visita S/ 45.00".
- Muestra también el estado de **error** (falló el GPS: "No pudimos obtener tu ubicación exacta. Elige tu distrito manualmente") y de **sin conexión** (franja ámbar fija y botón deshabilitado).

**C-03 · Seguimiento del servicio** — estados `PENDING_ASSIGNMENT`, `QUOTED`, `PENDING`, `ACCEPTED`, `IN_PROGRESS`, `COMPLETED`.
- Una línea de tiempo vertical (Buscando técnico → Técnico asignado → En camino → En ejecución → Culminado).
- Estado "En camino": tarjeta ámbar con **PIN de seguridad `4821`** en monoespaciada grande y el texto "Díctaselo al técnico únicamente cuando toque tu timbre"; tarjeta del técnico (foto, nombre, 4.9, "Técnico Propio", botones llamar y chat); mapa con ruta y "Llega en 18 min".
- Diseña los 3 estados clave: Buscando, En camino, En ejecución.

**C-04 · Cotización** — componente `QuoteApprovalView`.
- Proforma con desglose en soles (visita deducible, mano de obra, materiales), validez, botones "Aprobar cotización" (principal) y "Rechazar" / "Consultar con la central".

**C-05 · Cierre, pago y calificación** — componentes `ClientConformityView`, `CsatSurveyModal`.
- Foto de evidencia del trabajo ("Revisa la foto de evidencia tomada por el técnico antes de pagar"), conformidad (Conforme / Reportar problema), pago (Yape, Plin, Efectivo, adjuntar comprobante), calificación de 1 a 5 estrellas y encuesta de 5 ítems (escala "Muy en desacuerdo" a "Muy de acuerdo").

**C-06 · Historial** — ruta `/client/history`: lista de servicios con estado, fecha, precio y acción "Pedir de nuevo".

**C-07 · Perfil** — ruta `/profile`: datos, distrito, número Yape/Plin, modo oscuro, notificaciones, ubicación, ayuda, cerrar sesión.

**C-08 · Chat** — ruta `/chat/[id]`: burbujas estilo mensajería (enviado verdoso, recibido neutro), hora con doble check, acciones rápidas "Estoy afuera" / "Llegué" / "Terminé".

**C-09 · Estados vacíos y de error** — ilustraciones planas en una sola familia: historial vacío, sin conexión, sin técnicos disponibles, error genérico.

### FORMATO DE ENTREGA
1. Para cada pantalla C-01 a C-09: **tres propuestas (A, B, C)**, cada una en modo oscuro y claro.
2. Una lámina comparativa por pantalla con las tres propuestas lado a lado.
3. Para C-01 y C-02, un mini mapa de interacción (qué pasa al tocar cada elemento).
4. Una nota breve por propuesta: qué problema de scroll/claridad resuelve.

### LO QUE NO QUIERO
Degradados, vidrio esmerilado en tarjetas, neón, emojis como iconos, bordes redondeados de 24 px o más en tarjetas rectangulares, textos de relleno de marketing ("Lleva tu hogar al siguiente nivel"), nombres anglosajones en los datos de ejemplo, ni mezclar familias de iconos.

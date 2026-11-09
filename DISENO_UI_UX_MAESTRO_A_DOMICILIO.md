# DOCUMENTO MAESTRO DE REESTRUCTURACIÓN UI/UX
## Plataforma de Gestión y Despacho Operativo — Maestro a Domicilio Perú S.A.C.
**Proyecto de Tesis:** *Implementación de aplicativo móvil para mejorar la eficiencia operativa en una empresa multiservicios de Lima, 2026*  
**Versión del Sistema de Diseño:** 2.0 (Canónico y Multiplataforma)  
**Autoría:** Diseñador Senior UX/UI & Especialista en Producto Digital

---

## 1. Principios de diseño y tono del producto

### 1.1. Filosofía y Enfoque de Producto
*Maestro a Domicilio* no es un marketplace informal de clasificados ni una plataforma desregulada de "conectar personas". Es un **sistema corporativo de gestión, despacho técnico y aseguramiento de calidad** para servicios domiciliarios en Lima Metropolitana y el Callao. La empresa asume la responsabilidad institucional del servicio: homologa a los técnicos, calcula tarifas según baremo oficial, gestiona el despacho geolocalizado, audita la llegada física con PIN y valida la evidencia fotográfica antes de emitir la garantía de servicio.

Por ello, la experiencia de usuario debe erradicar la incertidumbre característica de los servicios informales (temor por seguridad en el hogar, tarifas sorpresa, retrasos sin aviso, técnicos no identificados) y transmitir:
1. **Seguridad y Certeza Doméstica:** Cada pantalla para el cliente responde de inmediato a tres preguntas críticas: *¿Quién vendrá exactamente a mi casa?*, *¿Cuánto me va a costar según la tarifa oficial?* y *¿Cómo sé que el trabajo quedó bien hecho?*.
2. **Eficiencia Táctica en Calle (Ergonomía de Campo):** La interfaz móvil del técnico está pensada para ser operada con una sola mano, bajo luz solar directa en la vía pública de Lima, con botones de impacto táctil amplio (≥ 48px) y sin flujos complejos que entorpezcan su labor manual.
3. **Control Operativo de Alta Densidad (Panel Web):** La interfaz de la central de despacho maximiza la visión situacional: mapas de calor/racimos (clusters), tablas con tiempos de respuesta en tiempo real, alertas de reasignación y trazabilidad de indicadores clave ($T_{RESP}$, $T_{ASIG}$, $T_{VIS}$, $T_{TOTAL}$) para la contrastación empírica de la tesis.

### 1.2. Principios de UX Obligatorios (Reglas de Oro del Sistema)
1. **Resolución Intuitiva Sin Manual:** Un cliente nuevo debe poder solicitar un gasfitero o electricista en menos de 90 segundos sin requerir instrucciones ni tutoriales invasivos.
2. **Regla de Una Acción Primaria:** Cada pantalla tiene un único botón de acción principal con peso visual dominante. Las acciones secundarias se presentan como botones de contorno (*outline*) o enlaces de texto con jerarquía subordinada clara.
3. **Navegación Simétrica y Predictible:** Los estados de un servicio tienen el mismo nombre canónico, el mismo color semántico y el mismo significado en la App Móvil (React Native/Expo) y en la Web Administrativa (React/Vite).
4. **Definición Obligatoria de los 5 Estados del Sistema:** Toda pantalla, tarjeta o componente de datos debe contemplar explícitamente:
   - *Carga (Skeleton loading estructurado, nunca spinners ciegos infinitos).*
   - *Vacío (Empty state explicativo con ilustración funcional y llamada a la acción).*
   - *Éxito (Feedback háptico y banners de confirmación con datos concretos).*
   - *Error (Mensaje pedagógico en español local con botón de reintento directo).*
   - *Sin Conexión / Offline (Banner persistente de solo lectura con caché en AsyncStorage).*
5. **Accesibilidad Universal (WCAG 2.1 AA):** Ratios de contraste de texto ≥ 4.5:1 para texto normal y ≥ 3:1 para elementos interactivos/texto grande; áreas táctiles mínimas de 44×44 px (48×48 px en interfaz de técnico); navegación por teclado completa en la web y etiquetas semánticas para TalkBack/VoiceOver.
6. **Feedback Inmediato (< 100 ms):** Toda pulsación produce respuesta táctil (vía `expo-haptics`) o visual instantánea (estado activo, optimistic UI en chat y cambios de estado), reduciendo la ansiedad del usuario.

### 1.3. Tono y Voz de la Marca
- **Voz:** Profesional, cercana, transparente y técnica sin ser distante. Habla como un maestro especialista calificado y respaldado por una empresa seria.
- **Tono según Contexto:**
  - *En emergencias (fugas de agua, cortocircuitos):* Sereno, resolutivo y directo. Informa tiempos estimados de llegada y medidas preventivas inmediatas.
  - *En cotización y cobros:* Preciso, inmutable y transparente en Soles (`PEN`), detallando siempre qué rubro corresponde a visita técnica o mano de obra.
  - *En soporte y resolución de incidencias:* Empático, institucional y conciliador.

---

## 2. Usuarios y flujos clave

### 2.1. Arquetipos de Usuario y Contextos de Uso
1. **Cliente Hogar (Ej. Rosa María Quispe - 38 años, San Borja / Los Olivos):**
   - *Contexto:* Presenta una fuga de agua bajo el lavadero un sábado por la mañana. Necesita un gasfitero confiable con urgencia, saber exactamente cuánto cobrarán por revisar y tener la seguridad de que quien ingresa a su domicilio está identificado y respaldado por la empresa.
   - *Dispositivo:* Smartphone Android gama media (Samsung Galaxy A34 / Xiaomi Redmi Note 12).
2. **Técnico Especialista de Campo (Ej. Juan Carlos Ramos - 45 años, Gasfitero matriculado, Cono Norte):**
   - *Contexto:* Se desplaza en motocicleta por la Panamericana Norte y la Av. Universitaria. Lleva caja de herramientas y las manos con polvo o guantes. Requiere una app ágil que no consuma batería excesiva, con notificaciones sonoras claras para aceptar servicios, mapa con ruta directa y botón de PIN grande.
   - *Dispositivo:* Smartphone Android robusto con pantalla expuesta a la luz solar.
3. **Operador/a de Despacho en Central (Ej. Mayra Torres - 29 años, Sede Central Breña):**
   - *Contexto:* Opera desde PC de escritorio con doble monitor. Atiende llamadas telefónicas, monitorea solicitudes entrantes de la app, resuelve alertas de reasignación cuando un técnico está saturado y revisa fotos de evidencias antes de cerrar la orden.
   - *Dispositivo:* Navegador Web de escritorio (Chrome en Windows 11, resolución 1920×1080).

---

### 2.2. Flujo Principal del Servicio Paso a Paso (End-to-End)

```
[CLIENTE MÓVIL]                   [CENTRAL WEB (OPERADOR)]            [TÉCNICO MÓVIL]
       │                                     │                              │
1. Selecciona especialidad,                   │                              │
   dirección y foto del daño                 │                              │
       │                                     │                              │
       ├───── PENDING_ASSIGNMENT ───────────►│                              │
       │                               2. Revisa bandeja,                    │
       │                                  aplica baremo oficial              │
       │                                  y asigna técnico cercano           │
       │                                     │                              │
       │◄──── QUOTED / PENDING ──────────────┴──────── PENDING ────────────►│
       │                                                              3. Suena alerta auditiva;
3a. Revisa tarifa en Soles                                               revisa distrito, falla
   y recibe código PIN                                                   y tarifa. Acepta servicio
       │                                                                    │
       │◄──── ACCEPTED (Técnico en camino) ─────────────────────────────────┤
       │                                                                    │
4. Observa ubicación del                                              5. Navega por GPS
   técnico en vivo en mapa                                               hacia el domicilio
       │                                                                    │
6. Técnico llega al predio.                                          7. Solicita PIN al cliente
   Cliente le dicta su PIN                                              y lo digita en pantalla
       │                                                                    │
       │◄──── IN_PROGRESS (PIN Validado exitosamente) ──────────────────────┤
       │                                                                    │
8. Espera ejecución del                                               9. Ejecuta labor técnica;
   servicio doméstico                                                    cronómetro en pantalla
       │                                                                    │
       │                                                             10. Captura foto de
       │                                                                 evidencia obligatoria
       │                                                                    │
       │◄──── COMPLETED ────────────────────────────────────────────────────┤
       │                                                                    │
11. Revisa evidencia, paga por                                       12. Confirma recepción
    Yape/Plin/Efectivo y califica                                        del pago en su app
       │                                                                    │
       ├───── Registro de pago y reseña ────►│                              │
       │                               13. Operador audita fotos             │
       │                                   y emite certificado               │
       │                                     │                              │
       │◄──── VALIDATED / ARCHIVED ──────────┴──────────────────────────────┘
```

#### Paso 1: Solicitud del Cliente (App Móvil)
- **Acción:** El cliente abre la app, selecciona una de las 8 especialidades (Gasfitería, Electricidad, etc.), añade una breve descripción ("Fuga de agua en llave de paso del baño"), toma una foto del daño, confirma la dirección obtenida por GPS y añade una referencia ("Dpto 302, timbre blanco").
- **Transición:** Se genera el correlativo canónico (ej. `SOL-POST-0142`) y se graba en Firestore en estado `PENDING_ASSIGNMENT`.
- **Feedback:** Alerta sonora leve y transición inmediata a la pantalla de espera de despacho con indicador de tiempo transcurrido.

#### Paso 2: Triage y Despacho en Central (Panel Web)
- **Acción:** La solicitud ingresa instantáneamente a la bandeja con etiqueta amarilla `PENDING_ASSIGNMENT`. El operador abre el modal de despacho, donde el sistema prefiltra a los técnicos que cumplen:
  1. Misma especialidad.
  2. Estado `AVAILABLE` en telemetría de presencia.
  3. Misma zona operativa (ej. `LIMA_NORTE`).
  4. Ordenados por cercanía geográfica y reputación (estrellas).
- **Tarifa Oficial:** El operador valida la tarifa según la política del Baremo 2026 (ej. Tarifa de inspección: S/ 45.00) y asigna al técnico.
- **Transición:** Estado `PENDING`. Notificación Push de alta prioridad despachada al smartphone del técnico.

#### Paso 3: Aceptación por el Técnico (App Móvil)
- **Acción:** El teléfono del técnico emite vibración persistente y alerta de despacho con tarjeta modal emergente: *"Nueva Asignación: Gasfitería en Los Olivos (a 2.4 km) - Tarifa: S/ 45.00"*.
- **Control de Tiempo:** El técnico dispone de 90 segundos para presionar `[ACEPTAR SERVICIO]`. Si presiona rechazar o expira el tiempo, la solicitud pasa a `REQUIRES_REASSIGNMENT` alertando a la central en rojo.
- **Transición:** Al aceptar, el estado cambia a `ACCEPTED`.

#### Paso 4: En Camino y Seguridad (App Cliente y Técnico)
- **Cliente:** Su pantalla cambia automáticamente a *"Técnico en camino"*. Se despliega la tarjeta del técnico (Nombre completo, foto de carné verificado, especialidad, calificación de 4.9 estrellas) y se resalta en un recuadro de alta visibilidad su **PIN de Seguridad de 4 dígitos** (ej. `4821`), con la indicación: *"Solo entrega este PIN al técnico cuando esté en la puerta de tu casa"*.
- **Técnico:** Dispone de un botón primario `[ABRIR EN MAPAS]` (Google Maps / Waze) y un botón de llamada directa por celular.

#### Paso 5: Arribo y Validación de Inicio (App Móvil)
- **Acción:** Al llegar al domicilio, el técnico pulsa `[VALIDAR LLEGADA CON PIN]`. Se abre un teclado numérico táctil de dígitos grandes.
- **Validación Cripto-Operativa:** Al ingresar los 4 dígitos correctos, la aplicación vibra afirmativamente (`Haptics.notificationAsync(Success)`) y desbloquea la pantalla de servicio en ejecución.
- **Transición:** Estado `IN_PROGRESS`. Marca temporal `startedAt` grabada en Firestore. El cliente recibe notificación de inicio formal.

#### Paso 6: Ejecución y Captura de Evidencia (App Técnico)
- **Acción:** El técnico repara la avería. La app muestra un cronómetro activo de trabajo.
- **Evidencia Obligatoria:** Para poder finalizar, la app exige obligatoriamente abrir la cámara nativa (`expo-camera`) y capturar una fotografía nítida del trabajo realizado (ej. la tubería reemplazada sin goteo). Sin foto, el botón de cierre permanece deshabilitado.
- **Transición:** Al pulsar `[FINALIZAR Y ENVIAR EVIDENCIA]`, el estado muta a `COMPLETED`.

#### Paso 7: Pago y Calificación (App Cliente)
- **Acción:** El cliente ve la notificación: *"¡Trabajo culminado por el técnico!"*. Observa la fotografía de evidencia cargada por el trabajador.
- **Registro de Pago:** Elige el método de pago (`YAPE`, `PLIN`, `TRANSFERENCIA`, `EFECTIVO`). Si paga por Yape/Plin, puede subir captura del comprobante.
- **Calificación:** Evalúa el servicio mediante selector interactivo de 1 a 5 estrellas y un campo de texto para reseña de calidad (hasta 300 caracteres).
- **Cierre por Central:** La central audita la evidencia en el panel web y emite el Certificado de Garantía en PDF (30 días de garantía institucional), pasando el servicio a `VALIDATED` / `ARCHIVED`.

---

## 3. Arquitectura de información y navegación

### 3.1. Mapa de Navegación de la Aplicación Móvil (React Native / Expo Router)

```
                            ┌────────────────────────┐
                            │  (Punto de Entrada)    │
                            │      app/index.tsx     │
                            │  Sesión & Role Routing │
                            └───────────┬────────────┘
                                        │
                 ┌──────────────────────┴──────────────────────┐
                 ▼                                             ▼
        [ROL: CLIENT]                                  [ROL: PROVIDER]
                 │                                             │
   ┌─────────────┴─────────────┐                 ┌─────────────┴─────────────┐
   │                           │                 │                           │
   ▼                           ▼                 ▼                           ▼
┌──────────────┐       ┌──────────────┐   ┌──────────────┐       ┌──────────────┐
│  /client/home│       │/client/histor│   │/provider/home│       │/provider/hist│
│ Solicitud,   │       │ Lista de     │   │ Switch Disp.,│       │ Balance PEN, │
│ Mapa en vivo,│       │ atenciones,  │   │ Radar oferta,│       │ Historial de │
│ Seguimiento, │       │ detalle,     │   │ PIN llegada, │       │ atenciones   │
│ PIN, Pago    │       │ garantías    │   │ Cámara Evid. │       │ completadas  │
└──────┬───────┘       └──────────────┘   └──────┬───────┘       └──────────────┘
       │                                         │
       ├─────────────────┬───────────────────────┤
       │                 │                       │
       ▼                 ▼                       ▼
┌──────────────┐  ┌──────────────┐        ┌──────────────┐
│  /chat/[id]  │  │   /profile   │        │/profile/help │
│ Mensajería   │  │ Datos DNI,   │        │ Preguntas,   │
│ tiempo real, │  │ Modo Claro / │        │ teléfonos de │
│ fotos, tel:  │  │ Oscuro, Salir│        │ emergencia   │
└──────────────┘  └──────────────┘        └──────────────┘
```

#### Estructura de Navegación Móvil
- **Barra de Navegación Inferior (Bottom Tabs):** Presenta 3 pestañas principales de acceso permanente:
  1. `Servicio`: Pantalla principal del rol (`client/home` o `provider/home`).
  2. `Historial`: Historial cronológico con filtros por estado.
  3. `Mi Perfil`: Configuración personal, DNI, teléfono, switch de tema y botón de cierre de sesión.
- **Header Superior Limpio:**
  - Lado izquierdo: Logotipo oficial de *Maestro a Domicilio* y zona operativa detectada (ej. `Lima Norte`).
  - Lado derecho: Acceso rápido a soporte telefónico de emergencia de la central y switch rápido de tema (sol/luna).

---

### 3.2. Mapa de Navegación del Panel Web de Operaciones (Admin Web)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         NAVBAR SUPERIOR INSTITUCIONAL                         │
│ [Logo Maestro] [Operador: Mayra T.] [Lima Metrop.] [Tema ☀/🌙] [Cerrar Sesión]│
├──────────────────────────────────────────────────────────────────────────────┤
│ BANNER DE TELEMETRÍA: [Sol. Activas: 14] [En Ruta: 6] [Alerta Reasig: 1 (🚨)]│
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│ ┌───────────────────────────┐ ┌────────────────────────────────────────────┐ │
│ │ BANDEJA DE DESPACHO       │ │ MODALES OPERATIVOS (Sobrepuestos)          │ │
│ │ - Buscador de solicitudes │ │ - AssignWorkerModal (Técnicos por zona/km) │ │
│ │ - Filtros de Zona (5 zonas│ │ - OperationalMapModal (Leaflet clusters)   │ │
│ │ - Filtros de Estado       │ │ - ServiceDetailModal (Ficha técnica 360°)  │ │
│ │ - Tabla de Datos          │ │ - BaremoCatalogModal (Tarifario 2026)      │ │
│ │   * Correlativo SOL-xxxx  │ │ - ImageLightboxModal (Auditoría evidencias)│ │
│ │   * Cliente & Distrito    │ │ - ProformaQuoteModal (Emisión PDF proforma)│ │
│ │   * Especialidad & Precio │ │ - WarrantyCertificateModal (Garantía PDF)  │ │
│ │   * Técnico & Estado      │ │ - SpssExporterModal (Exportación SPSS 26v) │ │
│ │   * Acciones contextuales │ │ - RealtimeChatModal (Monitoreo chat)       │ │
│ └───────────────────────────┘ └────────────────────────────────────────────┘ │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Sistema de diseño (Tokens y componentes canónicos)

El sistema de diseño rechaza terminantemente estilos artificiales de IA (gradientes púrpura/neón, sombras difusas sin física, bordes redondeados sobredimensionados). Se basa en el concepto **"Framed Sheet & Industrial Precision"**: solidez constructiva, tipografía técnica de alta legibilidad y jerarquía cromática estricta donde menos del 5% del área visual lleva acento cromático, permitiendo que la información operativa destaque sin fatiga visual.

### 4.1. Design Tokens de Color (Paleta Canónica)

#### Colores Primarios y de Marca
| Token | Valor Hex | Justificación y Uso |
| :--- | :--- | :--- |
| `color-brand-primary` | `#0284C7` (Sky Blue 600) | Azul técnico corporativo. Denota solidez institucional y tecnología limpia. Utilizado para acciones principales, botones de confirmación y selección activa. |
| `color-brand-primary-hover` | `#0369A1` (Sky Blue 700) | Estado interactivo hover/press en desktop y web. |
| `color-brand-primary-subtle` | `#E0F2FE` (Sky Blue 100) | Fondo suave de badges de selección y píldoras informativas. |
| `color-brand-navy` | `#0F172A` (Slate 900) | Azul noche industrial. Color de texto principal en modo claro y barras de herramientas institucionales. Comunica máxima autoridad y seriedad. |

#### Colores Semánticos de Estado Operativo
Cada estado del ciclo de vida tiene un color semántico estricto para evitar ambigüedades en la central y en la app:
| Token | Valor Hex | Estado Asociado | Justificación |
| :--- | :--- | :--- | :--- |
| `color-status-pending` | `#D97706` (Amber 600) | `PENDING_ASSIGNMENT`, `PENDING` | Alerta cálida de atención requerida por la central o el técnico. Alta visibilidad. |
| `color-status-transit` | `#2563EB` (Blue 600) | `ACCEPTED` (En camino) | Azul dinámico que comunica movimiento y desplazamiento en ruta. |
| `color-status-progress` | `#7C3AED` (Violet 600) | `IN_PROGRESS` | Color de ejecución técnica en el predio. Distingue la labor manual del viaje. |
| `color-status-success` | `#16A34A` (Green 600) | `COMPLETED`, `VALIDATED` | Verde confirmatorio. Indica trabajo concluido, pago validado y garantía activa. |
| `color-status-danger` | `#DC2626` (Red 600) | `REQUIRES_REASSIGNMENT`, `CANCELLED` | Rojo de urgencia operativa. Requiere intervención inmediata del operador. |

#### Superficies y Fondos (Modo Claro vs. Modo Oscuro)
| Token | Modo Claro (`light`) | Modo Oscuro (`dark`) | Uso |
| :--- | :--- | :--- | :--- |
| `surface-ground` | `#F8FAFC` (Slate 50) | `#0B1329` (Deep Navy) | Fondo general de la aplicación. |
| `surface-sheet` | `#FFFFFF` | `#131D38` (Elevated Navy) | Superficie de tarjetas de contenido y modales. |
| `surface-subtle` | `#F1F5F9` (Slate 100) | `#1C294D` | Fondos de inputs, chips inactivos y divisores. |
| `border-hairline` | `#E2E8F0` (Slate 200) | `#233055` | Bordes estructurales de 1px. Cero desenfoque. |
| `text-primary` | `#0F172A` (Slate 900) | `#F8FAFC` (Slate 50) | Títulos, precios y datos críticos. Ratio contraste > 12:1. |
| `text-secondary` | `#475569` (Slate 600) | `#94A3B8` (Slate 400) | Subtítulos, referencias, fechas y microcopy. Contraste > 4.8:1. |
| `text-muted` | `#64748B` (Slate 500) | `#64748B` | Metadatos y textos deshabilitados. |

---

### 4.2. Tipografía Razonada

Se descarta el uso indiscriminado de fuentes genéricas sin calibrar. Se establece una dupla tipográfica técnica optimizada para renderizado móvil y dashboards:

1. **Fuente de Interfaz y Cuerpo: `IBM Plex Sans` (Web) y `Plus Jakarta Sans` / `System UI` (Móvil)**
   - *Por qué:* Diseñadas específicamente para interfaces técnicas y legibilidad en pantallas de alta y baja densidad. Sus aperturas amplias en letras como 'c', 'e', 's' y la diferenciación clara entre '1', 'I', 'l' previenen errores críticos en lectura rápida de direcciones y códigos en Lima.
2. **Fuente de Datos Técnicos y Moneda: `IBM Plex Mono` / `ui-monospace`**
   - *Por qué:* Todas las cifras monetarias (`S/ 45.00`), códigos correlativos (`SOL-POST-0142`), números de PIN (`4821`), DNI (`45892104`) y coordenadas geográficas deben alinearse tabularmente sin oscilaciones de ancho de caracteres.

#### Escala Tipográfica
| Nivel | Tamaño | Peso | Line-Height | Uso |
| :--- | :--- | :--- | :--- | :--- |
| `display-lg` | 24px (1.5rem) | 700 (Bold) | 32px | Encabezados principales, código PIN grande de seguridad. |
| `heading-md` | 18px (1.125rem) | 600 (SemiBold) | 24px | Título de servicio, nombres de modales, nombre del técnico. |
| `body-md` | 14px (0.875rem) | 400 (Regular) | 20px | Cuerpo de texto, descripciones del problema, referencias. |
| `body-sm` | 12px (0.75rem) | 500 (Medium) | 16px | Badges de estado, distritos, marcas de tiempo, etiquetas secundarias. |
| `mono-stat` | 15px (0.9375rem) | 600 (Mono) | 20px | Precios en Soles (`S/ xx.xx`), correlativo de orden, teléfono. |

---

### 4.3. Sistema de Espaciado y Radios de Borde

Basado estrictamente en un grid de **4px / 8px**:
- `space-1`: 4px (micro-ajustes de iconos y badges)
- `space-2`: 8px (espacio entre icono y texto, gaps compactos)
- `space-3`: 12px (padding interno de inputs y chips)
- `space-4`: 16px (margen estándar de contenedores móviles y tarjetas)
- `space-6`: 24px (separación entre secciones principales)
- `space-8`: 32px (márgenes exteriores en modales de escritorio)

#### Radios de Borde Funcionales (Anti-Uniformidad)
- `radius-sm`: 4px para badges, píldoras de estado y campos de formulario técnicos.
- `radius-md`: 8px para botones de acción y tarjetas de datos estándar.
- `radius-lg`: 12px para modales y hojas inferiores (*bottom sheets*).
- *(Prohibido: bordes de 24px o 32px en tarjetas rectangulares que desperdician espacio de visualización).*

---

### 4.4. Componentes Base y Comportamiento Canónico

#### 1. Botón Primario (`PrimaryButton`)
- **Altura fija:** 48px en móvil (garantiza objetivo táctil cómodo), 40px en web.
- **Fondo:** `color-brand-primary` (`#0284C7`), texto en blanco `700`, borde ninguno.
- **Feedback:** Al pulsar en móvil, dispara `Haptics.impactAsync(Light)` y opacidad temporal al 85%.
- **Estado de Carga:** Oculta el texto y muestra un `ActivityIndicator` blanco centrado, manteniendo inmutable el tamaño del botón.
- **Estado Deshabilitado:** Fondo `#CBD5E1` (Slate 300), texto `#94A3B8`, cursor no permitido, sin respuesta táctil.

#### 2. Tarjeta de Solicitud de Servicio (`ServiceCard`)
- **Estructura en 3 Niveles de Jerarquía:**
  1. *Encabezado:* Correlativo mono (`SOL-POST-0142`) a la izquierda + Badge de Estado canónico a la derecha.
  2. *Cuerpo Central:* Ícono de oficio + Nombre de especialidad (`Gasfitería`) en SemiBold 16px + Dirección física en 13px gris.
  3. *Pie de Tarjeta:* Precio oficial en Soles (`S/ 45.00` en Mono Bold) + Botón de acción contextual ("Ver Seguimiento", "Aceptar", "Ver Detalle").
- **Borde:** `1px solid var(--border-hairline)`. Cero elevaciones desmedidas. En modo claro, una sombra sutil de física realista: `0 1px 3px rgba(0,0,0,0.06)`.

#### 3. Badge de Estado Operativo (`StatusBadge`)
- **Diseño:** Píldora compacta con padding horizontal de 8px y vertical de 4px, borde de 4px.
- **Contenido:** Indicador de punto circular sólido (6px) + Texto en mayúsculas `body-sm` peso 600.
- **Ejemplo:** Punto ámbar pulsante + `EN ESPERA DE ASIGNACIÓN`.

---

## 5. Pantallas clave: Propósito, jerarquía y los 5 estados

### 5.1. Pantalla Móvil: Inicio del Cliente (`/client/home`)
- **Propósito:** Permitir al cliente solicitar un servicio en menos de un minuto o hacer seguimiento en tiempo real del servicio en curso.
- **Jerarquía Visual:**
  1. *Acción Primaria:* Selector visual de oficio (Gasfitería, Electricidad, etc.) y botón grande `[SOLICITAR MAESTRO AHORA]`.
  2. *Acción Secundaria:* Ajuste de ubicación en mapa interactivo (tocar para mover chincheta) y adjuntar foto del desperfecto.
  3. *Acción Terciaria:* Acceso a historial y soporte telefónico.
- **Los 5 Estados Obligatorios en Pantalla:**
  - *Carga:* Skeleton screen que dibuja la silueta del mapa en gris tenue con animación de shimmer continuo mientras se resuelve la geocodificación inversa.
  - *Vacío:* Cuando no hay servicio activo, se despliega la grilla ordenada de especialidades y la dirección actual prellenada con el botón de solicitar listo para pulsar.
  - *Éxito:* Banner superior verde de 48px que informa: *"Solicitud SOL-POST-0142 creada con éxito. Central asignando técnico"*, con vibración suave.
  - *Error:* Si falla el GPS o la conexión con Firebase, se muestra un diálogo nativo: *"No pudimos obtener tu ubicación exacta. Elige tu distrito manualmente en la lista"* con selector de los 43 distritos de Lima.
  - *Sin Conexión:* Franja amarilla superior fija: *"Sin conexión a Internet. Visualizando última información guardada"*, deshabilitando el botón de envío para evitar solicitudes colgadas.

---

### 5.2. Pantalla Móvil: Seguimiento Activo del Cliente (Tarjeta de Servicio en Curso)
- **Propósito:** Brindar absoluta certidumbre al cliente durante la llegada y ejecución del técnico, garantizando la seguridad en el hogar.
- **Jerarquía Visual:**
  1. *Acción Primaria / Elemento Dominante:* **Recuadro de PIN de Seguridad (4 dígitos)** con fondo amarillo cálido y tipografía monospace grande (32px): `PIN: 4821`. Debajo, texto aclaratorio: *"Muéstrale este código al técnico al llegar a tu puerta"*.
  2. *Acción Secundaria:* Tarjeta del técnico con foto oficial, nombre completo, placa/medio de transporte y botón de acceso al chat directo.
  3. *Acción de Emergencia:* Botón de llamada telefónica inmediata a la Central de Operaciones.
- **Estados:**
  - *Técnico en camino (`ACCEPTED`):* Mapa con polilínea de trayecto y tiempo estimado (ETA: 18 min).
  - *En ejecución (`IN_PROGRESS`):* El PIN se oculta y aparece un cronómetro de trabajo con la leyenda: *"Servicio en progreso con Juan Carlos Ramos"*.
  - *Culminado (`COMPLETED`):* Despliegue de la foto del trabajo concluido, desglose del monto a pagar en Soles (`S/ 45.00`) y botones directos de Yape/Plin.

---

### 5.3. Pantalla Móvil: Operativa del Técnico (`/provider/home`)
- **Propósito:** Permitir al técnico gestionar su disponibilidad, recibir ofertas de trabajo de la central, validar la llegada con PIN y capturar la evidencia de cierre.
- **Jerarquía Visual:**
  1. *Elemento Superior:* Switch amplio de disponibilidad con estado claro: `[ DISPONIBLE ]` en verde brillante o `[ NO DISPONIBLE ]` en gris pizarra.
  2. *Oferta Entrante (Modal de Despacho):* Tarjeta de interrupción prioritaria con sonido distintivo. Muestra: Especialidad, Distrito de Lima (ej. "Los Olivos - Covida"), distancia en km y tarifa asignada (`S/ 45.00`). Dos botones: `[ACEPTAR]` (verde 52px) y `[RECHAZAR / NO PUEDO]` (borde rojo).
  3. *Servicio en Curso:* Botón `[ABRIR GOOGLE MAPS]` y botón grande para ingresar PIN del cliente.
- **Los 5 Estados Obligatorios:**
  - *Carga:* Indicador de sincronización GPS con precisión en metros.
  - *Vacío (En espera):* Radar pasivo con texto instructivo: *"Estás conectado en Zona Lima Norte. Mantén la app abierta para recibir asignaciones de la central"*.
  - *Éxito:* Pantalla completa de confirmación al validar el PIN: *"¡PIN Correcto! Servicio iniciado. Recuerda tomar fotos al terminar"*.
  - *Error:* Al fallar el PIN, mensaje en rojo con sacudida visual (`Haptics.notificationAsync(Error)`): *"PIN incorrecto. Te quedan 2 intentos antes del bloqueo de seguridad"*.
  - *Sin Conexión:* Alerta sonora y pantalla de bloqueo temporal: *"Señal GPS o datos perdidos. Acércate a una zona con cobertura para actualizar tu ubicación"*.

---

### 5.4. Pantalla Web: Bandeja de Despacho de la Central (`admin-web/Dashboard`)
- **Propósito:** Brindar al operador de la central una herramienta de trabajo rápido para despachar solicitudes, auditar tiempos y coordinar reasignaciones sin fricción.
- **Jerarquía Visual:**
  1. *Nivel Superior (Métricas en Vivo):* 4 tarjetas clave de monitoreo: Solicitudes Pendientes de Asignar (rojo/ámbar), Técnicos en Ruta (azul), Servicios en Ejecución (morado), Atenciones Concluidas Hoy (verde).
  2. *Barra de Filtros:* Selector rápido por Zona Operativa de Lima (`TODAS`, `LIMA_NORTE`, `LIMA_CENTRO`, `LIMA_SUR`, `LIMA_ESTE`, `CALLAO`), selector de Especialidad y buscador por nombre o correlativo.
  3. *Tabla Operativa:* Columnas compactas de datos con estados canónicos, tiempos de espera transcurridos con semaforización de urgencia (< 5 min verde, 5-10 min amarillo, > 10 min rojo) y botón `[ASIGNAR TÉCNICO]`.
- **Estados:**
  - *Carga:* Tabla con 8 filas de skeleton lines grises que previenen el salto de maquetación (layout shift).
  - *Vacío:* Mensaje con ícono de check: *"Bandeja al día. No hay solicitudes pendientes de asignación en este momento"*.
  - *Éxito:* Toast inferior discreto: *"Técnico Segundo Pérez asignado a la solicitud SOL-POST-0143"*.
  - *Error:* Banner persistente de reconexión a Firestore con botón manual `[RECONECTAR AHORA]`.
  - *Sin Conexión:* Badge rojo en la barra superior: *"Modo desconectado. Los cambios se sincronizarán al recuperar enlace con la base de datos"*.

---

## 6. Microcopy: Voz, tono y ejemplos reales del producto

El microcopy de *Maestro a Domicilio* destierra cualquier frase vacía de relleno ("Potencia tu experiencia", "Soluciones innovadoras a tu alcance") y se enfoca en claridad ejecutiva, vocabulario peruano estándar y transparencia absoluta:

### 6.1. Microcopy para el Cliente (Seguridad y Transparencia)
| Momento / Pantalla | Texto Incorrecto (Genérico / AI Slop) | Microcopy Oficial Canónico de Maestro a Domicilio |
| :--- | :--- | :--- |
| Creación de Solicitud | *"Explora un mundo de servicios confiables para ti"* | *"Indícanos qué falla y en qué distrito de Lima te encuentras"* |
| Tarifa Asignada | *"Precio conveniente y adaptado a tus necesidades"* | *"Tarifa oficial de visita técnica: S/ 45.00 (Tarifario 2026). Si apruebas el presupuesto en casa, este monto se descuenta del total."* |
| Espera de Asignación | *"Procesando tu requerimiento con inteligencia"* | *"Buscando un técnico calificado cerca de tu domicilio en Los Olivos..."* |
| Técnico en Camino | *"¡Tu aliado ya está en viaje hacia tu destino!"* | *"Juan Carlos Ramos va en camino a tu domicilio. Tiempo estimado: 15 a 20 min."* |
| Instrucción del PIN | *"Tu clave secreta para la magia"* | *"PIN de seguridad: 4821. Díctaselo al técnico únicamente cuando toque tu timbre."* |
| Fin de Trabajo | *"¡Esperamos que hayas amado nuestra atención!"* | *"Trabajo culminado. Revisa la foto de evidencia tomada por el técnico antes de pagar."* |
| Calificación | *"Déjanos tus comentarios sobre tu experiencia"* | *"¿El problema de gasfitería quedó resuelto correctamente? Califica el servicio."* |

### 6.2. Microcopy para el Técnico (Ergonomía y Precisión)
| Momento / Pantalla | Texto Incorrecto (Genérico) | Microcopy Oficial Canónico |
| :--- | :--- | :--- |
| Oferta entrante | *"¡Tienes una nueva oportunidad de servicio!"* | *"Nueva solicitud: Gasfitería en Jesús María (a 3.1 km). Tarifa: S/ 45.00. Tienes 90s para responder."* |
| Solicitud de PIN | *"Ingresa las credenciales del cliente"* | *"Pide el PIN de 4 dígitos al cliente para registrar tu llegada e iniciar el trabajo."* |
| Evidencia obligatoria | *"Sube archivos si lo consideras pertinente"* | *"Toma una foto clara del trabajo terminado para poder cerrar la orden y habilitar el pago."* |
| Reintentos de PIN | *"Error general de validación"* | *"PIN incorrecto. Intento 1 de 3. Verifica con el cliente el código mostrado en su app."* |

### 6.3. Microcopy para el Operador de Central (Control y Eficiencia)
| Momento / Acción | Texto Oficial en la Web Administrativa |
| :--- | :--- |
| Asignación exitosa | *"Asignación confirmada: SOL-POST-0142 despachada a técnico Segundo Pérez (Lima Norte)."* |
| Alerta de rechazo | *"ALERTA: El técnico rechazó la solicitud SOL-POST-0140 por distancia. Reasignar de inmediato."* |
| Cierre con garantía | *"Servicio validado. Se generó el Certificado de Garantía N° 2026-0842 por 30 días calendario."* |

---

## 7. Accesibilidad (WCAG 2.1 Nivel AA)

Para asegurar la inclusión de personas adultas mayores (habituales contratantes de servicios del hogar en Lima) y operarios en condiciones de trabajo difíciles:

1. **Ratios de Contraste Cromático Estricto:**
   - Texto principal negro `#0F172A` sobre fondo blanco `#FFFFFF`: **Contraste 15.8:1** (Supera ampliamente el 4.5:1 exigido por WCAG AA).
   - Texto secundario `#475569` sobre blanco: **Contraste 5.5:1** (Aprobado AA).
   - Botón Primario `#0284C7` con texto blanco: **Contraste 4.6:1** (Aprobado AA).
   - Texto de alerta ámbar `#D97706` sobre blanco: **Contraste 4.7:1** (Aprobado AA).
2. **Dimensiones de Objetivos Táctiles (Touch Targets):**
   - Todos los elementos pulsables en la app móvil (botones de especialidad, botones de llamada, selector de PIN, botones de aceptar/rechazar) tienen una altura y anchura mínima de **48×48 px**, con un espaciado perimetral mínimo de 8px para evitar pulsaciones erróneas.
3. **Soporte para Lectores de Pantalla (TalkBack en Android, VoiceOver en iOS):**
   - Todas las imágenes y fotos de evidencia cuentan con la propiedad `accessibilityLabel` descriptiva (ej. `accessibilityLabel="Fotografía de evidencia: Tubería reparada sin fugas bajo lavadero"`).
   - Los botones interactivos declaran su rol y estado (ej. `accessibilityRole="button"`, `accessibilityState={{ disabled: isSubmitting }}`).
   - El PIN de seguridad se verbaliza con separación de caracteres para lectura inequívoca: `accessibilityLabel="PIN de seguridad de cuatro dígitos: cuatro, ocho, dos, uno"`.
4. **Navegación por Teclado Completa en Panel Web:**
   - Enfoque visual visible (*focus indicator*) consistente de `2px solid #0284C7` con offset de 2px en todos los elementos interactivos.
   - Navegación lógica con tecla `Tab`, escape de modales con `Esc`, y selección en tablas con flechas direccionales.

---

## 8. Diferencias arquitectónicas: Aplicación Móvil vs. Plataforma Web

La experiencia no es un clon adaptado a la fuerza, sino una división coherente de tareas según el rol, dispositivo y entorno físico de uso:

| Criterio | Aplicación Móvil (Cliente y Técnico) | Plataforma Web (Central de Operaciones) |
| :--- | :--- | :--- |
| **Entorno Físico de Uso** | Calle, obra o domicilio; operado con una mano o mientras se atiende la casa. Movilidad constante. | Oficina o central de despacho; sentado frente a monitor de 24"-27" con teclado y mouse. |
| **Hardware Requerido** | Pantalla táctil, cámara fotográfica integrada, GPS continuo, motor de vibración háptica. | Pantalla de escritorio panorámica (16:9), conexión Ethernet/WiFi de alta velocidad, impresora PDF. |
| **Densidad de Información** | **Baja-Media (Enfocada):** Una acción principal por pantalla, texto grande, tarjetas individuales, modales limpios. | **Alta (Panorámica):** Tablas con cientos de registros, mapas con clustering de técnicos, gráficos de dispersión de tiempos. |
| **Manejo de Mapas** | Mapa reactivo táctil (`react-native-maps`) orientado a la ruta individual y posición actual. | Mapa estratégico multizona (`Leaflet`) con capas de cobertura, cuadrantes por distrito y filtros de técnicos activos. |
| **Navegación** | Bottom Tabs persistentes + Stack Navigation (`Expo Router`) + Bottom Sheets gestuales. | Barra lateral colapsable / Barra de herramientas superior + Tablas paginadas + Atajos de teclado. |
| **Notificaciones** | Push directas con vibración y sonido en primer y segundo plano (`Expo Notifications`). | Alertas visuales con badges sonoros discretos en pestaña activa y notificaciones en navegador. |
| **Emisión Documental** | Consulta de recibo digital en pantalla de resumen con opción de compartir por WhatsApp. | Generación y descarga vectorial formal en PDF de Proformas y Certificados de Garantía oficiales (A4). |

---

## 9. Checklist de verificación anti AI slop

Antes de cualquier despliegue a producción o sustentación académica, el equipo de desarrollo debe auditar la interfaz contra la siguiente lista de control obligatoria:

- [x] **Cero Gradientes Genéricos:** No existen fondos degradados azul/morado de plantilla. Todos los fondos son superficies neutras sólidas (`#F8FAFC` o `#0B1329`) con bordes de 1px realistas.
- [x] **Cero Glassmorphism Injustificado:** No se utilizan fondos translúcidos con desenfoque de fondo (*backdrop-filter: blur*) que reduzcan el contraste de lectura sobre mapas o listas.
- [x] **Cero Emojis como Iconos:** Toda la iconografía proviene de una única familia por plataforma: **Ionicons** en la app móvil y **Lucide Icons** en la plataforma web. No se mezclan librerías ni se usan caracteres emoji en botones.
- [x] **Cero Datos Falsos Anglo ("John Doe"):** Todos los datos de demostración, pruebas unitarias y manuales utilizan nombres, distritos y teléfonos auténticos del contexto de Lima Metropolitana y Callao (ej. Juan Carlos Ramos, Av. Las Palmeras en Los Olivos, celulares 9xx-xxx-xxx, precios en Soles `PEN`).
- [x] **Cero Copys Vacíos de Marketing:** No existe jerga genérica ("Lleva tu hogar al siguiente nivel"). Todo texto describe acciones concretas del servicio técnico y directivas de seguridad.
- [x] **Tipografía Rigurosamente Justificada:** La elección tipográfica está ligada a la legibilidad geométrica móvil y al alineamiento tabular de monedas, horas y códigos numéricos.
- [x] **Todos los Estados de Error Contemplados:** Ninguna pantalla queda congelada ante pérdida de red o fallas de geocodificación; existen alternativas manuales y botones de reintento.
- [x] **Trazabilidad Científica Integrada:** Los identificadores y marcas de tiempo respetan el contrato canónico para permitir la exportación de las 8 variables operativas a SPSS requeridas por la tesis.

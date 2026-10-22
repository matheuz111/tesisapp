# Sistema de diseño — Maestro a Domicilio

Define la identidad visual y las
reglas de interfaz que comparten el aplicativo móvil (React Native/Expo) y el
panel web de la central (React). La implementación de referencia está en
`src/theme.ts` (móvil), `src/context/ThemeContext.tsx` (temas claro/oscuro de
la app) y las variables CSS de `admin-web/src/index.css` (web).

## 1. Identidad de marca

Tomada del sitio institucional de la empresa (maestroadomicilio.com):

| Token | Valor | Uso |
| --- | --- | --- |
| Primario | `#0F2B46` azul marino profundo | Botones principales, encabezados, navegación |
| Acento | `#DEB11D` dorado | Insignias, estados activos, detalles de marca |
| Fondo | `#F7F8FA` | Fondo general de pantallas |
| Superficie | `#FFFFFF` | Tarjetas, formularios, modales |
| Texto | `#1A202C` / `#5B6B7B` | Texto principal / secundario |
| Éxito | `#1E9E57` | Confirmaciones, estados completados |
| Error | `#DC2626` | Errores y alertas |

En modo oscuro (app y web) el primario se aclara a `#7FB2E5` para mantener
contraste legible sobre fondos negros; el dorado de marca se conserva.

## 2. Tipografía y espaciado

- Títulos: 28 px, negrita. Subtítulos: 15 px. Cuerpo: 16 px (móvil) / 13–14 px (web).
- Escala de espaciado: 4, 8, 16, 24, 32 px.
- Radios: 8 (chico), 12 (medio — botones e inputs), 16 (tarjetas).

## 3. Componentes

- **Botón primario:** fondo azul marino, texto blanco en mayúsculas, alto 56 px
  (móvil) y radio 12. **Botón secundario:** superficie blanca con borde suave.
- **Inputs:** alto 56 px, radio 12, icono a la izquierda, borde `#E1E5EA`.
- **Tarjetas:** fondo blanco, radio 12–16, sombra suave.
- **Insignia de marca:** círculo dorado con el icono de la herramienta en azul
  marino (pantallas de acceso).

## 4. Flujo de trabajo (UX)

- El acceso distingue tres roles con destinos separados (cliente, técnico,
  central/administrador) y la navegación reproduce el ciclo de vida de la
  solicitud: creación → asignación → ejecución con validación presencial →
  evidencia → cierre → calificación.
- Registro público exclusivo de clientes; las cuentas de profesionales las
  crea la central desde el panel web (decisión de seguridad y de proceso:
  el personal es contratado por la empresa).
- Verificación de correo obligatoria antes del primer ingreso y política de
  contraseña segura con retroalimentación en tiempo real.

## 5. Responsive (panel web)

- ≥ 1180 px: barra de acciones completa.
- ≤ 1180 px: las acciones secundarias pasan al menú "más opciones".
- ≤ 1024 px: tarjetas de resumen en 2 columnas.
- ≤ 768 px: formulario en una columna, modales a ancho completo, tablas con
  desplazamiento horizontal táctil, marca compacta.
- ≤ 480 px: etiquetas de botones abreviadas y datos de usuario ocultos.

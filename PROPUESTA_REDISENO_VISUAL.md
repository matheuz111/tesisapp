# Propuesta de rediseño visual — Maestro a Domicilio (app móvil)

Objetivo: pasar de "una app que funciona" a "una marca reconocible, seria y rápida de usar", sin romper el flujo operativo ni el contraste AA que ya tiene el sistema.

## 1. Dirección visual: "Precisión industrial, cercana"

- **Carácter:** confiable como una constructora, amable como un vecino maestro. Nada de gradientes de moda ni vidrio: superficies sólidas, bordes de 1 px, un solo acento.
- **Color:** navy `#0B1329` / `#0F172A` como base, azul `#0369A1` como acción, y **un acento cálido** (ámbar `#F59E0B`) reservado para lo que requiere atención (PIN, oferta nueva, pendiente). Verde/rojo/violeta solo para estados.
- **Forma:** radios 12 px en tarjetas, píldora completa solo en navbar y chips. Iconos duotono (trazo + relleno suave) de una sola familia.
- **Tipografía:** títulos con Plus Jakarta Sans (700/800), cuerpo con la fuente del sistema, cifras con monoespaciada. Se aplicaría con un componente `Heading` propio, no globalmente.

## 2. Cambios por pantalla

| Pantalla | Hoy | Propuesta |
| --- | --- | --- |
| Splash / arranque | Logo con pulso | Casa que se dibuja, llave que encaja, texto que aparece; mismo fondo que el splash nativo |
| Login | Formulario genérico | Logo grande arriba, titular corto ("Tu hogar, en manos de maestros"), formulario en tarjeta, acceso rápido por rol |
| Home cliente | Selectores apilados | Hero con la pregunta "¿Qué necesitas arreglar?", grilla 4x2 de oficios con icono duotono, formulario en una hoja inferior que sube al elegir oficio |
| Seguimiento | Tarjeta de estado | Línea de tiempo vertical (Buscando → Asignado → En camino → En ejecución → Listo), PIN grande en tarjeta ámbar, mapa con ETA |
| Home técnico | Interruptor + radio | Control "deslizar para conectar", ganancias del día en un anillo, oferta entrante a pantalla completa con cuenta regresiva circular de 90 s |
| Historial | Lista de tarjetas | Resumen superior (reseñas, servicios, acumulado) y tarjetas compactas con estado a la izquierda |
| Chat | Burbujas verdes | Ya alineado al kit; sumar acciones rápidas ("Estoy afuera", "Llegué", "Terminé") |
| Perfil | Lista larga | Cabecera con avatar y verificación, secciones plegables, cierre de sesión al final |
| Vacíos y errores | Texto | Ilustraciones simples de herramientas con un botón de acción |
| Navegación | Píldora flotante (ya hecha) | Añadir indicador de notificaciones en Servicio cuando hay oferta o cambio de estado |

## 3. Movimiento y detalle (lo que hace sentir "premium" sin pesar)

1. Transiciones direccionales entre pestañas (ya hecho).
2. Números que cuentan (calificación, servicios, acumulado).
3. Hoja inferior con gestos para solicitar y para ofertas.
4. Respuesta háptica distinta para éxito, error y alerta.
5. Mapa con estilo propio claro/oscuro y marcador de marca.
6. Skeletons en todas las listas (parcialmente hecho).

## 4. Lote de imágenes de referencia (prompts para Muse u otro generador)

Usa todos con la misma "base de estilo" para que salgan coherentes:

> **Base de estilo (pegar al inicio de cada prompt):** *Mobile app UI design, Android, 1080x2340, flat solid surfaces, no gradients, no glassmorphism, no emojis, 1px hairline borders, 12px rounded cards, duotone line icons, Latin-American Spanish interface text, deep navy background (#0B1329) with sky blue (#0369A1) primary and amber (#F59E0B) accent, clean sans-serif typography, realistic Lima, Peru context, high legibility, professional corporate home-services brand "Maestro a Domicilio".*

1. **Splash:** *[Base] Splash screen: centered house icon in blue outline with a black wrench inside it, wordmark "maestro" in bold grey and "adomicilio.com" below, clean white background, subtle fade-in feel.*
2. **Login:** *[Base] Login screen, light theme, logo on top, headline "Tu hogar, en manos de maestros", email and password fields in a white card, a primary blue button "Iniciar sesión", small link "Olvidé mi contraseña".*
3. **Home cliente (oscuro):** *[Base] Customer home, dark theme, greeting "Hola, Rosa", question "¿Qué necesitas arreglar?", 4x2 grid of trade tiles (Gasfitería, Electricidad, Pintura, Carpintería, Albañilería, Cerrajería, Línea blanca, Otros) with duotone icons, floating pill bottom navigation with three items (Servicio active, Historial, Mi Perfil).*
4. **Solicitud:** *[Base] Bottom sheet over a map for creating a service request: selected trade chip "Gasfitería", text area "Describe el problema", photo attachment button, address row with pin icon "Av. Las Palmeras, Los Olivos", full-width blue button "Solicitar maestro".*
5. **Seguimiento con PIN:** *[Base] Active service tracking screen: vertical timeline with steps Buscando, Asignado, En camino, En ejecución, Listo; big amber card "PIN de seguridad 4821" in monospace; technician card with name "Juan Carlos Ramos", rating 4.9, call and chat buttons; map with route and "Llega en 18 min".*
6. **Home técnico:** *[Base] Technician home, dark theme, large green "slide to connect" control showing "Conectado · Listo para servicios", today's earnings ring "S/ 135", three metric cards (calificación, servicios, estado), floating bottom navigation.*
7. **Oferta entrante:** *[Base] Full-screen job offer for technician: big circular 90-second countdown ring, text "Gasfitería en Jesús María, a 3.1 km", fee "S/ 45.00" in monospace, two large buttons "Aceptar" green and "No puedo" outlined red.*
8. **Cierre y pago:** *[Base] Service completed screen for customer: evidence photo of a repaired pipe, amount "S/ 45.00", payment method chips Yape, Plin, Efectivo, five-star rating, primary button "Confirmar pago".*
9. **Estados vacíos:** *[Base] Set of four flat illustrations on navy: empty history (clipboard with tools), no connection (cloud with slash and wrench), no technicians available (map pin with clock), error (broken pipe), consistent line style with blue and amber accents.*
10. **Icono de app:** *App icon 1024x1024, white rounded-square background, blue house outline with black wrench inside, high contrast, no text.*

Para iterar: genera primero 3, 5 y 6 (las pantallas más usadas), elige la que más te guste y pídele al generador "misma paleta y estilo" para el resto.

## 5. Orden sugerido de implementación

1. Tokens: acento ámbar y componente `Heading` (medio día).
2. Home cliente: hero + grilla de oficios + hoja inferior.
3. Seguimiento: línea de tiempo + PIN ámbar.
4. Home técnico: control deslizante + oferta a pantalla completa.
5. Estados vacíos con ilustraciones.
6. Pulido de movimiento y mapa.

# 📋 Guía de Pendientes, Errores y Mejoras para el Equipo de Desarrollo

Este documento recopila las incidencias detectadas en la aplicación (UI/UX, navegación y arquitectura), con su explicación técnica detallada y la solución recomendada para que el equipo pueda resolverlas de forma ordenada.

---

## 🚨 1. ERROR CRÍTICO: "Repetir Servicio" desde el Historial lleva a pantalla obsoleta/incompleta

### 📌 Diagnóstico del Problema:
* **Archivo afectado:** `app/client/history.tsx` (Líneas 120-127).
* **Comportamiento actual:**
  Al pulsar el botón **"REPETIR"** en cualquier tarjeta del historial de un servicio anterior, el código ejecuta:
  ```tsx
  onPress={() => router.push('/client/map')}
  ```
  Esto redirige a `app/client/map.tsx`, que es una vista de mapa secundaria/antigua que:
  1. **No tiene la barra de navegación superior** (`mainNav`) con acceso al perfil (`/profile`), impidiendo que el cliente pueda **cerrar sesión**.
  2. No cuenta con la misma máquina de estados completa de `app/client/home.tsx`, por lo que si el usuario crea un pedido, no se sincroniza correctamente con la barra de cancelación persistente.

### 🛠️ Solución Recomendada para el desarrollador:
1. **Opción A (Rápida y limpia):**
   Cambiar la redirección en `app/client/history.tsx` para que vuelva a la pantalla principal oficial del cliente (`/client/home`):
   ```tsx
   onPress={() => router.replace('/client/home')}
   ```
   *(Opcional: pasar la especialidad como parámetro: `router.replace({ pathname: '/client/home', params: { category: item.specialty } })`)*.

2. **Opción B (Refactorización Arquitectónica):**
   Unificar `app/client/map.tsx` y `app/client/home.tsx` en una sola pantalla principal para evitar tener dos mapas con lógica duplicada y reglas de estado separadas.

---

## 📱 2. MEJORAS DE NAVEGACIÓN Y EXPERIENCIA DE USUARIO (UI/UX)

### A. Botón de Cerrar Sesión Accesible
* **Situación:** Actualmente para cerrar sesión el usuario debe entrar a la píldora de navegación, ir a `/profile` y presionar salir.
* **Mejora:** Agregar un botón de salida rápida o confirmación de Logout en un menú lateral (Drawer) o en el modal de perfil para mayor comodidad.

### B. Comentarios de Texto en Calificación de Servicios
* **Situación:** En el modal de calificación (`submitRating`) solo se capturan las estrellas (1 a 5).
* **Mejora:** Agregar un `TextInput` opcional para que el cliente pueda dejar una reseña escrita (ej. *"Excelente electricista, muy puntual"*), almacenando el campo `review_comment` en Firestore.

### C. Alerta de GPS Desactivado
* **Situación:** Si el usuario entra a la app con el GPS apagado, solo se muestra un spinner indefinido o alerta genérica.
* **Mejora:** Utilizar `Location.enableNetworkProviderAsync()` en Android para invocar el diálogo nativo de Google que enciende el GPS con un toque sin salir de la app.

---

## ⚡ 3. MEJORAS TÉCNICAS Y RENDIMIENTO (BACKEND & FIRESTORE)

### A. Migración de Fotos Base64 a Firebase Cloud Storage
* **Situación:** La foto de evidencia capturada por el técnico se guarda como cadena Base64 dentro del documento en Firestore (`service_requests`).
* **Riesgo:** Firestore tiene un límite estricto de **1 MB por documento**. Si la foto supera ese peso, la petición fallará con error de Firestore.
* **Mejora:** Subir el archivo binario a Firebase Storage con `uploadBytesResumable()` y guardar únicamente el enlace público `downloadURL` en el documento.

### B. Índices Compuestos de Firestore
* **Situación:** Las consultas de historial y pedidos activos utilizan filtros combinados como:
  ```javascript
  where('clientId', '==', uid), where('status', 'in', [...]), orderBy('createdAt', 'desc')
  ```
* **Mejora:** Asegurarse de tener creados los índices compuestos en la consola de Firebase para la colección `service_requests` para que las consultas no arrojen error en producción.

---

## 📝 Resumen de Archivos Clave para el Compañero:
- `app/client/history.tsx`: Cambiar la ruta del botón "Repetir" a `/client/home`.
- `app/client/home.tsx`: Pantalla principal del cliente (control de estados, pedidos y mapa).
- `app/provider/home.tsx`: Pantalla principal del técnico (validación de PIN, cronómetro y cámara).
- `app/auth/register.tsx`: Registro con validación de DNI (8 dígitos) y contraseñas seguras.
- `app/auth/login.tsx`: Login con sanitización y recuperación de contraseña.

# 🤝 GUÍA DE COORDINACIÓN DE TRABAJO EN PAREJA, GIT Y PLAN DE PRUEBAS
## PROYECTO: Maestro a Domicilio Perú (TesisApp)
**Repositorio Remoto:** `https://github.com/matheuz111/tesisapp.git`

---

## 1. PRINCIPIO DE AISLAMIENTO: CERO CONFLICTOS EN GIT

La arquitectura de `TesisApp` está diseñada de forma modular para que ambos puedan trabajar y compilar en paralelo sin que Git genere conflictos de merge:

| Desarrollador / Rol | Alcance de Archivos Permitido | Prohibido Modificar |
| :--- | :--- | :--- |
| **Amigo (QA Web & Panel Admin)** | Exclusivamente dentro de `admin-web/` (`admin-web/src/**`, `admin-web/package.json`, etc.) | Archivos fuera de `admin-web/` (`app/**`, `components/**`, `package.json` raíz) |
| **Tesista (QA Móvil & App Android)** | Exclusivamente dentro de la app móvil (`app/**`, `components/**`, `constants/**`, `hooks/**`) | Archivos dentro de `admin-web/**` |
| **Zonas Compartidas (Solo con acuerdo previo)** | `firestore.rules`, `.env.example`, colecciones de Firebase | No modificar sin avisar al otro |

> **¿Por qué esto garantiza merges limpios?**  
> Porque Git rastrea los cambios a nivel de archivo. Si tu amigo solo comitea archivos dentro de `admin-web/` y tú solo archivos dentro de `app/`, Git realiza un merge automático (**Fast-forward o 3-way merge sin conflictos**) el 100% de las veces.

---

## 2. FLUJO DE TRABAJO DIARIO EN GIT (PASO A PASO)

### Para tu Amigo (Panel Web):
```bash
# 1. Asegurarse de tener la última versión de master
git checkout master
git pull origin master

# 2. Crear o trabajar en su rama de trabajo
git checkout -b feature/web-qa-admin
# (Si la rama ya existe: git checkout feature/web-qa-admin && git pull origin master)

# 3. Realizar pruebas y mejoras en admin-web
# 4. Validar que no hay errores antes de comitear:
npm --prefix admin-web run build

# 5. Guardar cambios y subir al repositorio
git add admin-web/
git commit -m "feat(admin-web): validacion de casos CP-WEB-01 a 10 y mejoras UI"
git push -u origin feature/web-qa-admin
```

### Para Ti (App Móvil):
```bash
# 1. Asegurarse de tener la última versión de master
git checkout master
git pull origin master

# 2. Crear o trabajar en tu rama de trabajo
git checkout -b feature/mobile-qa-app
# (Si la rama ya existe: git checkout feature/mobile-qa-app && git pull origin master)

# 3. Realizar pruebas y correcciones en la app móvil
# 4. Validar que las pruebas unitarias pasen:
npm test

# 5. Guardar cambios y subir al repositorio
git add app/ components/
git commit -m "feat(mobile): ejecucion de casos CP-MOV-01 a 10 y ajuste de estados"
git push -u origin feature/mobile-qa-app
```

### Cómo Unir Todo en `master` Sin Problemas:
Cuando ambos terminen su jornada o batería de pruebas:
```bash
# En GitHub: Pueden abrir un Pull Request (PR) de cada rama hacia master.
# O por línea de comandos:
git checkout master
git pull origin master
git merge feature/web-qa-admin
git merge feature/mobile-qa-app
git push origin master
```

---

## 3. CHECKLIST PREVIO AL MERGE (DEFINITION OF DONE)
Antes de fusionar ramas a `master`:
1. [ ] En Web: `npm --prefix admin-web run build` finaliza con código 0 (sin errores de TypeScript).
2. [ ] En Móvil: `npm test` pasa 76/76 pruebas en verde.
3. [ ] Base de datos: No se borraron índices de Firestore ni credenciales locales.
4. [ ] Evidencias: Capturas de pantalla guardadas con nombres normalizados (`CAP_WEB_xx.png`, `CAP_MOV_xx.png`).

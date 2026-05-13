# Proyecto: Dashboard Haddock — Gestión de Producción

> Documento de traspaso a Claude Code / próxima IA
> Última actualización: Mayo 2026

---

## 🎯 Contexto del proyecto

**Cliente:** Haddock / Uno por Uno Media (productora audiovisual chilena)
**Usuario principal:** Joaquín (joaquin@haddock.cl)
**Objetivo:** Dashboard web para gestión de tareas y producción del equipo.

**Equipo (5 personas):**
- Sergio (admin)
- Joaquín (admin)
- María Jesús
- Tomás
- Cristóbal

**Clientes/proyectos** (17 actualmente): Pancho al Cuadrado, Mejor que Ayer, La Terapia, DROP Final, Madesur, No Bag, Ingeled, Irati Concept, La Tranca, A dos Cámaras, Haddock, Unoporuno Media, Sobec, Finanzas al Desnudo, Ropa Tendida, Modo Depa, Aquí te atreves.

---

## 🏗️ Arquitectura

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  HTML standalone│ ←─GET──→│  Apps Script     │ ←──────→│  Google Sheets  │
│  (Netlify)      │  POST   │  (Web App API)   │         │  (Base de datos)│
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                     ↓
                              ┌──────────────┐
                              │ Google Drive │
                              │ (Adjuntos)   │
                              └──────────────┘
```

**Stack:** HTML/CSS/JS vanilla (sin frameworks) + Google Apps Script + Google Sheets como DB + Google Drive para archivos.

**¿Por qué este stack?**
- Joaquín no tiene experiencia con GitHub/servidores
- Equipo de 5 personas, no necesita escalar
- Google Workspace ya está integrado en la empresa
- Setup gratuito y sin dependencias externas

---

## 🔗 Recursos del proyecto

| Recurso | URL/ID |
|---------|--------|
| Google Sheet | `1dnROxytlU2I0QqiDwiHB5B4xrennwq-cktGeYdaJOIY` |
| Sheet URL | https://docs.google.com/spreadsheets/d/1dnROxytlU2I0QqiDwiHB5B4xrennwq-cktGeYdaJOIY/edit |
| Carpeta Drive (adjuntos) | `13gqWvBbItXVt50lN5OdG8UwOsHCXOfTg` |
| Apps Script — Web App URL | https://script.google.com/macros/s/AKfycbx8zgrXs4fKDBX_atEt-bdp6nj-vs2t7MCKdDi6uuSuitL7ASa1oA6fjKCN_T4gFqKb/exec |
| Hosting actual | Netlify (URL `earnest-liger-bbaabb.netlify.app` — el slug puede cambiar al re-deploy) |

---

## 📊 Estructura de la Google Sheet

### Hoja 1 — Tareas
14 columnas (A-N):
| Col | Nombre | Tipo | Descripción |
|-----|--------|------|-------------|
| A | `id` | string | UID generado en JS |
| B | `titulo` | string | Nombre de la tarea |
| C | `cliente` | string | Cliente asignado |
| D | `proyecto` | string | Proyecto (opcional) |
| E | `estado` | string | "Pendiente" / "Trabajando" / "Resuelta" |
| F | `prioridad` | string | "alta" / "media" / "baja" |
| G | `fecha` | string | YYYY-MM-DD (fecha de entrega) |
| H | `encargados` | string | Separados por pipe `Sergio|Joaquín` |
| I | `notas` | string | Texto libre |
| J | `creado` | ISO string | Timestamp de creación |
| K | `archivos` | JSON | Array de objetos `{name, url, type, size, id}` |
| L | `creadoPor` | string | Nombre del creador |
| M | `modificadoPor` | string | Último que editó |
| N | `comentarios` | JSON | Array `{author, time, text}` |

### Hoja 2 — Clientes
Columna A: lista de nombres de clientes.

---

## ✨ Features implementadas

### Core
- ✅ Pantalla de login simple (elegir nombre del equipo, se guarda en localStorage)
- ✅ Vista personal (solo mis tareas) vs vista general (todas)
- ✅ Kanban con 3 columnas (Pendiente / Trabajando / Resuelta)
- ✅ Vista de lista alternativa
- ✅ Filtros por estado, prioridad, encargado, cliente, búsqueda
- ✅ Crear, editar y eliminar tareas

### Específicas
- ✅ **Drag & drop** entre columnas del kanban
- ✅ **Mini dashboards por cliente** con % completado (solo aparecen clientes con tareas)
- ✅ **Comentarios por tarea** (chat asincrónico al estilo Notion)
- ✅ **Notificaciones** cuando alguien te asigna una tarea nueva (banner morado en vista personal)
- ✅ **Administración de clientes** (solo Joaquín y Sergio): agregar/editar/eliminar
- ✅ **Subir archivos directos a Drive** (botón upload + barra de progreso, hasta 25MB por archivo)
- ✅ **Pegar links externos** como adjuntos alternativos
- ✅ **Refresh automático** cada 30 segundos (pausado mientras hay modal abierto o guardado en curso)
- ✅ Sincronización con indicador visual (verde/amarillo/rojo)

### Diseño
- Fondo blanco/crema con tarjetas kanban oscuras (alto contraste editorial)
- Tipografía: Bricolage Grotesque (sans) + JetBrains Mono (mono)
- Acentos: morado/rosa para vista personal, azul/cyan para vista general
- Colores de estado: 🔴 Pendiente (rojo) · 🔵 Trabajando (azul) · 🟢 Resuelta (verde)
- Logo "haddock" en negro, sin tagline

---

## 🐛 Bugs conocidos / pendientes al traspaso

### Bug activo: permisos de Drive para upload
**Status:** El upload de archivos falla con error de permisos. La función `autorizarDrive()` se agregó al Apps Script pero **NO se ejecutó manualmente** para autorizar los scopes de Drive.

**Solución pendiente:**
1. Ir a Apps Script
2. Seleccionar la función `autorizarDrive` en el dropdown
3. Click "Ejecutar"
4. Aceptar permisos de Drive (incluyendo lectura/escritura)
5. Re-implementar como nueva versión

```javascript
function autorizarDrive() {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  Logger.log('OK: ' + folder.getName());
}
```

### Otros bugs históricos (ya arreglados, dejo registro)
- ❌ Encargados se borraban después de guardar → Causa: refresh sobreescribía datos / POST con `mode:no-cors` no llegaba bien. **Fix:** usar FormData + lock durante guardado.
- ❌ Doble click en "Guardar" → Causa: botón no se deshabilitaba. **Fix:** `btn.disabled=true` al inicio del handler.
- ❌ Cliente se borraba al cambiar otro campo → Causa: refresh automático sobreescribía mientras el modal estaba abierto. **Fix:** check de `modal-overlay.classList.contains('open')` antes de hacer `loadData()`.
- ❌ Fecha no se guardaba → Causa: Sheets convertía string a Date object al guardar. **Fix:** en `doGet`, detectar si es `Date` y convertir a `YYYY-MM-DD`.

---

## 🚀 Features pendientes / wishlist

Cosas que Joaquín mencionó pero no se implementaron (algunas por decisión):
- ❌ **Chat interno general** — descartado, equipo usa WhatsApp
- ❌ **Fotos de perfil con Gravatar** — descartado, se quedaron iniciales con colores
- ⏳ **Notificaciones push** (email/WhatsApp cuando asignen tarea) — no implementado
- ⏳ **Historial de cambios** por tarea (quién hizo qué y cuándo) — no implementado
- ⏳ **Vista calendario** de tareas con fecha — no implementado
- ⏳ **Exportar reportes** (PDF/Excel mensual) — no implementado
- ⏳ **Permisos granulares** (ej: que un encargado no pueda eliminar tareas de otro) — no implementado, hoy todos pueden todo

---

## 💡 Decisiones de diseño importantes

1. **Sin frameworks JS** — todo vanilla, un solo archivo HTML. Razón: simplicidad de despliegue y mantenimiento por alguien no-técnico.

2. **Estado en localStorage** — el usuario "logueado" se guarda en el navegador, no en servidor. Es básicamente un selector de nombre, no autenticación real. Razón: el equipo es interno y de confianza.

3. **Refresh polling cada 30s** — no websockets ni server-sent events. Apps Script no los soporta bien. Aceptable porque el equipo es pequeño y los cambios no son críticos en tiempo real.

4. **Carpeta única de adjuntos en Drive** — Joaquín eligió esto sobre carpetas por cliente/tarea. Permisos manejados a nivel de carpeta (solo equipo Haddock con acceso).

5. **Optimistic UI** — los cambios se ven en pantalla *antes* de confirmar con el servidor, para sentir respuesta inmediata. Después se sincroniza. Si falla, se notifica con el indicador de sync.

6. **Admins hardcodeados** en JS: `const ADMINS = ['Sergio','Joaquín'];` — esto controla quién ve el botón "Administrar clientes".

---

## 📁 Archivos del proyecto

### 1. Apps Script (`Código.gs` en Google Apps Script "Haddock Dashboard")

```javascript
const SHEET_ID = '1dnROxytlU2I0QqiDwiHB5B4xrennwq-cktGeYdaJOIY';
const FOLDER_ID = '13gqWvBbItXVt50lN5OdG8UwOsHCXOfTg';

function autorizarDrive() {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  Logger.log('OK: ' + folder.getName());
}

function doGet(e) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const tasksSheet = ss.getSheets()[0];
  const clientsSheet = ss.getSheetByName('Clientes');

  const tData = tasksSheet.getDataRange().getValues();
  const tHeaders = tData[0];
  const tasks = [];
  for (let i = 1; i < tData.length; i++) {
    const row = tData[i];
    if (!row[0]) continue;
    const obj = {};
    tHeaders.forEach((h, idx) => {
      if (h === 'encargados') {
        obj[h] = row[idx] ? String(row[idx]).split('|').filter(Boolean) : [];
      } else if (h === 'archivos' || h === 'comentarios') {
        try { obj[h] = row[idx] ? JSON.parse(row[idx]) : []; }
        catch(_) {
          if (h === 'archivos' && row[idx]) {
            obj[h] = String(row[idx]).split('|').filter(Boolean).map(url => ({name: url, url: url, type: 'link'}));
          } else { obj[h] = []; }
        }
      } else if (h === 'fecha') {
        if (row[idx] instanceof Date) {
          const d = row[idx];
          obj[h] = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
        } else {
          obj[h] = row[idx] || '';
        }
      } else {
        obj[h] = row[idx] || '';
      }
    });
    tasks.push(obj);
  }

  const clientes = [];
  if (clientsSheet) {
    const cData = clientsSheet.getDataRange().getValues();
    for (let i = 1; i < cData.length; i++) {
      if (cData[i][0]) clientes.push(String(cData[i][0]));
    }
  }

  return out({tasks: tasks, clientes: clientes});
}

function doPost(e) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheets()[0];
  const clientsSheet = ss.getSheetByName('Clientes');

  let params;
  if (e.parameter && e.parameter.payload) {
    params = JSON.parse(e.parameter.payload);
  } else if (e.postData && e.postData.contents) {
    try { params = JSON.parse(e.postData.contents); }
    catch(_) { return out({ok: false, error: 'Bad data'}); }
  } else {
    return out({ok: false, error: 'No data'});
  }

  const action = params.action;

  if (action === 'uploadFile') {
    try {
      const folder = DriveApp.getFolderById(FOLDER_ID);
      const blob = Utilities.newBlob(
        Utilities.base64Decode(params.fileData),
        params.mimeType,
        params.fileName
      );
      const file = folder.createFile(blob);
      return out({
        ok: true,
        file: {
          name: params.fileName,
          url: file.getUrl(),
          id: file.getId(),
          type: 'drive',
          size: file.getSize()
        }
      });
    } catch(err) {
      return out({ok: false, error: String(err)});
    }
  }

  if (action === 'create') {
    const t = params.task;
    sheet.appendRow([
      t.id, t.titulo, t.cliente, t.proyecto, t.estado,
      t.prioridad, t.fecha, (t.encargados || []).join('|'),
      t.notas, new Date().toISOString(),
      JSON.stringify(t.archivos || []),
      t.creadoPor || '', t.modificadoPor || '',
      JSON.stringify(t.comentarios || [])
    ]);
    return out({ok: true, id: t.id});
  }

  if (action === 'update') {
    const t = params.task;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === t.id) {
        sheet.getRange(i + 1, 1, 1, 14).setValues([[
          t.id, t.titulo, t.cliente, t.proyecto, t.estado,
          t.prioridad, t.fecha, (t.encargados || []).join('|'),
          t.notas, data[i][9] || new Date().toISOString(),
          JSON.stringify(t.archivos || []),
          data[i][11] || t.creadoPor || '',
          t.modificadoPor || '',
          JSON.stringify(t.comentarios || [])
        ]]);
        return out({ok: true});
      }
    }
    return out({ok: false, error: 'Task not found'});
  }

  if (action === 'addComment') {
    const id = params.id;
    const comment = params.comment;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        let comentarios = [];
        try { comentarios = data[i][13] ? JSON.parse(data[i][13]) : []; }
        catch(_) { comentarios = []; }
        comentarios.push(comment);
        sheet.getRange(i + 1, 14).setValue(JSON.stringify(comentarios));
        return out({ok: true});
      }
    }
    return out({ok: false});
  }

  if (action === 'delete') {
    const id = params.id;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.deleteRow(i + 1);
        return out({ok: true});
      }
    }
    return out({ok: false});
  }

  if (action === 'addClient') {
    const nombre = (params.nombre || '').trim();
    if (!nombre) return out({ok: false});
    clientsSheet.appendRow([nombre]);
    return out({ok: true});
  }

  if (action === 'editClient') {
    const oldName = params.oldName;
    const newName = (params.newName || '').trim();
    if (!newName) return out({ok: false});
    const data = clientsSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === oldName) {
        clientsSheet.getRange(i + 1, 1).setValue(newName);
        return out({ok: true});
      }
    }
    return out({ok: false});
  }

  if (action === 'deleteClient') {
    const nombre = params.nombre;
    const data = clientsSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === nombre) {
        clientsSheet.deleteRow(i + 1);
        return out({ok: true});
      }
    }
    return out({ok: false});
  }

  return out({ok: false, error: 'Unknown action'});
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### 2. HTML del dashboard
El archivo `dashboard-haddock.html` es el frontend completo. Se adjunta como archivo separado.

---

## 🛠️ Cómo continuar el desarrollo

### Para Claude Code (recomendado)

1. **Inicia Claude Code** en una carpeta nueva
2. **Pega este documento** + el archivo HTML
3. **Pídele** que lea ambos archivos y te confirme que entiende el proyecto
4. **Itera localmente**: Claude Code puede editar el HTML, probar cambios localmente, y tú solo subes a Netlify cuando todo esté listo

### Flujo de desarrollo

```
Editar HTML local → Probar abriendo en navegador (doble click) →
Si funciona → Arrastrar a app.netlify.com/drop para deployar
```

### Para cambios en el backend (Apps Script)

1. Editar `Código.gs` en https://script.google.com → proyecto "Haddock Dashboard"
2. Cmd+S para guardar
3. **Implementar → Administrar implementaciones → Editar → Nueva versión → Implementar**
   - Importante: editar la implementación existente, no crear una nueva (para no cambiar la URL)

### Si se agregan columnas a la Sheet
1. Agregar columna en Sheet con su nombre
2. Actualizar `doGet` para leerla
3. Actualizar `doPost` (acciones create + update) para escribirla
4. Actualizar HTML para incluirla en el form y el render

---

## 🎬 Cierre

Joaquín no es desarrollador. El proyecto se construyó iterativamente en chat con Claude, paso a paso. Cualquier cambio futuro debe explicarse en lenguaje no-técnico y los pasos manuales (pegar código, implementar, subir a Netlify) deben quedar absolutamente claros con capturas o instrucciones precisas.

El equipo Haddock va a usar este dashboard diariamente. Estabilidad > features nuevas.

**Buena suerte 🚀**

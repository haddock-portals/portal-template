const SHEET_ID = '1dnROxytlU2I0QqiDwiHB5B4xrennwq-cktGeYdaJOIY';
const FOLDER_ID = '13gqWvBbItXVt50lN5OdG8UwOsHCXOfTg';
const DASHBOARD_URL = 'https://dashboardhaddock.netlify.app';

// ⚠️ Completar con los emails reales del equipo
const TEAM_EMAILS = {
  'Sergio':      'sergio@haddock.cl',
  'Joaquín':     'joaquin@haddock.cl',
  'María Jesús': 'mj@haddock.cl',
  'Tomás':       'tomas@haddock.cl',
  'Cristóbal':   'cristobal@haddock.cl',
  'Constanza':   'constanza@haddock.cl'
};

// Ejecutar esta función UNA VEZ para autorizar Drive y Mail
function autorizarTodo() {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  Logger.log('Drive OK: ' + folder.getName());
  const quota = MailApp.getRemainingDailyQuota();
  Logger.log('Mail OK, cuota restante: ' + quota);
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
      } else if (['archivos', 'comentarios', 'historial'].includes(h)) {
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

  // ── UPLOAD ARCHIVO ────────────────────────────────────────────
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

  // ── CREAR TAREA ───────────────────────────────────────────────
  if (action === 'create') {
    const t = params.task;
    const historial = [{
      user: t.creadoPor || '',
      time: new Date().toISOString(),
      action: 'Tarea creada'
    }];
    sheet.appendRow([
      t.id, t.titulo, t.cliente, t.proyecto, t.estado,
      t.prioridad, t.fecha, (t.encargados || []).join('|'),
      t.notas, new Date().toISOString(),
      JSON.stringify(t.archivos || []),
      t.creadoPor || '', t.modificadoPor || '',
      JSON.stringify(t.comentarios || []),
      JSON.stringify(historial)          // Columna O
    ]);
    notificarAsignacion(t.encargados || [], t, t.creadoPor, true);
    return out({ok: true, id: t.id});
  }

  // ── ACTUALIZAR TAREA ──────────────────────────────────────────
  if (action === 'update') {
    const t = params.task;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] !== t.id) continue;

      // Leer historial anterior
      let historial = [];
      try { historial = data[i][14] ? JSON.parse(data[i][14]) : []; }
      catch(_) { historial = []; }

      // Detectar cambios de campos relevantes
      const prevEncargados = data[i][7] ? String(data[i][7]).split('|').filter(Boolean) : [];
      const changes = [];

      [
        [1, 'Título',    t.titulo],
        [2, 'Cliente',   t.cliente],
        [4, 'Estado',    t.estado],
        [5, 'Prioridad', t.prioridad],
        [6, 'Fecha',     t.fecha]
      ].forEach(([idx, label, newVal]) => {
        let prev = data[i][idx];
        if (prev instanceof Date) {
          prev = prev.getFullYear() + '-' + String(prev.getMonth()+1).padStart(2,'0') + '-' + String(prev.getDate()).padStart(2,'0');
        }
        if (String(prev||'') !== String(newVal||'')) {
          changes.push({field: label, from: String(prev||''), to: String(newVal||'')});
        }
      });

      const prevEncStr = prevEncargados.slice().sort().join(',');
      const newEncStr  = (t.encargados||[]).slice().sort().join(',');
      if (prevEncStr !== newEncStr) {
        changes.push({field: 'Encargados', from: prevEncargados.join(', '), to: (t.encargados||[]).join(', ')});
      }

      if (changes.length > 0) {
        historial.push({
          user: t.modificadoPor || '',
          time: new Date().toISOString(),
          changes: changes
        });
      }

      // Notificar solo a encargados recién agregados
      const prevSet = new Set(prevEncargados);
      const nuevos  = (t.encargados||[]).filter(e => !prevSet.has(e));
      if (nuevos.length > 0) notificarAsignacion(nuevos, t, t.modificadoPor, false);

      sheet.getRange(i + 1, 1, 1, 15).setValues([[
        t.id, t.titulo, t.cliente, t.proyecto, t.estado,
        t.prioridad, t.fecha, (t.encargados || []).join('|'),
        t.notas, data[i][9] || new Date().toISOString(),
        JSON.stringify(t.archivos || []),
        data[i][11] || t.creadoPor || '',
        t.modificadoPor || '',
        JSON.stringify(t.comentarios || []),
        JSON.stringify(historial)
      ]]);
      return out({ok: true});
    }
    return out({ok: false, error: 'Task not found'});
  }

  // ── AGREGAR COMENTARIO ────────────────────────────────────────
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

  // ── ELIMINAR TAREA ────────────────────────────────────────────
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

  // ── CLIENTES ──────────────────────────────────────────────────
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

// ── EMAIL DE NOTIFICACIÓN ─────────────────────────────────────
function notificarAsignacion(encargados, tarea, remitente, esNueva) {
  try {
    encargados.forEach(enc => {
      const email = TEAM_EMAILS[enc];
      if (!email || enc === remitente) return;
      const asunto = esNueva
        ? '[Haddock] Nueva tarea: ' + tarea.titulo
        : '[Haddock] Te agregaron a: ' + tarea.titulo;
      const cuerpo = '<div style="font-family:sans-serif;max-width:520px;margin:0 auto;background:#fafaf7;padding:32px;border-radius:12px">'
        + '<div style="font-size:28px;font-weight:700;letter-spacing:-.04em;margin-bottom:24px;color:#0a0a0a">haddock</div>'
        + '<p style="margin:0 0 8px">Hola <b>' + enc + '</b>,</p>'
        + '<p style="margin:0 0 20px;color:#444"><b>' + remitente + '</b> te ' + (esNueva ? 'asignó una nueva tarea' : 'agregó a una tarea') + ':</p>'
        + '<div style="background:#fff;border:1px solid #e8e6df;border-radius:12px;padding:20px;margin-bottom:24px">'
        + '<div style="font-size:10px;color:#7a7770;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">' + (tarea.cliente||'') + '</div>'
        + '<div style="font-size:18px;font-weight:600;color:#0a0a0a;margin-bottom:10px">' + tarea.titulo + '</div>'
        + (tarea.notas ? '<div style="font-size:13px;color:#555;margin-bottom:12px">' + tarea.notas + '</div>' : '')
        + '<div style="font-size:12px;color:#7a7770">Estado: <b>' + tarea.estado + '</b>'
        + ' &nbsp;·&nbsp; Prioridad: <b>' + tarea.prioridad + '</b>'
        + (tarea.fecha ? ' &nbsp;·&nbsp; Fecha: <b>' + tarea.fecha + '</b>' : '')
        + '</div></div>'
        + '<a href="' + DASHBOARD_URL + '" style="display:inline-block;background:#0a0a0a;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px">Ver en el dashboard →</a>'
        + '</div>';
      MailApp.sendEmail({to: email, subject: asunto, htmlBody: cuerpo});
    });
  } catch(err) {
    Logger.log('Error de email: ' + err);
  }
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

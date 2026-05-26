const SHEET_ID = '1dnROxytlU2I0QqiDwiHB5B4xrennwq-cktGeYdaJOIY';
const FOLDER_ID = '13gqWvBbItXVt50lN5OdG8UwOsHCXOfTg';

function autorizarDrive() {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  Logger.log('OK: ' + folder.getName());
}

// ─── GET ───────────────────────────────────────────────────────────
function doGet(e) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const tasksSheet = ss.getSheets()[0];
  const clientsSheet = ss.getSheetByName('Clientes');

  // Portal mode: autenticación por cliente + código
  if (e.parameter && e.parameter.portal === '1') {
    return handlePortalGet(e, ss, tasksSheet, clientsSheet);
  }

  // Dashboard interno (comportamiento original)
  const tData = tasksSheet.getDataRange().getValues();
  const tHeaders = tData[0];
  const tasks = [];
  for (let i = 1; i < tData.length; i++) {
    const row = tData[i];
    if (!row[0]) continue;
    tasks.push(parseTaskRow(tHeaders, row));
  }

  const clientes = [];
  if (clientsSheet) {
    const cData = clientsSheet.getDataRange().getValues();
    for (let i = 1; i < cData.length; i++) {
      if (cData[i][0]) clientes.push(String(cData[i][0]));
    }
  }

  return out({ tasks, clientes });
}

// ─── PORTAL GET ────────────────────────────────────────────────────
function handlePortalGet(e, ss, tasksSheet, clientsSheet) {
  const slug   = (e.parameter.cliente || '').trim().toLowerCase();
  const codigo = (e.parameter.codigo  || '').trim();

  if (!slug || !codigo) {
    return out({ ok: false, error: 'Parámetros faltantes' });
  }

  // Buscar cliente en la hoja Clientes y verificar código
  // Columnas: A=nombre  B=codigo  C=color  D=descripcion  E=logo
  const cData = clientsSheet ? clientsSheet.getDataRange().getValues() : [];
  let clientName  = null;
  let clientColor = '#6366f1';
  let clientDesc  = '';
  let clientLogo  = '';

  for (let i = 1; i < cData.length; i++) {
    const rowName = String(cData[i][0] || '').trim();
    if (!rowName) continue;
    if (slugify(rowName) === slug) {
      const storedCode = String(cData[i][1] || '').trim();
      if (!storedCode || storedCode !== codigo) {
        return out({ ok: false, error: 'Código incorrecto' });
      }
      clientName  = rowName;
      clientColor = String(cData[i][2] || '').trim() || '#6366f1';
      clientDesc  = String(cData[i][3] || '').trim();
      clientLogo  = String(cData[i][4] || '').trim();
      break;
    }
  }

  if (!clientName) {
    return out({ ok: false, error: 'Cliente no encontrado' });
  }

  // Filtrar tareas de este cliente
  const tData    = tasksSheet.getDataRange().getValues();
  const tHeaders = tData[0];
  const tasks    = [];

  for (let i = 1; i < tData.length; i++) {
    const row = tData[i];
    if (!row[0]) continue;
    const task = parseTaskRow(tHeaders, row);
    if (String(task.cliente || '').toLowerCase() === clientName.toLowerCase()) {
      tasks.push(task);
    }
  }

  // Solo tareas marcadas como visibles en portal
  const visibleTasks = tasks.filter(t => t.visible_cliente === 'Sí');

  // Cargar estrategia del cliente
  let estrategia = null;
  try {
    let estratSheet = ss.getSheetByName('Estrategia');
    if (!estratSheet) estratSheet = ss.insertSheet('Estrategia');
    const eData = estratSheet.getDataRange().getValues();
    for (let i = 0; i < eData.length; i++) {
      if (slugify(String(eData[i][0] || '')) === slug) {
        try { estrategia = JSON.parse(eData[i][1]); } catch(_) {}
        break;
      }
    }
  } catch(_) {}

  return out({ ok: true, cliente: clientName, clientColor, clientDesc, clientLogo, tasks: visibleTasks, estrategia });
}

// ─── POST ──────────────────────────────────────────────────────────
function doPost(e) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheets()[0];
  const clientsSheet = ss.getSheetByName('Clientes');

  let params;
  if (e.parameter && e.parameter.payload) {
    params = JSON.parse(e.parameter.payload);
  } else if (e.postData && e.postData.contents) {
    try { params = JSON.parse(e.postData.contents); }
    catch(_) { return out({ ok: false, error: 'Bad data' }); }
  } else {
    return out({ ok: false, error: 'No data' });
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
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      return out({
        ok: true,
        file: {
          name: params.fileName,
          url:  file.getUrl(),
          id:   file.getId(),
          type: params.mimeType,
          size: file.getSize()
        }
      });
    } catch(err) {
      return out({ ok: false, error: String(err) });
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
      JSON.stringify(t.comentarios || []),
      t.visible_cliente || 'No'
    ]);
    return out({ ok: true, id: t.id });
  }

  if (action === 'update') {
    const t    = params.task;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === t.id) {
        sheet.getRange(i + 1, 1, 1, 15).setValues([[
          t.id, t.titulo, t.cliente, t.proyecto, t.estado,
          t.prioridad, t.fecha, (t.encargados || []).join('|'),
          t.notas, data[i][9] || new Date().toISOString(),
          JSON.stringify(t.archivos || []),
          data[i][11] || t.creadoPor || '',
          t.modificadoPor || '',
          JSON.stringify(t.comentarios || []),
          t.visible_cliente || data[i][14] || 'No'
        ]]);
        return out({ ok: true });
      }
    }
    return out({ ok: false, error: 'Task not found' });
  }

  if (action === 'addComment') {
    const id      = params.id;
    const comment = params.comment;
    const data    = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        let comentarios = [];
        try { comentarios = data[i][13] ? JSON.parse(data[i][13]) : []; }
        catch(_) { comentarios = []; }
        comentarios.push(comment);
        sheet.getRange(i + 1, 14).setValue(JSON.stringify(comentarios));
        return out({ ok: true });
      }
    }
    return out({ ok: false });
  }

  if (action === 'delete') {
    const id   = params.id;
    const data = sheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === id) {
        sheet.deleteRow(i + 1);
        return out({ ok: true });
      }
    }
    return out({ ok: false });
  }

  if (action === 'addClient') {
    const nombre = (params.nombre || '').trim();
    if (!nombre) return out({ ok: false });
    clientsSheet.appendRow([nombre, params.codigo || '', params.color || '', params.descripcion || '', params.logo || '']);
    return out({ ok: true });
  }

  if (action === 'editClient') {
    const oldName = params.oldName;
    const newName = (params.newName || '').trim();
    if (!newName) return out({ ok: false });
    const data = clientsSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === oldName) {
        clientsSheet.getRange(i + 1, 1).setValue(newName);
        if (params.codigo      !== undefined) clientsSheet.getRange(i + 1, 2).setValue(params.codigo);
        if (params.color       !== undefined) clientsSheet.getRange(i + 1, 3).setValue(params.color);
        if (params.descripcion !== undefined) clientsSheet.getRange(i + 1, 4).setValue(params.descripcion);
        if (params.logo        !== undefined) clientsSheet.getRange(i + 1, 5).setValue(params.logo);
        return out({ ok: true });
      }
    }
    return out({ ok: false });
  }

  if (action === 'deleteClient') {
    const nombre = params.nombre;
    const data   = clientsSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === nombre) {
        clientsSheet.deleteRow(i + 1);
        return out({ ok: true });
      }
    }
    return out({ ok: false });
  }

  if (action === 'saveEstrategia') {
    const clienteSlug = slugify(params.cliente || '');
    const dataJson = JSON.stringify(params.data || {});
    let estratSheet = ss.getSheetByName('Estrategia');
    if (!estratSheet) estratSheet = ss.insertSheet('Estrategia');
    const eData = estratSheet.getDataRange().getValues();
    for (let i = 0; i < eData.length; i++) {
      if (slugify(String(eData[i][0] || '')) === clienteSlug) {
        estratSheet.getRange(i + 1, 2).setValue(dataJson);
        return out({ ok: true });
      }
    }
    estratSheet.appendRow([params.cliente, dataJson]);
    return out({ ok: true });
  }

  return out({ ok: false, error: 'Unknown action' });
}

// ─── HELPERS ───────────────────────────────────────────────────────
function parseTaskRow(headers, row) {
  const obj = {};
  headers.forEach((h, idx) => {
    if (h === 'encargados') {
      obj[h] = row[idx] ? String(row[idx]).split('|').filter(Boolean) : [];
    } else if (h === 'archivos' || h === 'comentarios') {
      try { obj[h] = row[idx] ? JSON.parse(row[idx]) : []; }
      catch(_) {
        if (h === 'archivos' && row[idx]) {
          obj[h] = String(row[idx]).split('|').filter(Boolean)
            .map(url => ({ name: url, url, type: 'link' }));
        } else { obj[h] = []; }
      }
    } else if (h === 'fecha') {
      if (row[idx] instanceof Date) {
        const d = row[idx];
        obj[h] = d.getFullYear() + '-'
          + String(d.getMonth() + 1).padStart(2, '0') + '-'
          + String(d.getDate()).padStart(2, '0');
      } else {
        obj[h] = row[idx] || '';
      }
    } else {
      obj[h] = row[idx] || '';
    }
  });
  return obj;
}

function slugify(str) {
  return String(str)
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

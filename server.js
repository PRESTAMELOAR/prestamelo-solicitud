const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '127.0.0.1';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'prestamelo123';
const DATA_FILE = path.join(__dirname, 'loans.json');

function readLoans() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return Array.isArray(data.loans) ? data.loans : [];
  } catch {
    return [];
  }
}

function writeLoans(loans) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ loans }, null, 2));
}

function send(res, status, body, type = 'text/html; charset=utf-8', extra = {}) {
  res.writeHead(status, { 'Content-Type': type, ...extra });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), 'application/json; charset=utf-8');
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 10 * 1024 * 1024) {
        reject(new Error('Request demasiado grande'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('JSON invalido'));
      }
    });
    req.on('error', reject);
  });
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

function adminOk(req) {
  const header = String(req.headers.authorization || '');
  const match = header.match(/^Basic\s+(.+)$/i);
  if (!match) return false;
  const decoded = Buffer.from(match[1], 'base64').toString('utf8');
  return decoded === `${ADMIN_USERNAME}:${ADMIN_PASSWORD}`;
}

function requireAdmin(req, res) {
  if (adminOk(req)) return true;
  sendJson(res, 401, { ok: false, error: 'Unauthorized' },);
  return false;
}

function layout(title, body, extraHead = '') {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <style>
    :root{--bg:#f4f7f6;--panel:#fff;--text:#172126;--muted:#62737a;--line:#dbe5e5;--brand:#0c7a63;--brand-dark:#075b4b;--soft:#eef5f3;--shadow:0 18px 48px rgba(23,33,38,.14)}
    *{box-sizing:border-box} body{margin:0;background:var(--bg);color:var(--text);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    a{text-decoration:none;color:inherit} button,input,select,textarea{font:inherit} button{cursor:pointer}
    .shell{width:min(1180px,calc(100% - 32px));margin:0 auto}.hero{padding:28px 0 18px}.brand{font-size:28px;font-weight:900;color:var(--brand)}
    .sub{margin:8px 0 0;color:var(--muted);line-height:1.45}.card,.record{background:var(--panel);border:1px solid var(--line);border-radius:8px;box-shadow:var(--shadow)}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.field{display:flex;flex-direction:column;gap:6px}.full{grid-column:1/-1}
    label{color:var(--muted);font-size:12px;font-weight:800;text-transform:uppercase} input,select,textarea{width:100%;min-height:44px;border:1px solid var(--line);border-radius:8px;padding:10px;background:#fff;color:var(--text)}
    textarea{min-height:90px;resize:vertical}.btn{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:10px 14px;border-radius:8px;border:0;background:var(--brand);color:#fff;font-weight:850}
    .btn.secondary{background:var(--soft);color:var(--text);border:1px solid var(--line)} .btn:hover{background:var(--brand-dark)} .btn.secondary:hover{background:#ddeae7}
    .topbar{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;margin-bottom:18px}.metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:18px}
    .metric{padding:16px}.metric span{font-size:12px;color:var(--muted);font-weight:800;text-transform:uppercase}.metric strong{display:block;margin-top:8px;font-size:28px}
    .records{display:grid;gap:12px}.record{padding:14px}.record h3{margin:0 0 8px;font-size:18px}.meta{display:flex;flex-wrap:wrap;gap:8px;color:var(--muted);font-size:14px;margin-bottom:10px}
    .pill{display:inline-flex;align-items:center;min-height:26px;padding:4px 8px;border-radius:999px;background:var(--soft);font-size:12px;font-weight:800;text-transform:uppercase}
    .photos{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.photos img{width:92px;height:68px;object-fit:cover;border-radius:8px;border:1px solid var(--line)}
    .split{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:18px;align-items:start}.panel{padding:18px}.msg{display:none;margin-top:12px;padding:12px;border-radius:8px;background:#fff7e8;color:#5f3b0e;border:1px solid #f3d39d}
    .msg.show{display:block} .small{font-size:13px;color:var(--muted);line-height:1.4} .row{display:flex;gap:10px;flex-wrap:wrap}
    @media (max-width:900px){.split,.metrics,.grid{grid-template-columns:1fr}.shell{width:min(100%,calc(100% - 24px))}}
  </style>
  ${extraHead}
</head>
<body>${body}</body></html>`;
}

function homePage() {
  return layout('Prestamelo', `<div class="shell">
    <section class="hero">
      <div class="brand">PRESTAMELO</div>
      <h1>Solicitud con vehiculo y panel administrador</h1>
      <p class="sub">Un solo sistema para cargar la solicitud, guardar fotos del vehiculo y revisar todo desde el administrador.</p>
    </section>
    <div class="grid">
      <a class="card panel" href="/prestamo"><h2>Cliente</h2><p class="sub">Carga sus datos, el vehiculo y las fotos para iniciar la evaluacion.</p><div style="margin-top:16px"><span class="btn">Abrir formulario</span></div></a>
      <a class="card panel" href="/admin"><h2>Administrador</h2><p class="sub">Ve todas las solicitudes, fotos, datos del auto y estado comercial.</p><div style="margin-top:16px"><span class="btn secondary">Entrar al panel</span></div></a>
    </div>
  </div>`);
}

function clientPage() {
  return layout('Solicitud Prestamelo', `<div class="shell">
    <section class="hero">
      <div class="brand">PRESTAMELO</div>
      <h1>Converti tu auto en efectivo. Hoy.</h1>
      <p class="sub">Completa los datos del vehiculo y envia la solicitud. Un asesor la revisa y te responde para continuar.</p>
    </section>
    <form id="loanForm" class="card panel">
      <div class="grid">
        <div class="field"><label for="name">Nombre</label><input id="name" required autocomplete="name"></div>
        <div class="field"><label for="phone">WhatsApp</label><input id="phone" required autocomplete="tel"></div>
        <div class="field"><label for="brand">Marca</label><input id="brand" required></div>
        <div class="field"><label for="model">Modelo</label><input id="model" required></div>
        <div class="field"><label for="version">Version</label><input id="version" required></div>
        <div class="field"><label for="year">Ano</label><input id="year" required inputmode="numeric"></div>
        <div class="field"><label for="mileage">Kilometraje</label><input id="mileage" required type="number" min="0" step="1000"></div>
        <div class="field"><label for="location">Radicacion</label><input id="location" required placeholder="Provincia/localidad"></div>
        <div class="field"><label for="owner">Sos titular?</label><select id="owner" required><option value="">Seleccionar</option><option value="Si, soy titular">Si, soy titular</option><option value="No soy titular">No soy titular</option></select></div>
        <div class="field full"><label for="photos">Fotos del vehiculo</label><input id="photos" type="file" accept="image/*" multiple><span class="small">Subi frente, laterales, interior/tablero y documentacion si la tenes.</span><div class="photos" id="preview"></div></div>
        <div class="field full"><label for="notes">Comentario adicional</label><textarea id="notes"></textarea></div>
      </div>
      <div class="row" style="margin-top:16px;justify-content:space-between;align-items:center">
        <span class="small">No pedimos pago por completar esta solicitud.</span>
        <button class="btn" id="submitBtn" type="submit">Enviar solicitud</button>
      </div>
      <div class="msg" id="message"></div>
    </form>
  </div>`, `<script>
    let selectedPhotos = [];
    const el = (id) => document.getElementById(id);
    function showMessage(text){ el('message').textContent = text; el('message').classList.add('show'); }
    function fileToDataUrl(file){ return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onerror=reject; r.onload=()=>resolve({ name:file.name, type:file.type || 'image/jpeg', dataUrl:r.result }); r.readAsDataURL(file); }); }
    el('photos').addEventListener('change', async (event) => {
      selectedPhotos = [];
      el('preview').innerHTML = '';
      for (const file of Array.from(event.target.files || []).slice(0,8)) {
        const photo = await fileToDataUrl(file);
        selectedPhotos.push(photo);
        const img = document.createElement('img');
        img.src = photo.dataUrl;
        img.alt = photo.name;
        el('preview').appendChild(img);
      }
    });
    el('loanForm').addEventListener('submit', async (event) => {
      event.preventDefault();
      el('submitBtn').disabled = true;
      const payload = {
        applicantName: el('name').value.trim(),
        phone: el('phone').value.trim(),
        vehicleBrand: el('brand').value.trim(),
        vehicleModel: el('model').value.trim(),
        vehicleVersion: el('version').value.trim(),
        vehicleYear: el('year').value.trim(),
        vehicleMileage: el('mileage').value,
        vehicleRegistration: el('location').value.trim(),
        isVehicleOwner: el('owner').value,
        notes: el('notes').value.trim(),
        photos: selectedPhotos
      };
      const response = await fetch('/api/loans', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
      const data = await response.json();
      el('submitBtn').disabled = false;
      if (!response.ok) { showMessage(data.error || 'No se pudo enviar la solicitud.'); return; }
      event.target.reset();
      selectedPhotos = [];
      el('preview').innerHTML = '';
      showMessage('Solicitud enviada. Ya la podes revisar desde el panel administrador.');
    });
  </script>`);
}

function adminPage() {
  return layout('Prestamelo Admin', `<div class="shell">
    <section class="hero">
      <div class="topbar">
        <div>
          <div class="brand">PRESTAMELO ADMIN</div>
          <h1>Panel administrador</h1>
          <p class="sub">Revisa todas las solicitudes, fotos del vehiculo y datos de contacto.</p>
        </div>
        <div class="row">
          <a class="btn secondary" href="/prestamo" target="_blank" rel="noreferrer">Abrir formulario cliente</a>
          <button class="btn" id="reloadBtn" type="button">Actualizar</button>
        </div>
      </div>
      <div class="metrics">
        <div class="card metric"><span>Total</span><strong id="mTotal">0</strong></div>
        <div class="card metric"><span>Con fotos</span><strong id="mPhotos">0</strong></div>
        <div class="card metric"><span>Titulares</span><strong id="mOwners">0</strong></div>
        <div class="card metric"><span>Ultimas 24h</span><strong id="mRecent">0</strong></div>
      </div>
    </section>
    <section class="split">
      <div>
        <div class="card panel" style="margin-bottom:12px">
          <div class="grid">
            <div class="field"><label for="search">Buscar</label><input id="search" type="search" placeholder="Nombre, telefono, auto, radicacion"></div>
            <div class="field"><label for="ownerFilter">Titularidad</label><select id="ownerFilter"><option value="">Todos</option><option value="Si, soy titular">Titular</option><option value="No soy titular">No titular</option></select></div>
          </div>
        </div>
        <div class="records" id="records"></div>
      </div>
      <div class="card panel">
        <h2>Detalle</h2>
        <p class="sub" id="emptyDetail">Selecciona una solicitud para ver todo.</p>
        <div id="detail"></div>
      </div>
    </section>
  </div>`, `<script>
    const el = (id) => document.getElementById(id);
    let loans = [];
    let selectedId = '';
    function escapeHtml(value){ return String(value ?? '').replace(/[&<>\"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;'}[c])); }
    function fmtDate(value){ try { return new Date(value).toLocaleString('es-AR'); } catch { return value || '-'; } }
    function renderMetrics(list){
      const now = Date.now();
      el('mTotal').textContent = list.length;
      el('mPhotos').textContent = list.filter((item) => (item.photos || []).length).length;
      el('mOwners').textContent = list.filter((item) => item.isVehicleOwner === 'Si, soy titular').length;
      el('mRecent').textContent = list.filter((item) => now - new Date(item.createdAt).getTime() < 86400000).length;
    }
    function filtered(){
      const q = el('search').value.trim().toLowerCase();
      const owner = el('ownerFilter').value;
      return loans.filter((item) => {
        if (owner && item.isVehicleOwner !== owner) return false;
        if (!q) return true;
        return [item.applicantName,item.phone,item.vehicleBrand,item.vehicleModel,item.vehicleVersion,item.vehicleYear,item.vehicleRegistration,item.notes].join(' ').toLowerCase().includes(q);
      });
    }
    function renderList(){
      const list = filtered();
      renderMetrics(list);
      if (!list.length) { el('records').innerHTML = '<div class=\"card panel\"><p class=\"sub\">No hay solicitudes para mostrar.</p></div>'; return; }
      el('records').innerHTML = list.map((item) => '<button type=\"button\" class=\"record\" data-id=\"'+ item.id +'\" style=\"text-align:left\">'
        + '<h3>' + escapeHtml(item.applicantName) + '</h3>'
        + '<div class=\"meta\"><span>' + escapeHtml(item.phone) + '</span><span>' + escapeHtml(item.vehicleBrand + ' ' + item.vehicleModel + ' ' + item.vehicleYear) + '</span><span>' + escapeHtml(item.vehicleRegistration || '-') + '</span></div>'
        + '<div class=\"row\"><span class=\"pill\">' + escapeHtml(item.isVehicleOwner || 'Sin confirmar') + '</span><span class=\"pill\">' + ((item.photos || []).length ? (item.photos || []).length + ' fotos' : 'Sin fotos') + '</span><span class=\"pill\">' + escapeHtml(fmtDate(item.createdAt)) + '</span></div>'
        + '</button>').join('');
      document.querySelectorAll('[data-id]').forEach((button) => button.addEventListener('click', () => showDetail(button.dataset.id)));
      if (!selectedId && list[0]) showDetail(list[0].id);
    }
    function showDetail(id){
      selectedId = id;
      const item = loans.find((loan) => loan.id === id);
      if (!item) return;
      el('emptyDetail').style.display = 'none';
      const photos = (item.photos || []).map((photo) => '<img src=\"' + photo.dataUrl + '\" alt=\"' + escapeHtml(photo.name || 'foto') + '\">').join('');
      el('detail').innerHTML = '<div class=\"records\">'
        + '<div class=\"record\"><h3>' + escapeHtml(item.applicantName) + '</h3><div class=\"meta\"><span>' + escapeHtml(item.phone) + '</span><span>' + escapeHtml(fmtDate(item.createdAt)) + '</span></div></div>'
        + '<div class=\"record\"><h3>Vehiculo</h3><div class=\"meta\"><span>' + escapeHtml(item.vehicleBrand) + '</span><span>' + escapeHtml(item.vehicleModel) + '</span><span>' + escapeHtml(item.vehicleVersion) + '</span><span>' + escapeHtml(item.vehicleYear) + '</span><span>' + escapeHtml(String(item.vehicleMileage || '-')) + ' km</span><span>' + escapeHtml(item.vehicleRegistration || '-') + '</span></div></div>'
        + '<div class=\"record\"><h3>Titularidad y notas</h3><div class=\"meta\"><span>' + escapeHtml(item.isVehicleOwner || 'Sin confirmar') + '</span></div><p class=\"sub\">' + escapeHtml(item.notes || 'Sin comentarios.') + '</p></div>'
        + '<div class=\"record\"><h3>Fotos</h3>' + (photos ? '<div class=\"photos\">' + photos + '</div>' : '<p class=\"sub\">No cargo fotos.</p>') + '</div>'
        + '<div class=\"record\"><h3>Acciones</h3><div class=\"row\"><a class=\"btn\" target=\"_blank\" rel=\"noreferrer\" href=\"https://wa.me/' + encodeURIComponent(String(item.phone).replace(/\\D/g,'')) + '\">Abrir WhatsApp</a></div></div>'
        + '</div>';
    }
    async function loadLoans(){
      const response = await fetch('/api/loans');
      const data = await response.json();
      loans = data.loans || [];
      renderList();
    }
    el('reloadBtn').addEventListener('click', loadLoans);
    el('search').addEventListener('input', renderList);
    el('ownerFilter').addEventListener('change', renderList);
    loadLoans();
  </script>`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/') {
    return send(res, 200, homePage());
  }

  if (req.method === 'GET' && (url.pathname === '/prestamo' || url.pathname === '/cliente' || url.pathname === '/solicitud')) {
    return send(res, 200, clientPage());
  }

  if (req.method === 'GET' && (url.pathname === '/admin' || url.pathname === '/crm')) {
    if (!adminOk(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8', 'WWW-Authenticate': 'Basic realm="Prestamelo Admin"' });
      return res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    }
    return send(res, 200, adminPage());
  }

  if (req.method === 'GET' && url.pathname === '/api/loans') {
    if (!adminOk(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json; charset=utf-8', 'WWW-Authenticate': 'Basic realm="Prestamelo Admin"' });
      return res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    }
    return sendJson(res, 200, { ok: true, loans: readLoans().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))) });
  }

  if (req.method === 'POST' && url.pathname === '/api/loans') {
    try {
      const body = await parseBody(req);
      if (!body.applicantName || !body.phone) {
        return sendJson(res, 400, { ok: false, error: 'Nombre y WhatsApp son obligatorios.' });
      }
      const loans = readLoans();
      const loan = {
        id: 'loan_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7),
        createdAt: new Date().toISOString(),
        applicantName: String(body.applicantName || '').trim(),
        phone: String(body.phone || '').trim(),
        vehicleBrand: String(body.vehicleBrand || '').trim(),
        vehicleModel: String(body.vehicleModel || '').trim(),
        vehicleVersion: String(body.vehicleVersion || '').trim(),
        vehicleYear: String(body.vehicleYear || '').trim(),
        vehicleMileage: Number(body.vehicleMileage || 0) || 0,
        vehicleRegistration: String(body.vehicleRegistration || '').trim(),
        isVehicleOwner: String(body.isVehicleOwner || '').trim(),
        notes: String(body.notes || '').trim(),
        photos: Array.isArray(body.photos) ? body.photos.slice(0, 8).map((photo) => ({ name: String(photo.name || ''), type: String(photo.type || 'image/jpeg'), dataUrl: String(photo.dataUrl || '') })).filter((photo) => photo.dataUrl.startsWith('data:')) : []
      };
      loans.push(loan);
      writeLoans(loans);
      return sendJson(res, 201, { ok: true, loan });
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: error.message });
    }
  }

  send(res, 404, 'Not found', 'text/plain; charset=utf-8');
});

server.listen(PORT, HOST, () => {
  console.log('Prestamelo admin server listo en http://' + HOST + ':' + PORT);
});

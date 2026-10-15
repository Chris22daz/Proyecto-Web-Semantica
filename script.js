const STORAGE_KEY = 'servidrive-autos-v1';
const CUSTOMER_STORAGE_KEY = 'servidrive-clientes-v1';
const FAVORITES_STORAGE_KEY = 'servidrive-favorites-v1';
const COMPARISON_STORAGE_KEY = 'servidrive-comparison-v1';
const HISTORY_STORAGE_KEY = 'servidrive-history-v1';
const initialCars = [
  { id: 'A001', marca: 'Toyota', modelo: 'Corolla', anio: 2022, tipo: 'Sedan', precio: 420000, kilometraje: 32000, transmision: 'Automática', estado: 'Disponible' },
  { id: 'A002', marca: 'Honda', modelo: 'CR-V', anio: 2021, tipo: 'SUV', precio: 560000, kilometraje: 41000, transmision: 'Automática', estado: 'Vendida' },
  { id: 'A003', marca: 'Ford', modelo: 'Focus', anio: 2020, tipo: 'Hatchback', precio: 310000, kilometraje: 54000, transmision: 'Manual', estado: 'Disponible' }
];
const vehicleTypes = ['Sedan', 'SUV', 'Hatchback', 'Pickup', 'Deportivo'];
const pages = ['inicio', 'inventario', 'registro', 'contacto'];
const form = document.getElementById('carForm');
const inventoryList = document.getElementById('inventoryList');
const searchInput = document.getElementById('searchInput');
const statusFilter = document.getElementById('statusFilter');
const typeFilter = document.getElementById('typeFilter');
const minPriceFilter = document.getElementById('minPriceFilter');
const maxPriceFilter = document.getElementById('maxPriceFilter');
const sortFilter = document.getElementById('sortFilter');
const resultsCount = document.getElementById('resultsCount');
const toast = document.getElementById('toast');
const formTitle = document.getElementById('formTitle');
const syncStatus = document.getElementById('syncStatus');
const cancelButton = document.getElementById('cancelButton');
const newCarButton = document.getElementById('newCarButton');
const photoInput = form.elements.foto;
const photoPreview = document.getElementById('photoPreview');
let autos = [];
let clientes = loadClientes();
let favoritos = loadArray(FAVORITES_STORAGE_KEY, []);
let comparacion = loadArray(COMPARISON_STORAGE_KEY, []);
let historial = loadArray(HISTORY_STORAGE_KEY, []);
let toastTimer;
let previewUrl;

function loadArray(key, fallback) {
  try {
    const saved = localStorage.getItem(key);
    if (!saved) return [...fallback];
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [...fallback];
  } catch {
    return [...fallback];
  }
}

function loadAutos() {
  return loadArray(STORAGE_KEY, initialCars);
}

function loadClientes() {
  return loadArray(CUSTOMER_STORAGE_KEY, []);
}

function saveLocalState(key, value, failureMessage) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    showToast(failureMessage);
    return false;
  }
}

function setSyncStatus(state, updatedAt) {
  const labels = {
    connecting: 'Conectando con el inventario…',
    saving: 'Guardando cambios en los archivos del proyecto…',
    error: 'Sin sincronizar · revisa que el servidor esté activo',
    synced: 'Inventario listo · aún no sincronizado'
  };
  syncStatus.dataset.state = state;
  syncStatus.textContent = state === 'synced' && updatedAt
    ? `Sincronizado · ${new Intl.DateTimeFormat('es-MX', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(updatedAt))}`
    : labels[state] || labels.error;
}

async function readApiResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('La página está abierta con un servidor que no tiene la API. Abre una terminal en la carpeta PROYECTO, ejecuta npm start y entra a http://localhost:3000.');
  }
  return response.json();
}

async function saveAutos() {
  setSyncStatus('saving');
  try {
    const response = await fetch('/api/inventory', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ autos })
    });
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(result.error || 'No se pudo guardar el inventario.');
    autos = result.autos;
    setSyncStatus('synced', result.updatedAt);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(autos));
    } catch {
      showToast('El inventario se guardó en el servidor, pero no en la copia local del navegador.');
    }
    return true;
  } catch (error) {
    setSyncStatus('error');
    showToast(error.message || 'No se pudo conectar con el servidor local. Inicia la aplicación con npm start.');
    return false;
  }
}

async function initializeInventory() {
  try {
    const response = await fetch('/api/inventory');
    const result = await readApiResponse(response);
    if (!response.ok) throw new Error(result.error || 'No se pudo cargar el inventario.');
    setSyncStatus('synced', result.updatedAt);
    if (result.initialized) {
      autos = result.autos;
    } else {
      autos = loadAutos();
      if (!await saveAutos()) {
        renderSummary();
        renderInventory();
        return;
      }
    }
    renderSummary();
    renderInventory();
  } catch (error) {
    setSyncStatus('error');
    autos = loadAutos();
    renderSummary();
    renderInventory();
    showToast(`${error.message || 'No se pudo cargar el inventario.'} Inicia la aplicación con npm start.`);
  }
}

function saveClientes() {
  try {
    localStorage.setItem(CUSTOMER_STORAGE_KEY, JSON.stringify(clientes));
    return true;
  } catch {
    showToast('No se pudo guardar el registro en este navegador.');
    return false;
  }
}

function money(value) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[character]);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 3000);
}

function goToPage(pageName) {
  if (!pages.includes(pageName)) return;
  document.querySelectorAll('[data-page-panel]').forEach(panel => {
    const isVisible = panel.dataset.pagePanel === pageName;
    panel.hidden = !isVisible;
    panel.classList.toggle('is-visible', isVisible);
  });
  document.querySelectorAll('.nav-link').forEach(link => {
    const isCurrent = link.dataset.page === pageName;
    link.classList.toggle('is-active', isCurrent);
    if (isCurrent) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
  history.replaceState(null, '', `#${pageName}`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function nextId() {
  const highest = autos.reduce((max, car) => {
    const match = String(car.id).match(/(\d+)$/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `A${String(highest + 1).padStart(3, '0')}`;
}

function renderSummary() {
  const availableCars = autos.filter(car => car.estado === 'Disponible');
  const soldCount = autos.filter(car => car.estado === 'Vendida').length;
  const totalValue = availableCars.reduce((sum, car) => sum + (Number(car.precio) || 0), 0);
  const averagePrice = autos.length ? autos.reduce((sum, car) => sum + (Number(car.precio) || 0), 0) / autos.length : 0;
  const averageMileage = autos.length ? autos.reduce((sum, car) => sum + (Number(car.kilometraje) || 0), 0) / autos.length : 0;
  const soldRate = autos.length ? Math.round((soldCount / autos.length) * 100) : 0;

  document.getElementById('totalCars').textContent = autos.length;
  document.getElementById('availableCars').textContent = availableCars.length;
  document.getElementById('soldCars').textContent = soldCount;
  document.getElementById('inventoryValue').textContent = money(totalValue);
  document.getElementById('averagePrice').textContent = money(averagePrice);
  document.getElementById('averageMileage').textContent = `${Math.round(averageMileage).toLocaleString('es-MX')} km`;
  document.getElementById('salesRate').textContent = `${soldRate}%`;
  document.getElementById('inventoryTotal').textContent = autos.length;
  document.getElementById('inventoryAvailable').textContent = availableCars.length;
  document.getElementById('inventorySold').textContent = soldCount;
  document.getElementById('customerCount').textContent = clientes.length;

  const counts = vehicleTypes.map(type => ({ type, count: autos.filter(car => car.tipo === type).length }));
  const highestCount = Math.max(1, ...counts.map(item => item.count));
  const topType = counts.reduce((top, item) => item.count > top.count ? item : top, { type: '—', count: 0 });
  document.getElementById('topType').textContent = topType.count ? (topType.type === 'Sedan' ? 'Sedán' : topType.type) : '—';
  document.getElementById('typeChart').innerHTML = counts.map(({ type, count }) => `
    <div class="bar-row">
      <span>${type === 'Sedan' ? 'Sedán' : type}</span>
      <div class="bar-track" role="img" aria-label="${type === 'Sedan' ? 'Sedán' : type}: ${count} vehículos">
        <span class="bar-fill" style="width:${Math.round((count / highestCount) * 100)}%"></span>
      </div>
      <strong>${count}</strong>
    </div>
  `).join('');
  const priceBands = [
    { label: 'Menos de $300 mil', min: 0, max: 300000 },
    { label: '$300–500 mil', min: 300000, max: 500000 },
    { label: '$500–750 mil', min: 500000, max: 750000 },
    { label: 'Más de $750 mil', min: 750000, max: Infinity }
  ].map(band => ({
    ...band,
    count: autos.filter(car => Number(car.precio) >= band.min
      && (band.max === Infinity ? true : Number(car.precio) < band.max)).length
  }));
  const highestBand = Math.max(1, ...priceBands.map(band => band.count));
  document.getElementById('priceChart').innerHTML = priceBands.map(({ label, count }) => `
    <div class="bar-row">
      <span>${label}</span>
      <div class="bar-track" role="img" aria-label="${label}: ${count} vehículos">
        <span class="bar-fill" style="width:${Math.round((count / highestBand) * 100)}%"></span>
      </div>
      <strong>${count}</strong>
    </div>
  `).join('');
}

function renderInventory() {
  const query = searchInput.value.trim().toLocaleLowerCase('es-MX');
  const selectedStatus = statusFilter.value;
  const selectedType = typeFilter.value;
  const minPrice = Number(minPriceFilter.value) || 0;
  const maxPrice = Number(maxPriceFilter.value) || Infinity;
  const filtered = autos.filter(car => {
    const text = `${car.marca} ${car.modelo}`.toLocaleLowerCase('es-MX');
    return text.includes(query)
      && (selectedStatus === 'Todos' || car.estado === selectedStatus)
      && (selectedType === 'Todos' || car.tipo === selectedType)
      && Number(car.precio) >= minPrice
      && Number(car.precio) <= maxPrice;
  });
  const sorters = {
    'price-asc': (a, b) => Number(a.precio) - Number(b.precio),
    'price-desc': (a, b) => Number(b.precio) - Number(a.precio),
    'year-desc': (a, b) => Number(b.anio) - Number(a.anio),
    'mileage-asc': (a, b) => Number(a.kilometraje || 0) - Number(b.kilometraje || 0)
  };
  if (sorters[sortFilter.value]) filtered.sort(sorters[sortFilter.value]);
  const validFavorites = favoritos.filter(id => autos.some(car => car.id === id));
  const validComparison = comparacion.filter(id => autos.some(car => car.id === id)).slice(0, 3);
  if (validFavorites.length !== favoritos.length) {
    favoritos = validFavorites;
    saveLocalState(FAVORITES_STORAGE_KEY, favoritos, 'No se pudieron actualizar tus favoritos guardados.');
  }
  if (validComparison.length !== comparacion.length) {
    comparacion = validComparison;
    saveLocalState(COMPARISON_STORAGE_KEY, comparacion, 'No se pudo actualizar la comparación guardada.');
  }

  resultsCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'vehículo' : 'vehículos'}`;
  inventoryList.innerHTML = filtered.length
    ? filtered.map(car => `
      <article class="car-item">
        ${car.foto ? `<img class="car-photo" src="${escapeHTML(car.foto)}" alt="Foto de ${escapeHTML(car.marca)} ${escapeHTML(car.modelo)}" />` : ''}
        <div class="car-main">
          <span class="car-id">${escapeHTML(car.id)}</span>
          <h3>${escapeHTML(car.marca)} ${escapeHTML(car.modelo)}</h3>
          <p>${escapeHTML(car.anio)} · ${escapeHTML(car.tipo === 'Sedan' ? 'Sedán' : car.tipo)} · ${(Number(car.kilometraje) || 0).toLocaleString('es-MX')} km</p>
          <p class="transmission">${escapeHTML(car.transmision || 'Transmisión no especificada')}</p>
        </div>
        <div class="car-meta">
          <strong>${money(car.precio)}</strong>
          <span class="status ${car.estado === 'Vendida' ? 'sold' : 'available'}">${escapeHTML(car.estado)}</span>
          <div class="actions-row">
            <button type="button" data-action="view-details" data-id="${escapeHTML(car.id)}">Ver ficha</button>
            <button type="button" data-action="toggle-favorite" data-id="${escapeHTML(car.id)}" aria-pressed="${favoritos.includes(car.id)}">${favoritos.includes(car.id) ? '♥ Favorito' : '♡ Favorito'}</button>
            <button type="button" data-action="toggle-compare" data-id="${escapeHTML(car.id)}" aria-pressed="${comparacion.includes(car.id)}">${comparacion.includes(car.id) ? '✓ Comparando' : '+ Comparar'}</button>
            <button type="button" data-action="edit" data-id="${escapeHTML(car.id)}">Editar</button>
            <button type="button" data-action="toggle-status" data-id="${escapeHTML(car.id)}">${car.estado === 'Vendida' ? 'Reactivar' : 'Marcar vendida'}</button>
            <button type="button" data-action="delete" data-id="${escapeHTML(car.id)}" class="danger">Eliminar</button>
          </div>
        </div>
      </article>
    `).join('')
    : '<div class="empty">No hay vehículos que coincidan con la búsqueda.</div>';
  renderFeatured();
  renderComparison();
  renderFavorites();
  renderHistory();
}

function renderFeatured() {
  const featured = autos.filter(car => car.estado === 'Disponible').slice(0, 3);
  const container = document.getElementById('featuredCars');
  container.innerHTML = featured.length ? featured.map(car => `
    <article class="featured-card">
      <div class="featured-art">${car.foto ? `<img class="featured-photo" src="${escapeHTML(car.foto)}" alt="Foto de ${escapeHTML(car.marca)} ${escapeHTML(car.modelo)}" />` : '<div class="mini-car"><i></i><b></b></div>'}<span>${escapeHTML(car.tipo === 'Sedan' ? 'SEDÁN' : car.tipo.toUpperCase())}</span></div>
      <div class="featured-copy"><span class="car-id">${escapeHTML(car.id)} · ${escapeHTML(car.anio)}</span><h3>${escapeHTML(car.marca)} ${escapeHTML(car.modelo)}</h3><div><span>${(Number(car.kilometraje) || 0).toLocaleString('es-MX')} km</span><strong>${money(car.precio)}</strong></div><button class="featured-details" type="button" data-action="view-details" data-id="${escapeHTML(car.id)}">Ver ficha completa →</button></div>
    </article>
  `).join('') : '<p class="empty">No hay unidades disponibles por el momento.</p>';
}

function renderComparison() {
  const selected = comparacion.map(id => autos.find(car => car.id === id)).filter(Boolean);
  const content = document.getElementById('comparisonContent');
  if (!selected.length) {
    content.innerHTML = '<p class="tool-hint">Aún no has seleccionado vehículos.</p>';
    return;
  }
  const rows = [
    ['Foto', car => car.foto ? `<img class="compare-photo" src="${escapeHTML(car.foto)}" alt="Foto de ${escapeHTML(car.marca)} ${escapeHTML(car.modelo)}" />` : 'Sin foto'],
    ['Precio', car => money(car.precio)],
    ['Año', car => escapeHTML(car.anio)],
    ['Kilometraje', car => `${(Number(car.kilometraje) || 0).toLocaleString('es-MX')} km`],
    ['Tipo', car => escapeHTML(car.tipo === 'Sedan' ? 'Sedán' : car.tipo)],
    ['Transmisión', car => escapeHTML(car.transmision || 'No especificada')],
    ['Estado', car => escapeHTML(car.estado)]
  ];
  content.innerHTML = `
    <div class="compare-table-wrap"><table class="compare-table">
      <thead><tr><th>Característica</th>${selected.map(car => `<th>${escapeHTML(car.marca)} ${escapeHTML(car.modelo)}<button class="remove-compare" type="button" data-action="toggle-compare" data-id="${escapeHTML(car.id)}" aria-label="Quitar ${escapeHTML(car.marca)} ${escapeHTML(car.modelo)}">×</button></th>`).join('')}</tr></thead>
      <tbody>${rows.map(([label, format]) => `<tr><th>${label}</th>${selected.map(car => `<td>${format(car)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table></div>`;
}

function renderFavorites() {
  const selected = favoritos.map(id => autos.find(car => car.id === id)).filter(Boolean);
  document.getElementById('favoritesCount').textContent = String(selected.length);
  document.getElementById('favoritesContent').innerHTML = selected.length
    ? `<ul class="favorites-list">${selected.map(car => `
      <li><span><strong>${escapeHTML(car.marca)} ${escapeHTML(car.modelo)}</strong><small>${money(car.precio)} · ${escapeHTML(car.estado)}</small></span>
        <span class="favorite-actions"><button type="button" data-action="view-details" data-id="${escapeHTML(car.id)}">Ver ficha</button><button type="button" data-action="toggle-favorite" data-id="${escapeHTML(car.id)}" aria-label="Quitar ${escapeHTML(car.marca)} ${escapeHTML(car.modelo)} de favoritos">Quitar</button></span></li>
    `).join('')}</ul>`
    : '<p class="tool-hint">Marca el corazón de un vehículo para guardarlo aquí.</p>';
}

function renderHistory() {
  const recent = historial.slice(0, 12);
  document.getElementById('historyContent').innerHTML = recent.length
    ? `<ol class="history-list">${recent.map(item => `
      <li><span class="history-dot" aria-hidden="true"></span><div><strong>${escapeHTML(item.action)}</strong><span>${escapeHTML(item.vehicle)}</span><time datetime="${escapeHTML(item.at)}">${new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.at))}</time></div></li>
    `).join('')}</ol>`
    : '<p class="tool-hint">Los cambios del inventario aparecerán aquí.</p>';
}

function recordHistory(action, car) {
  historial.unshift({
    action,
    vehicle: `${car.marca} ${car.modelo} · ${car.id}`,
    at: new Date().toISOString()
  });
  historial = historial.slice(0, 40);
  if (saveLocalState(HISTORY_STORAGE_KEY, historial, 'El cambio se guardó, pero no se pudo conservar el historial en este navegador.')) {
    renderHistory();
  }
}

function toggleFavorite(id) {
  const previous = favoritos;
  favoritos = favoritos.includes(id) ? favoritos.filter(item => item !== id) : [...favoritos, id];
  if (saveLocalState(FAVORITES_STORAGE_KEY, favoritos, 'No se pudo guardar el favorito en este navegador.')) {
    renderInventory();
  } else favoritos = previous;
}

function toggleComparison(id) {
  const previous = [...comparacion];
  if (comparacion.includes(id)) {
    comparacion = comparacion.filter(item => item !== id);
  } else if (comparacion.length >= 3) {
    showToast('Puedes comparar hasta 3 vehículos a la vez.');
    return;
  } else {
    comparacion.push(id);
  }
  if (saveLocalState(COMPARISON_STORAGE_KEY, comparacion, 'No se pudo guardar la comparación en este navegador.')) {
    renderInventory();
  } else comparacion = previous;
}

function showVehicleDetails(id) {
  const car = autos.find(item => item.id === id);
  if (!car) return;
  const rdf = buildRdf([car]);
  const photo = car.foto
    ? `<img class="vehicle-dialog-photo" src="${escapeHTML(car.foto)}" alt="Foto de ${escapeHTML(car.marca)} ${escapeHTML(car.modelo)}" />`
    : '<div class="vehicle-dialog-placeholder" aria-hidden="true">SD</div>';
  document.getElementById('vehicleDialogContent').innerHTML = `
    ${photo}
    <div class="vehicle-dialog-details">
      <span class="car-id">${escapeHTML(car.id)} · ${escapeHTML(car.tipo === 'Sedan' ? 'Sedán' : car.tipo)}</span>
      <h2 id="vehicleDialogTitle">${escapeHTML(car.marca)} ${escapeHTML(car.modelo)}</h2>
      <p class="vehicle-dialog-price">${money(car.precio)}</p>
      <span class="status ${car.estado === 'Vendida' ? 'sold' : 'available'}">${escapeHTML(car.estado)}</span>
      <dl class="vehicle-specs">
        <div><dt>Año</dt><dd>${escapeHTML(car.anio)}</dd></div>
        <div><dt>Kilometraje</dt><dd>${(Number(car.kilometraje) || 0).toLocaleString('es-MX')} km</dd></div>
        <div><dt>Transmisión</dt><dd>${escapeHTML(car.transmision || 'No especificada')}</dd></div>
        <div><dt>Tipo</dt><dd>${escapeHTML(car.tipo === 'Sedan' ? 'Sedán' : car.tipo)}</dd></div>
      </dl>
      <div class="vehicle-tools-actions">
        <button class="btn btn-primary" type="button" data-action="print-quote" data-id="${escapeHTML(car.id)}">Imprimir cotización</button>
        <button class="btn btn-light" type="button" data-action="toggle-favorite" data-id="${escapeHTML(car.id)}">${favoritos.includes(car.id) ? '♥ En favoritos' : '♡ Agregar a favoritos'}</button>
      </div>
      <details class="rdf-explorer"><summary>Explorador de datos RDF</summary><pre><code>${escapeHTML(rdf)}</code></pre></details>
    </div>`;
  const dialog = document.getElementById('vehicleDialog');
  if (!dialog.open) dialog.showModal();
}

function printQuote(id) {
  const car = autos.find(item => item.id === id);
  if (!car) return;
  const quoteWindow = window.open('', '_blank');
  if (!quoteWindow) {
    showToast('El navegador bloqueó la ventana de cotización. Permite las ventanas emergentes para imprimir.');
    return;
  }
  const photo = car.foto
    ? `<img src="${escapeHTML(new URL(car.foto, location.href).href)}" alt="Foto del vehículo" />`
    : '';
  quoteWindow.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Cotización ${escapeHTML(car.id)} · ServiDrive</title>
    <style>
      body{max-width:760px;margin:40px auto;padding:0 24px;color:#17263b;font:15px Arial,sans-serif}header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1769e0;padding-bottom:16px}h1{margin:0;color:#1769e0;font-size:24px}small{color:#68778b}main{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:30px 0}img{width:100%;max-height:270px;object-fit:cover;border-radius:12px}.price{color:#1769e0;font-size:26px;font-weight:bold}.specs{display:grid;gap:8px}.specs p{margin:0;padding:9px;border-bottom:1px solid #e4eaf2}.note{margin-top:35px;padding:16px;border-radius:8px;background:#f3f7fc;color:#68778b;font-size:12px}.print{padding:10px 16px;border:0;border-radius:6px;background:#1769e0;color:white;font-weight:bold;cursor:pointer}@media print{body{margin:0 auto}.print{display:none}}
    </style></head><body><header><div><h1>ServiDrive</h1><small>Cotización informativa · ${new Intl.DateTimeFormat('es-MX', { dateStyle: 'long' }).format(new Date())}</small></div><button class="print" onclick="window.print()">Imprimir / Guardar PDF</button></header>
    <main>${photo}<section><small>UNIDAD ${escapeHTML(car.id)}</small><h2>${escapeHTML(car.marca)} ${escapeHTML(car.modelo)}</h2><p class="price">${money(car.precio)} MXN</p><div class="specs"><p><strong>Año:</strong> ${escapeHTML(car.anio)}</p><p><strong>Kilometraje:</strong> ${(Number(car.kilometraje) || 0).toLocaleString('es-MX')} km</p><p><strong>Transmisión:</strong> ${escapeHTML(car.transmision)}</p><p><strong>Tipo:</strong> ${escapeHTML(car.tipo === 'Sedan' ? 'Sedán' : car.tipo)}</p><p><strong>Estado:</strong> ${escapeHTML(car.estado)}</p></div></section></main>
    <p class="note">ServiDrive · +52 22 21 03 89 64 · servidrive@gmail.com<br>Cotización demostrativa no vinculante. Precio y disponibilidad sujetos a confirmación por ServiDrive.</p></body></html>`);
  quoteWindow.document.close();
  quoteWindow.focus();
  quoteWindow.setTimeout(() => quoteWindow.print(), 350);
}

function resetForm() {
  form.reset();
  form.elements.id.value = '';
  formTitle.textContent = 'Registrar vehículo';
  photoPreview.hidden = true;
  photoPreview.removeAttribute('src');
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
}

function startEdit(id) {
  const car = autos.find(item => item.id === id);
  if (!car) return;
  form.elements.id.value = car.id;
  form.elements.marca.value = car.marca;
  form.elements.modelo.value = car.modelo;
  form.elements.anio.value = car.anio;
  form.elements.precio.value = car.precio;
  form.elements.kilometraje.value = car.kilometraje || 0;
  form.elements.transmision.value = car.transmision || '';
  form.elements.tipo.value = car.tipo;
  form.elements.estado.value = car.estado;
  if (car.foto) {
    photoPreview.src = car.foto;
    photoPreview.hidden = false;
  } else {
    photoPreview.removeAttribute('src');
    photoPreview.hidden = true;
  }
  formTitle.textContent = `Editar ${car.id}`;
  document.getElementById('vehicleFormPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.elements.marca.focus();
}

function readCarImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('El archivo seleccionado no es una imagen válida.'));
      image.onload = () => {
        const scale = Math.min(1, 1280 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        const context = canvas.getContext('2d');
        if (!context) {
          reject(new Error('No se pudo procesar la imagen seleccionada.'));
          return;
        }
        context.fillStyle = '#fff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

photoInput.addEventListener('change', () => {
  const file = photoInput.files[0];
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = undefined;
  if (!file) {
    const existingCar = autos.find(car => car.id === form.elements.id.value);
    if (existingCar && existingCar.foto) {
      photoPreview.src = existingCar.foto;
      photoPreview.hidden = false;
    } else {
      photoPreview.removeAttribute('src');
      photoPreview.hidden = true;
    }
    return;
  }
  if (!file.type.startsWith('image/')) {
    photoInput.value = '';
    showToast('Selecciona un archivo de imagen.');
    return;
  }
  previewUrl = URL.createObjectURL(file);
  photoPreview.src = previewUrl;
  photoPreview.hidden = false;
});

function xmlEscape(value) {
  return String(value).replace(/[<>&"']/g, character => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;'
  })[character]);
}

function buildRdf(cars = autos) {
  const descriptions = cars.map(car => {
    const uri = `https://servidrive.example/vehiculo/${encodeURIComponent(car.id)}`;
    const availability = car.estado === 'Disponible' ? 'InStock' : 'SoldOut';
    return `  <rdf:Description rdf:about="${xmlEscape(uri)}">
    <rdf:type rdf:resource="https://schema.org/Vehicle" />
    <schema:identifier>${xmlEscape(car.id)}</schema:identifier>
    <schema:brand>${xmlEscape(car.marca)}</schema:brand>
    <schema:model>${xmlEscape(car.modelo)}</schema:model>
    <schema:vehicleModelDate>${xmlEscape(car.anio)}</schema:vehicleModelDate>
    <schema:bodyType>${xmlEscape(car.tipo)}</schema:bodyType>
    <schema:vehicleTransmission>${xmlEscape(car.transmision || '')}</schema:vehicleTransmission>
    <schema:mileageFromOdometer>
      <rdf:Description>
        <schema:value>${Number(car.kilometraje) || 0}</schema:value>
        <schema:unitCode>KMT</schema:unitCode>
      </rdf:Description>
    </schema:mileageFromOdometer>
    <schema:offers>
      <rdf:Description>
        <rdf:type rdf:resource="https://schema.org/Offer" />
        <schema:price>${Number(car.precio) || 0}</schema:price>
        <schema:priceCurrency>MXN</schema:priceCurrency>
        <schema:availability rdf:resource="https://schema.org/${availability}" />
      </rdf:Description>
    </schema:offers>
  </rdf:Description>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:schema="https://schema.org/">
${descriptions}
</rdf:RDF>
`;
}

document.querySelectorAll('[data-page]').forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();
    goToPage(link.dataset.page);
  });
});

document.querySelectorAll('[data-go]').forEach(button => {
  button.addEventListener('click', () => {
    goToPage(button.dataset.go);
    if (button.hasAttribute('data-focus-favorites')) {
      document.getElementById('favoritesPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
});

document.getElementById('newCarButton').addEventListener('click', () => {
  resetForm();
  document.getElementById('vehicleFormPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.elements.marca.focus();
});
cancelButton.addEventListener('click', resetForm);
document.getElementById('clearComparisonButton').addEventListener('click', () => {
  const previous = comparacion;
  comparacion = [];
  if (saveLocalState(COMPARISON_STORAGE_KEY, comparacion, 'No se pudo limpiar la comparación.')) renderInventory();
  else comparacion = previous;
});
document.getElementById('clearHistoryButton').addEventListener('click', () => {
  if (!historial.length || !window.confirm('¿Borrar todo el historial de cambios de este navegador?')) return;
  const previous = historial;
  historial = [];
  if (saveLocalState(HISTORY_STORAGE_KEY, historial, 'No se pudo borrar el historial.')) renderHistory();
  else historial = previous;
});
searchInput.addEventListener('input', renderInventory);
statusFilter.addEventListener('change', renderInventory);
typeFilter.addEventListener('change', renderInventory);
minPriceFilter.addEventListener('input', renderInventory);
maxPriceFilter.addEventListener('input', renderInventory);
sortFilter.addEventListener('change', renderInventory);

document.getElementById('heroSearchForm').addEventListener('submit', event => {
  event.preventDefault();
  searchInput.value = document.getElementById('heroBrand').value.trim();
  typeFilter.value = document.getElementById('heroType').value;
  minPriceFilter.value = '';
  maxPriceFilter.value = document.getElementById('heroMaxPrice').value;
  sortFilter.value = 'newest';
  statusFilter.value = 'Todos';
  goToPage('inventario');
  renderInventory();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!form.reportValidity()) return;
  const formData = new FormData(form);
  const id = formData.get('id') || nextId();
  const index = autos.findIndex(car => car.id === id);
  const previous = index >= 0 ? autos[index] : null;
  const selectedPhoto = formData.get('foto');
  let foto = previous ? previous.foto || '' : '';
  if (selectedPhoto instanceof File && selectedPhoto.size > 0) {
    if (!selectedPhoto.type.startsWith('image/')) {
      showToast('Selecciona un archivo de imagen.');
      return;
    }
    try {
      foto = await readCarImage(selectedPhoto);
    } catch (error) {
      showToast(error.message);
      return;
    }
  }
  const current = {
    id,
    marca: String(formData.get('marca')).trim(),
    modelo: String(formData.get('modelo')).trim(),
    anio: Number(formData.get('anio')),
    tipo: formData.get('tipo'),
    precio: Number(formData.get('precio')),
    kilometraje: Number(formData.get('kilometraje')),
    transmision: formData.get('transmision'),
    estado: formData.get('estado'),
    foto
  };
  if (index >= 0) autos[index] = current;
  else autos.unshift(current);
  if (!await saveAutos()) {
    if (previous) autos[index] = previous;
    else autos.shift();
    return;
  }
  recordHistory(index >= 0 ? 'Vehículo actualizado' : 'Vehículo agregado', current);
  resetForm();
  renderSummary();
  renderInventory();
  showToast(index >= 0 ? 'Vehículo actualizado.' : 'Vehículo agregado.');
});

document.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  const car = autos.find(item => item.id === id);
  if (!car) return;
  if (action === 'view-details') {
    showVehicleDetails(id);
    return;
  }
  if (action === 'toggle-favorite') {
    toggleFavorite(id);
    if (document.getElementById('vehicleDialog').open) showVehicleDetails(id);
    return;
  }
  if (action === 'toggle-compare') {
    toggleComparison(id);
    return;
  }
  if (action === 'print-quote') {
    printQuote(id);
    return;
  }
  if (action === 'edit') {
    startEdit(id);
    return;
  }
  if (action === 'toggle-status') {
    const previousStatus = car.estado;
    car.estado = car.estado === 'Vendida' ? 'Disponible' : 'Vendida';
    if (await saveAutos()) {
      recordHistory(car.estado === 'Vendida' ? 'Venta registrada' : 'Vehículo reactivado', car);
      renderSummary();
      renderInventory();
      showToast(car.estado === 'Vendida' ? 'Venta registrada.' : 'Vehículo reactivado.');
    } else car.estado = previousStatus;
    return;
  }
  if (action === 'delete') {
    if (!window.confirm(`¿Eliminar ${car.marca} ${car.modelo}?`)) return;
    const previousAutos = autos;
    autos = autos.filter(item => item.id !== id);
    if (await saveAutos()) {
      recordHistory('Vehículo eliminado', car);
      favoritos = favoritos.filter(item => item !== id);
      comparacion = comparacion.filter(item => item !== id);
      saveLocalState(FAVORITES_STORAGE_KEY, favoritos, 'Se eliminó el auto, pero no se pudieron actualizar los favoritos.');
      saveLocalState(COMPARISON_STORAGE_KEY, comparacion, 'Se eliminó el auto, pero no se pudo actualizar la comparación.');
      renderSummary();
      renderInventory();
      showToast('Vehículo eliminado.');
    } else autos = previousAutos;
  }
});

document.getElementById('customerForm').addEventListener('submit', event => {
  event.preventDefault();
  const customerForm = event.currentTarget;
  if (!customerForm.reportValidity()) return;
  const formData = new FormData(customerForm);
  const email = String(formData.get('email')).trim().toLocaleLowerCase('es-MX');
  if (clientes.some(customer => customer.email.toLocaleLowerCase('es-MX') === email)) {
    showToast('Ya existe un registro con ese correo electrónico.');
    return;
  }
  clientes.push({
    name: String(formData.get('name')).trim(),
    phone: String(formData.get('phone')).trim(),
    email,
    interest: formData.get('interest'),
    registeredAt: new Date().toISOString()
  });
  if (!saveClientes()) {
    clientes.pop();
    return;
  }
  customerForm.reset();
  document.getElementById('customerCount').textContent = clientes.length;
  showToast('Registro guardado en este navegador.');
});

document.getElementById('contactForm').addEventListener('submit', event => {
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  event.currentTarget.reset();
  showToast('Mensaje preparado. Este prototipo no lo envía a un servidor.');
});

const firstPage = pages.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'inicio';
goToPage(firstPage);
initializeInventory();

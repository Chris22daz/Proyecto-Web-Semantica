const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');

const ROOT = __dirname;
const DATABASE_FILE = path.join(ROOT, 'inventario-db.json');
const XML_FILE = path.join(ROOT, 'agencia_autos.xml');
const XSD_FILE = path.join(ROOT, 'agencia_autos.xsd');
const XSL_FILE = path.join(ROOT, 'agencia_autos.xsl');
const RDF_FILE = path.join(ROOT, 'servidrive-inventario.rdf');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const MAX_REQUEST_SIZE = 40 * 1024 * 1024;
const PORT = Number(process.env.PORT) || 3000;

const DEFAULT_CARS = [
  { id: 'A001', marca: 'Toyota', modelo: 'Corolla', anio: 2022, tipo: 'Sedan', precio: 420000, kilometraje: 32000, transmision: 'Automática', estado: 'Disponible', foto: '' },
  { id: 'A002', marca: 'Honda', modelo: 'CR-V', anio: 2021, tipo: 'SUV', precio: 560000, kilometraje: 41000, transmision: 'Automática', estado: 'Vendida', foto: '' },
  { id: 'A003', marca: 'Ford', modelo: 'Focus', anio: 2020, tipo: 'Hatchback', precio: 310000, kilometraje: 54000, transmision: 'Manual', estado: 'Disponible', foto: '' }
];
const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.rdf': 'application/rdf+xml; charset=utf-8',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
  '.xsd': 'application/xml; charset=utf-8',
  '.xsl': 'application/xslt+xml; charset=utf-8'
};
let writeQueue = Promise.resolve();

function escapeXml(value) {
  return String(value ?? '').replace(/[<>&"']/g, character => ({
    '<': '&lt;',
    '>': '&gt;',
    '&': '&amp;',
    '"': '&quot;',
    "'": '&apos;'
  })[character]);
}

function buildXml(cars) {
  const entries = cars.map(car => `        <auto id="${escapeXml(car.id)}">
            <marca>${escapeXml(car.marca)}</marca>
            <modelo>${escapeXml(car.modelo)}</modelo>
            <anio>${car.anio}</anio>
            <tipo>${escapeXml(car.tipo)}</tipo>
            <precio>${car.precio}</precio>
            <kilometraje>${car.kilometraje}</kilometraje>
            <transmision>${escapeXml(car.transmision)}</transmision>
            <estado>${escapeXml(car.estado)}</estado>${car.foto ? `
            <foto>${escapeXml(car.foto)}</foto>` : ''}
        </auto>`).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="agencia_autos.xsl"?>
<agencia xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="agencia_autos.xsd">
    <titulo>Agencia de Autos ServiDrive</titulo>
    <autos>
${entries}
    </autos>
</agencia>
`;
}

function buildRdf(cars) {
  const entries = cars.map(car => {
    const uri = `https://servidrive.example/vehiculo/${encodeURIComponent(car.id)}`;
    const availability = car.estado === 'Disponible' ? 'InStock' : 'SoldOut';
    const image = car.foto
      ? `\n        <schema:image rdf:resource="${escapeXml(new URL(car.foto, `http://localhost:${PORT}`).href)}" />`
      : '';
    return `    <rdf:Description rdf:about="${escapeXml(uri)}">
        <rdf:type rdf:resource="https://schema.org/Vehicle" />
        <schema:identifier>${escapeXml(car.id)}</schema:identifier>
        <schema:brand>${escapeXml(car.marca)}</schema:brand>
        <schema:model>${escapeXml(car.modelo)}</schema:model>
        <schema:vehicleModelDate>${car.anio}</schema:vehicleModelDate>
        <schema:bodyType>${escapeXml(car.tipo)}</schema:bodyType>
        <schema:vehicleTransmission>${escapeXml(car.transmision)}</schema:vehicleTransmission>
        <schema:mileageFromOdometer>
            <rdf:Description>
                <schema:value>${car.kilometraje}</schema:value>
                <schema:unitCode>KMT</schema:unitCode>
            </rdf:Description>
        </schema:mileageFromOdometer>
        <schema:offers>
            <rdf:Description>
                <rdf:type rdf:resource="https://schema.org/Offer" />
                <schema:price>${car.precio}</schema:price>
                <schema:priceCurrency>MXN</schema:priceCurrency>
                <schema:availability rdf:resource="https://schema.org/${availability}" />
            </rdf:Description>
        </schema:offers>${image}
    </rdf:Description>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<rdf:RDF
    xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
    xmlns:schema="https://schema.org/">
${entries}
</rdf:RDF>
`;
}

function validateCars(input) {
  if (!Array.isArray(input) || input.length > 500) {
    throw new Error('El inventario debe ser una lista válida de hasta 500 vehículos.');
  }
  const ids = new Set();
  return input.map((car, index) => {
    if (!car || typeof car !== 'object' || Array.isArray(car)) {
      throw new Error(`El vehículo ${index + 1} no tiene un formato válido.`);
    }
    const id = String(car.id ?? '');
    if (!/^[A-Za-z0-9_-]{1,32}$/.test(id) || ids.has(id)) {
      throw new Error(`El identificador del vehículo ${index + 1} no es válido o está repetido.`);
    }
    ids.add(id);
    const textFields = ['marca', 'modelo', 'tipo', 'transmision'];
    for (const field of textFields) {
      if (typeof car[field] !== 'string' || !car[field].trim() || car[field].length > 120) {
        throw new Error(`El campo ${field} del vehículo ${id} no es válido.`);
      }
    }
    const anio = Number(car.anio);
    const precio = Number(car.precio);
    const kilometraje = Number(car.kilometraje);
    if (!Number.isInteger(anio) || anio < 1886 || anio > 2100
      || !Number.isFinite(precio) || precio <= 0
      || !Number.isInteger(kilometraje) || kilometraje < 0) {
      throw new Error(`El año, precio o kilometraje del vehículo ${id} no es válido.`);
    }
    if (!['Disponible', 'Vendida'].includes(car.estado)) {
      throw new Error(`El estado del vehículo ${id} no es válido.`);
    }
    return {
      id,
      marca: car.marca.trim(),
      modelo: car.modelo.trim(),
      anio,
      tipo: car.tipo.trim(),
      precio,
      kilometraje,
      transmision: car.transmision.trim(),
      estado: car.estado,
      foto: typeof car.foto === 'string' ? car.foto : ''
    };
  });
}

async function savePhoto(car) {
  const dataUri = car.foto.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (dataUri) {
    const extension = dataUri[1] === 'jpeg' ? 'jpg' : dataUri[1];
    const contents = Buffer.from(dataUri[2], 'base64');
    if (contents.length === 0 || contents.length > 5 * 1024 * 1024) {
      throw new Error(`La foto del vehículo ${car.id} supera el tamaño permitido de 5 MB.`);
    }
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    const filename = `${car.id}.${extension}`;
    await fs.writeFile(path.join(UPLOADS_DIR, filename), contents);
    return `/uploads/${filename}`;
  }
  if (car.foto && !new RegExp(`^/uploads/${car.id}\\.(jpg|png|webp)$`).test(car.foto)) {
    throw new Error(`La ruta de la foto del vehículo ${car.id} no es válida.`);
  }
  return car.foto;
}

async function writeFileAtomically(file, contents) {
  const temporary = `${file}.${process.pid}.tmp`;
  await fs.writeFile(temporary, contents);
  await fs.rename(temporary, file);
}

async function persistInventory(cars) {
  const normalized = validateCars(cars);
  for (const car of normalized) car.foto = await savePhoto(car);

  const [xsd, xsl] = await Promise.all([
    fs.readFile(XSD_FILE, 'utf8'),
    fs.readFile(XSL_FILE, 'utf8')
  ]);
  const artifacts = [
    [XML_FILE, buildXml(normalized)],
    [XSD_FILE, xsd],
    [XSL_FILE, xsl],
    [RDF_FILE, buildRdf(normalized)],
    [DATABASE_FILE, `${JSON.stringify(normalized, null, 2)}\n`]
  ];
  for (const [file, contents] of artifacts) await writeFileAtomically(file, contents);
  return normalized;
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    request.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_REQUEST_SIZE) {
        reject(new Error('La solicitud supera el tamaño permitido.'));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new Error('La solicitud no contiene JSON válido.'));
      }
    });
    request.on('error', reject);
  });
}

async function handleApi(request, response, pathname) {
  if (pathname !== '/api/inventory') {
    sendJson(response, 404, { error: 'Ruta de API no encontrada.' });
    return;
  }
  if (request.method === 'GET') {
    try {
      const contents = await fs.readFile(DATABASE_FILE, 'utf8');
      const details = await fs.stat(DATABASE_FILE);
      sendJson(response, 200, {
        initialized: true,
        autos: JSON.parse(contents),
        updatedAt: details.mtime.toISOString()
      });
    } catch (error) {
      if (error.code === 'ENOENT') {
        sendJson(response, 200, { initialized: false, autos: [] });
        return;
      }
      sendJson(response, 500, { error: 'No se pudo leer el inventario guardado.' });
    }
    return;
  }
  if (request.method !== 'PUT') {
    sendJson(response, 405, { error: 'Método no permitido.' });
    return;
  }
  try {
    const body = await readRequestBody(request);
    const saveOperation = writeQueue.then(() => persistInventory(body.autos));
    writeQueue = saveOperation.then(() => undefined, () => undefined);
    const autos = await saveOperation;
    sendJson(response, 200, { autos, updatedAt: new Date().toISOString() });
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'No se pudo guardar el inventario.' });
  }
}

async function handleStatic(request, response, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestedPath);
  } catch {
    response.writeHead(400);
    response.end('Ruta inválida.');
    return;
  }
  const file = path.resolve(ROOT, `.${decodedPath}`);
  if (file !== ROOT && !file.startsWith(`${ROOT}${path.sep}`)) {
    response.writeHead(403);
    response.end('Acceso denegado.');
    return;
  }
  try {
    const contents = await fs.readFile(file);
    response.writeHead(200, {
      'Content-Type': MIME_TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff'
    });
    response.end(contents);
  } catch (error) {
    response.writeHead(error.code === 'ENOENT' ? 404 : 500);
    response.end(error.code === 'ENOENT' ? 'No encontrado.' : 'No se pudo leer el archivo.');
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    await handleApi(request, response, url.pathname);
    return;
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405);
    response.end('Método no permitido.');
    return;
  }
  await handleStatic(request, response, url.pathname);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`ServiDrive está listo en http://localhost:${PORT}`);
  console.log('Al guardar el inventario se regeneran agencia_autos.xml, agencia_autos.xsd, agencia_autos.xsl y servidrive-inventario.rdf.');
});

server.on('error', error => {
  console.error(`No se pudo iniciar ServiDrive: ${error.message}`);
  process.exitCode = 1;
});

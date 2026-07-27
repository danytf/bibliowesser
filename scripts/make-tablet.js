// Genera index-tablet.html a partir de index.html: mismo contenido, pero
// el array `videos` de cada ONG se recorta a una seleccion curada y las
// URLs de YouTube se sustituyen por rutas locales videos/{ong}/{slug}.mp4
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', 'index.html');
const OUT = path.join(__dirname, '..', 'index-tablet.html');

// Titulos a conservar por ONG (deben coincidir exactamente con el campo `titulo`)
const SELECCION = {
  aecc: [
    'Todo cambia. Todos Contra el Cáncer 2026',
    'Tratamiento y apoyo lejos de casa: el testimonio de Víctor',
    'Testimonio de paciente con cáncer de hígado: la historia de Esther García',
  ],
  cruzroja: [
    '160 Aniversario de Cruz Roja Española',
    'Historia Extraordinaria — José Ignacio, un ejemplo a seguir',
    'Así fue 2025 — Cruz Roja Española',
  ],
  wwf: [
    'WWF Informe Planeta Vivo 2024 — La naturaleza está desapareciendo',
    'Tres años, 400 hectáreas y un objetivo: recuperar Doñana',
    'Los momentazos de Territorio Lince 2025',
  ],
  fjc: [
    'El mejor anuncio del mundo',
    'La historia de Carmen — Imparable contra la leucemia linfoblástica aguda',
    '¡Ya somos más de 150.000 socios contra la leucemia!',
  ],
  fpm: [
    'Por un futuro sin Alzheimer',
    '100.000 socios — Esther y Víctor Manuel',
    '¿Cómo empieza el Alzheimer? — Conoce la Investigación',
  ],
  fec: [
    'Salva vidas con Ariadna: actúa a tiempo ante una parada cardiaca',
    'Parte de mí: vivir con una cardiopatía congénita',
    'Semana del Corazón 2025',
  ],
  aldeas: [
    '¿Qué hacemos en Aldeas Infantiles SOS?',
    'Dos hermanas, una historia de vida: crecer en Aldeas Infantiles SOS',
    'AcogES+: Tú puedes dar una oportunidad a niños, niñas y adolescentes',
  ],
};

function slug(s) {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Encuentra el substring balanceado "videos":[ ... ] dentro de una linea JSON cruda
function findVideosSpan(line) {
  const key = '"videos":';
  const keyStart = line.indexOf(key);
  if (keyStart === -1) throw new Error('no "videos" key found');
  let i = keyStart + key.length;
  while (line[i] !== '[') i++;
  const arrStart = i;
  let depth = 0, inStr = false, esc = false;
  for (; i < line.length; i++) {
    const c = line[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === '[') depth++;
    else if (c === ']') { depth--; if (depth === 0) { i++; break; } }
  }
  return { keyStart, end: i };
}

let html = fs.readFileSync(SRC, 'utf8');
const lines = html.split('\n');

for (const id of Object.keys(SELECCION)) {
  const lineIdx = lines.findIndex(l => l.includes(`id="data-${id}"`));
  if (lineIdx === -1) throw new Error(`no data block for ${id}`);
  const line = lines[lineIdx];

  const jsonStart = line.indexOf('>', line.indexOf(`id="data-${id}"`)) + 1;
  const jsonEnd = line.indexOf('</script>', jsonStart);
  const data = JSON.parse(line.slice(jsonStart, jsonEnd));

  const wanted = SELECCION[id];
  const filtered = wanted.map(titulo => {
    const v = data.videos.find(x => x.titulo === titulo);
    if (!v) throw new Error(`video no encontrado en ${id}: ${titulo}`);
    return { ...v, url: `videos/${id}/${slug(v.titulo)}.mp4` };
  });

  const { keyStart, end } = findVideosSpan(line);
  const newArr = '"videos":' + JSON.stringify(filtered);
  lines[lineIdx] = line.slice(0, keyStart) + newArr + line.slice(end);
}

let out = lines.join('\n');

// safeUrl() del original solo admite http(s):// (bloquea rutas locales por seguridad).
// En la version tablet ademas se permiten rutas relativas videos/{ong}/{archivo}.mp4
const oldSafeUrl = "function safeUrl(u){return(typeof u==='string'&&/^https?:\\/\\//i.test(u.trim()))?u:'#';}";
const newSafeUrl = "function safeUrl(u){if(typeof u!=='string')return'#';var t=u.trim();return(/^https?:\\/\\//i.test(t)||/^videos\\/[\\w-]+\\/[\\w-]+\\.mp4$/i.test(t))?t:'#';}";
if (!out.includes(oldSafeUrl)) throw new Error('safeUrl original no encontrado tal cual, revisar index.html');
out = out.replace(oldSafeUrl, newSafeUrl);

fs.writeFileSync(OUT, out, 'utf8');
console.log('OK ->', OUT);

// Verificacion: cada bloque debe seguir siendo JSON valido
const check = fs.readFileSync(OUT, 'utf8');
const re = /<script type="application\/json" id="data-(\w+)">([\s\S]*?)<\/script>/g;
let m, total = 0;
while ((m = re.exec(check))) {
  const d = JSON.parse(m[2]);
  console.log(m[1], '-> videos:', d.videos.length, d.videos.map(v => v.url));
  total++;
}
console.log('bloques verificados:', total);

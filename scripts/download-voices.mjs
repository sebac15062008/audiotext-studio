import { mkdir, writeFile, access } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public', 'voices');
const HF = 'https://huggingface.co/diffusionstudio/piper-voices/resolve/main';

const SPANISH = {
  'es_ES-davefx-medium': 'es/es_ES/davefx/medium/es_ES-davefx-medium.onnx',
  'es_ES-sharvard-medium': 'es/es_ES/sharvard/medium/es_ES-sharvard-medium.onnx',
  'es_MX-ald-medium': 'es/es_MX/ald/medium/es_MX-ald-medium.onnx',
  'es_MX-claude-high': 'es/es_MX/claude/high/es_MX-claude-high.onnx',
  'es_ES-carlfm-x_low': 'es/es_ES/carlfm/x_low/es_ES-carlfm-x_low.onnx',
  'es_ES-mls_10246-low': 'es/es_ES/mls_10246/low/es_ES-mls_10246-low.onnx',
  'es_ES-mls_9972-low': 'es/es_ES/mls_9972/low/es_ES-mls_9972-low.onnx',
};

const requested = (process.env.PIPER_VOICES || '').trim();
const selected = requested
  ? requested.split(',').filter((id) => SPANISH[id])
  : Object.keys(SPANISH);

if (!selected.length) {
  console.error('No hay voces válidas en PIPER_VOICES.');
  process.exit(1);
}

await mkdir(OUT, { recursive: true });

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function download(url, dest) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} al descargar ${url}`);
  await pipeline(Readable.fromWeb(res.body), (await import('node:fs')).createWriteStream(dest));
}

const files = [];
for (const id of selected) {
  const remote = SPANISH[id];
  const name = remote.split('/').pop();
  for (const suffix of ['', '.json']) {
    const file = `${name}${suffix}`;
    const dest = join(OUT, file);
    if (await exists(dest)) {
      console.log(`Ya existe: ${file}`);
    } else {
      process.stdout.write(`Descargando ${file}… `);
      await download(`${HF}/${remote}${suffix}`, dest);
      console.log('listo');
    }
    files.push(file);
  }
}

await writeFile(join(OUT, 'manifest.json'), JSON.stringify(files, null, 2));
console.log(`\nManifiesto actualizado con ${files.length} archivos en public/voices`);

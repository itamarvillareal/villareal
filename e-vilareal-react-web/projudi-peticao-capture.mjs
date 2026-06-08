// projudi-peticao-capture.mjs — captura passiva do fluxo de PETICIONAMENTO (PROJUDI-GO)
// Rodar de dentro de e-vilareal-react-web: node projudi-peticao-capture.mjs
// Se faltar o navegador: npx playwright install chromium
import { chromium } from 'playwright';
import { mkdirSync, createWriteStream, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = './projudi-peticao-capture';
mkdirSync(join(OUT, 'bodies'), { recursive: true });
mkdirSync(join(OUT, 'uploads'), { recursive: true });
const log = createWriteStream(join(OUT, 'requests.jsonl'), { flags: 'a' });

const HOST = 'projudi.tjgo.jus.br';
const SKIP = new Set(['image', 'stylesheet', 'font', 'media']);
const INTEREST = new RegExp(
  ['Peticion','Movimenta','Juntar','Juntada','Protocol','Upload','Arquivo','Anexo','Anexar',
   'Documento','Assinatura','Assinar','TipoDocumento','TipoPeticao','TipoMovimentacao',
   'BuscaProcesso','Processo','Usuario','LogOn'].join('|'), 'i');

function redact(s) {
  if (!s) return s;
  return String(s)
    .replace(/(Senha=)[^&]*/gi, '$1***')
    .replace(/(codigoOtp=)[^&]*/gi, '$1***')
    .replace(/(Usuario=)[^&]*/gi, '$1***')
    .replace(/(senha"?\s*[:=]\s*"?)[^"&,}]*/gi, '$1***');
}
function safeName(url, i) {
  return String(i).padStart(4, '0') + '_' +
    url.replace(/^https?:\/\//, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 80);
}
function redactHeaders(h) {
  const out = {};
  for (const [k, v] of Object.entries(h || {})) {
    if (/cookie|authorization/i.test(k)) out[k] = '***'; else out[k] = v;
  }
  return out;
}
function extractMultipartFieldNames(postData) {
  const names = []; const re = /name="([^"]+)"(?:;\s*filename="([^"]*)")?/g; let m;
  while ((m = re.exec(postData)) !== null) {
    names.push(m[2] !== undefined ? m[1] + ' (arquivo: ' + m[2] + ')' : m[1]);
  }
  return names;
}

let counter = 0;
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
});
const page = await context.newPage();

context.on('request', (req) => {
  try {
    const url = req.url();
    if (!url.includes(HOST)) return;
    if (SKIP.has(req.resourceType())) return;
    counter += 1; const i = counter;
    const method = req.method();
    const headers = req.headers();
    const ctype = headers['content-type'] || '';
    const isMultipart = /multipart\/form-data/i.test(ctype);
    const entry = { i, t: new Date().toISOString(), kind: 'request', method,
      url: redact(url), resourceType: req.resourceType(), contentType: ctype,
      headers: redactHeaders(headers) };
    const postData = req.postData();
    if (method !== 'GET' && postData) {
      if (isMultipart) {
        const buf = req.postDataBuffer();
        const fname = safeName(url, i) + '.multipart.bin';
        try { writeFileSync(join(OUT, 'uploads', fname), buf ?? Buffer.from(postData)); } catch (_) {}
        entry.multipart = { file: 'uploads/' + fname, bytes: buf ? buf.length : postData.length,
          fields: extractMultipartFieldNames(postData) };
        writeFileSync(join(OUT, 'uploads', safeName(url, i) + '.meta.json'), JSON.stringify(entry, null, 2));
      } else {
        entry.body = redact(postData).slice(0, 20000);
      }
    }
    log.write(JSON.stringify(entry) + '\n');
    if (INTEREST.test(url)) console.log('  -> [' + i + '] ' + method + ' ' + url.replace(/^https?:\/\/[^/]+/, ''));
  } catch (_) {}
});

context.on('response', async (res) => {
  try {
    const req = res.request();
    const url = req.url();
    if (!url.includes(HOST)) return;
    if (SKIP.has(req.resourceType())) return;
    const status = res.status();
    const headers = res.headers();
    const ctype = headers['content-type'] || '';
    const interesting = INTEREST.test(url);
    const textual = /json|html|text|javascript/i.test(ctype);
    const entry = { t: new Date().toISOString(), kind: 'response', method: req.method(),
      url: redact(url), status, contentType: ctype };
    if (interesting && textual && status < 400) {
      try {
        const body = await res.text();
        const ext = /json/i.test(ctype) ? 'json' : /html/i.test(ctype) ? 'html' : 'txt';
        const fname = safeName(url, ++counter) + '.' + ext;
        writeFileSync(join(OUT, 'bodies', fname), redact(body));
        entry.bodyFile = 'bodies/' + fname; entry.bodyBytes = body.length;
      } catch (_) {}
    }
    log.write(JSON.stringify(entry) + '\n');
  } catch (_) {}
});

console.log('\n==============================================================');
console.log(' CAPTURA DE PETICIONAMENTO - PROJUDI-GO (passiva, uso unico)');
console.log('==============================================================');
console.log(' 1) Login (token do e-mail).');
console.log(' 2) Busque o processo e entre em "Peticionar / Movimentar".');
console.log(' 3) Selecione o tipo, preencha e FACA O UPLOAD do PDF.');
console.log(' 4) PROTOCOLE ate o fim e abra o comprovante.');
console.log(' 5) Feche o navegador. Saida em ./projudi-peticao-capture/');
console.log('==============================================================\n');

await page.goto('https://projudi.tjgo.jus.br/', { waitUntil: 'domcontentloaded' });

browser.on('disconnected', () => {
  log.end();
  console.log('\nCaptura encerrada. Veja ./projudi-peticao-capture/ (requests.jsonl, bodies/, uploads/).');
  process.exit(0);
});

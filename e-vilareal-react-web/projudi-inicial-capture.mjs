// projudi-inicial-capture.mjs — captura passiva da DISTRIBUIÇÃO de petição inicial (PROJUDI-GO)
import { chromium } from 'playwright';
import { mkdirSync, createWriteStream, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = './projudi-inicial-capture';
mkdirSync(join(OUT, 'bodies'), { recursive: true });
mkdirSync(join(OUT, 'uploads'), { recursive: true });
const log = createWriteStream(join(OUT, 'requests.jsonl'), { flags: 'a' });

const HOST = 'projudi.tjgo.jus.br';
const SKIP = new Set(['image', 'stylesheet', 'font', 'media']);
const INTEREST = new RegExp(
  ['Distrib','Inicial','Protocol','Processo','Cadastr','Parte','Assunto','Classe',
   'Competenc','Vara','Comarca','Custas','Gratuid','ValorCausa','Peticion','InsercaoArquivo',
   'Arquivo','Anexo','Upload','Assinatura','Movimenta','Usuario','LogOn'].join('|'), 'i');

function redact(s){ if(!s) return s; return String(s)
  .replace(/(Senha=)[^&]*/gi,'$1***').replace(/(codigoOtp=)[^&]*/gi,'$1***')
  .replace(/(Usuario=)[^&]*/gi,'$1***').replace(/(senha"?\s*[:=]\s*"?)[^"&,}]*/gi,'$1***'); }
function safeName(url,i){ return String(i).padStart(4,'0')+'_'+url.replace(/^https?:\/\//,'')
  .replace(/[^a-z0-9]+/gi,'_').slice(0,80); }
function redactHeaders(h){ const o={}; for(const[k,v] of Object.entries(h||{}))
  o[k]=/cookie|authorization/i.test(k)?'***':v; return o; }
function multipartFields(pd){ const n=[]; const re=/name="([^"]+)"(?:;\s*filename="([^"]*)")?/g; let m;
  while((m=re.exec(pd))!==null) n.push(m[2]!==undefined?m[1]+' (arquivo: '+m[2]+')':m[1]); return n; }

let counter=0;
const browser=await chromium.launch({ headless:false });
const context=await browser.newContext({ userAgent:
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' });
const page=await context.newPage();

context.on('request',(req)=>{ try{
  const url=req.url(); if(!url.includes(HOST))return; if(SKIP.has(req.resourceType()))return;
  counter+=1; const i=counter; const method=req.method(); const headers=req.headers();
  const ctype=headers['content-type']||''; const isMP=/multipart\/form-data/i.test(ctype);
  const entry={ i, t:new Date().toISOString(), kind:'request', method, url:redact(url),
    resourceType:req.resourceType(), contentType:ctype, headers:redactHeaders(headers) };
  const pd=req.postData();
  if(method!=='GET'&&pd){
    if(isMP){ const buf=req.postDataBuffer(); const fn=safeName(url,i)+'.multipart.bin';
      try{ writeFileSync(join(OUT,'uploads',fn), buf??Buffer.from(pd)); }catch(_){}
      entry.multipart={ file:'uploads/'+fn, bytes:buf?buf.length:pd.length, fields:multipartFields(pd) };
      writeFileSync(join(OUT,'uploads',safeName(url,i)+'.meta.json'), JSON.stringify(entry,null,2));
    } else { entry.body=redact(pd).slice(0,20000); }
  }
  log.write(JSON.stringify(entry)+'\n');
  if(INTEREST.test(url)) console.log('  -> ['+i+'] '+method+' '+url.replace(/^https?:\/\/[^/]+/,''));
}catch(_){}});

context.on('response',async(res)=>{ try{
  const req=res.request(); const url=req.url(); if(!url.includes(HOST))return;
  if(SKIP.has(req.resourceType()))return;
  const status=res.status(); const ctype=(res.headers()['content-type']||'');
  const interesting=INTEREST.test(url); const textual=/json|html|text|javascript/i.test(ctype);
  const entry={ t:new Date().toISOString(), kind:'response', method:req.method(),
    url:redact(url), status, contentType:ctype };
  if(interesting&&textual&&status<400){ try{ const body=await res.text();
    const ext=/json/i.test(ctype)?'json':/html/i.test(ctype)?'html':'txt';
    const fn=safeName(url,++counter)+'.'+ext; writeFileSync(join(OUT,'bodies',fn), redact(body));
    entry.bodyFile='bodies/'+fn; entry.bodyBytes=body.length; }catch(_){} }
  log.write(JSON.stringify(entry)+'\n');
}catch(_){}});

console.log('\n==============================================================');
console.log(' CAPTURA DE PETICAO INICIAL / DISTRIBUICAO - PROJUDI-GO');
console.log('==============================================================');
console.log(' 1) Login (token do e-mail).');
console.log(' 2) Inicie a DISTRIBUICAO de inicial (Protocolar Inicial / Distribuir).');
console.log(' 3) Preencha classe, assunto, partes, valor; anexe os arquivos.');
console.log(' 4) VA ATE a tela de revisao/confirmacao e PARE. NAO clique em distribuir.');
console.log(' 5) Feche o navegador. Saida em ./projudi-inicial-capture/');
console.log('==============================================================\n');

await page.goto('https://projudi.tjgo.jus.br/', { waitUntil:'domcontentloaded' });
browser.on('disconnected',()=>{ log.end();
  console.log('\nCaptura encerrada. Veja ./projudi-inicial-capture/ (requests.jsonl, bodies/, uploads/).');
  process.exit(0); });

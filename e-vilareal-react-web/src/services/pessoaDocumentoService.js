const STORAGE_KEY = 'vilareal.cadastroPessoas.documentos.v1';

function carregarMapa() {
  if (typeof window === 'undefined') return new Map();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Map();
    const obj = JSON.parse(raw);
    const map = new Map();
    Object.entries(obj).forEach(([k, v]) => {
      map.set(k, v);
    });
    return map;
  } catch {
    return new Map();
  }
}

function salvarMapa(map) {
  if (typeof window === 'undefined') return;
  const obj = {};
  for (const [k, v] of map.entries()) {
    obj[k] = v;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

export function listarPessoasComDocumento() {
  const map = carregarMapa();
  const ids = [];
  for (const [id, lista] of map.entries()) {
    if (Array.isArray(lista) && lista.length > 0) ids.push(id);
  }
  return ids;
}

export function obterDocumentoPessoa(pessoaId) {
  if (!pessoaId) return null;
  const id = String(pessoaId);
  const map = carregarMapa();
  const lista = map.get(id);
  if (!Array.isArray(lista) || !lista.length) return null;
  return lista[lista.length - 1];
}

export async function salvarDocumentoPessoa(pessoaId, file, meta = {}) {
  if (!pessoaId || !file) throw new Error('Pessoa e arquivo são obrigatórios.');
  const id = String(pessoaId);
  const map = carregarMapa();
  const lista = Array.isArray(map.get(id)) ? [...map.get(id)] : [];

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  const base64 = btoa(binary);

  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-');
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase();
  const nomePadronizado = `documento_pessoal_${ts}.${ext}`;

  const item = {
    idVersao: lista.length + 1,
    pessoaId: id,
    caminhoVirtual: `/documentos/pessoas/${id}/documento-pessoal/${nomePadronizado}`,
    nomeArquivo: nomePadronizado,
    nomeOriginal: file.name || nomePadronizado,
    mimeType: file.type || 'application/octet-stream',
    tamanhoBytes: file.size || 0,
    dataUploadIso: now.toISOString(),
    status: 'armazenado',
    dadosExtraidos: meta.dadosExtraidos || null,
    observacoes: meta.observacoes || null,
    base64,
  };

  lista.push(item);
  map.set(id, lista);
  salvarMapa(map);
  return item;
}

export function criarUrlParaDocumento(doc) {
  if (!doc || !doc.base64) return null;
  try {
    const bytes = Uint8Array.from(atob(doc.base64), (c) => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: doc.mimeType || 'application/octet-stream' });
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}


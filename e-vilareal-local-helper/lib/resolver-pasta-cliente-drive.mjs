import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const SUBPASTA_CLIENTES = path.join(
  'Drives compartilhados',
  'Villa Real Documentos',
  'Sistema VilaReal',
  'clientes',
  '01 - Ativos',
);

/** Espelha {@code GoogleDriveService.sanitizarNomePasta} no backend Java. */
export function sanitizarNomePasta(nome) {
  if (nome == null || String(nome).trim() === '') return 'Sem Cliente';
  return String(nome)
    .trim()
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, ' ');
}

export function formatarCodigoCliente(codigoCliente) {
  const bruto = String(codigoCliente ?? '').trim();
  if (!bruto) return '00000000';
  const n = Number(bruto);
  if (Number.isFinite(n) && n >= 0) return String(n).padStart(8, '0');
  return bruto;
}

export function formatarNomePastaCliente(codigoCliente, nomeCliente) {
  const codigo = formatarCodigoCliente(codigoCliente);
  const nome = sanitizarNomePasta(String(nomeCliente ?? '').trim() || 'Sem Cliente');
  return `${codigo} - ${nome}`;
}

export function formatarNomePastaProcesso(numeroInterno) {
  const numero = Number(numeroInterno);
  const n = Number.isFinite(numero) && numero > 0 ? numero : 0;
  return `Proc. ${String(n).padStart(2, '0')}`;
}

function diretorioExiste(caminho) {
  try {
    return fs.statSync(caminho).isDirectory();
  } catch {
    return false;
  }
}

/** Varre caminhos típicos do Google Drive Desktop (macOS e Windows). */
export function detectarBaseClientesDrive({ homeDir = os.homedir(), envBase = process.env.VILAREAL_DRIVE_CLIENTES_BASE } = {}) {
  const env = String(envBase ?? '').trim();
  if (env && diretorioExiste(env)) return env;

  const candidatos = [];

  if (process.platform === 'darwin') {
    const cloudStorage = path.join(homeDir, 'Library', 'CloudStorage');
    if (diretorioExiste(cloudStorage)) {
      for (const entry of fs.readdirSync(cloudStorage)) {
        if (entry.startsWith('GoogleDrive')) {
          candidatos.push(path.join(cloudStorage, entry, SUBPASTA_CLIENTES));
        }
      }
    }
    candidatos.push(
      path.join(homeDir, 'Google Drive', SUBPASTA_CLIENTES),
      path.join(homeDir, 'Library', 'CloudStorage', 'GoogleDrive', SUBPASTA_CLIENTES),
    );
  } else if (process.platform === 'win32') {
    candidatos.push(
      path.join(homeDir, 'Google Drive', SUBPASTA_CLIENTES),
      path.join(homeDir, 'Meu Drive', SUBPASTA_CLIENTES),
      path.join('G:', 'Drives compartilhados', 'Villa Real Documentos', 'Sistema VilaReal', 'clientes', '01 - Ativos'),
    );
  }

  for (const candidato of candidatos) {
    if (diretorioExiste(candidato)) return candidato;
  }
  return null;
}

function listarPastas(baseDir) {
  try {
    return fs.readdirSync(baseDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  } catch {
    return [];
  }
}

/**
 * Localiza a pasta do cliente na cópia local do Drive.
 * Prioriza prefixo `{codigo8} -`; se houver nome, tenta match exato sanitizado antes.
 */
export function resolverPastaClienteDrive({
  baseDir,
  codigoCliente,
  nomeCliente,
  numeroInterno = null,
}) {
  if (!baseDir || !diretorioExiste(baseDir)) {
    throw new Error('Pasta base de clientes não encontrada no Google Drive Desktop.');
  }

  const codigo8 = formatarCodigoCliente(codigoCliente);
  const prefixo = `${codigo8} -`;
  const pastas = listarPastas(baseDir);

  let pastaCliente = null;
  if (nomeCliente) {
    const esperado = formatarNomePastaCliente(codigoCliente, nomeCliente);
    pastaCliente = pastas.find((p) => p.name === esperado);
  }
  if (!pastaCliente) {
    pastaCliente = pastas.find((p) => p.name.startsWith(prefixo));
  }
  if (!pastaCliente) {
    throw new Error(`Cliente ${codigo8} não encontrado em ${baseDir}`);
  }

  let caminho = path.join(baseDir, pastaCliente.name);
  if (numeroInterno != null && String(numeroInterno).trim() !== '') {
    const procNome = formatarNomePastaProcesso(numeroInterno);
    const procPath = path.join(caminho, procNome);
    if (diretorioExiste(procPath)) caminho = procPath;
  }
  return caminho;
}

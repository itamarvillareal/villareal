import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  formatarCodigoCliente as formatarCodigoPessoa,
  sanitizarNomePasta,
} from './resolver-pasta-cliente-drive.mjs';

const SUBPASTA_PESSOAS_PT = path.join(
  'Drives compartilhados',
  'Villa Real Documentos',
  'Sistema VilaReal',
  'Pessoas',
);

const SUBPASTA_PESSOAS_EN = path.join(
  'Shared drives',
  'Villa Real Documentos',
  'Sistema VilaReal',
  'Pessoas',
);

const SUBPASTA_PESSOAS_ES = path.join(
  'Unidades compartilhadas',
  'Villa Real Documentos',
  'Sistema VilaReal',
  'Pessoas',
);

const RELATIVOS_PESSOAS = [SUBPASTA_PESSOAS_PT, SUBPASTA_PESSOAS_EN, SUBPASTA_PESSOAS_ES];

export function formatarNomePastaPessoa(pessoaId, nomePessoa) {
  const codigo = formatarCodigoPessoa(pessoaId);
  const nome = sanitizarNomePasta(String(nomePessoa ?? '').trim() || 'Sem Nome');
  return `${codigo} - ${nome}`;
}

function diretorioExiste(caminho) {
  try {
    return fs.statSync(caminho).isDirectory();
  } catch {
    return false;
  }
}

function pushCandidatos(candidatos, base, relativos = RELATIVOS_PESSOAS) {
  for (const rel of relativos) {
    candidatos.push(path.join(base, rel));
  }
}

function candidatosWindows(homeDir) {
  const candidatos = [];
  pushCandidatos(candidatos, path.join(homeDir, 'Google Drive'));
  pushCandidatos(candidatos, path.join(homeDir, 'Meu Drive'));

  for (const letra of 'GHIJKLMNOPQRSTUVWXYZCDEF') {
    const raiz = `${letra}:\\`;
    try {
      if (!fs.statSync(raiz).isDirectory()) continue;
    } catch {
      continue;
    }
    pushCandidatos(candidatos, raiz);
    pushCandidatos(candidatos, path.join(raiz, 'Google Drive'));
  }
  return candidatos;
}

/** Varre caminhos típicos do Google Drive Desktop até a pasta Pessoas/. */
export function detectarBasePessoasDrive({
  homeDir = os.homedir(),
  envBase = process.env.VILAREAL_DRIVE_PESSOAS_BASE,
} = {}) {
  const env = String(envBase ?? '').trim();
  if (env && diretorioExiste(env)) return env;

  const candidatos = [];

  if (process.platform === 'darwin') {
    const cloudStorage = path.join(homeDir, 'Library', 'CloudStorage');
    if (diretorioExiste(cloudStorage)) {
      for (const entry of fs.readdirSync(cloudStorage)) {
        if (entry.startsWith('GoogleDrive')) {
          pushCandidatos(candidatos, path.join(cloudStorage, entry));
        }
      }
    }
    pushCandidatos(candidatos, path.join(homeDir, 'Google Drive'));
    pushCandidatos(candidatos, path.join(homeDir, 'Library', 'CloudStorage', 'GoogleDrive'));
  } else if (process.platform === 'win32') {
    for (const cloudRel of ['CloudStorage', path.join('Library', 'CloudStorage')]) {
      const cloudStorage = path.join(homeDir, cloudRel);
      if (!diretorioExiste(cloudStorage)) continue;
      try {
        for (const entry of fs.readdirSync(cloudStorage)) {
          if (entry.startsWith('GoogleDrive')) {
            pushCandidatos(candidatos, path.join(cloudStorage, entry));
          }
        }
      } catch {
        /* ignorar */
      }
    }
    candidatos.push(...candidatosWindows(homeDir));
  }

  const vistos = new Set();
  for (const candidato of candidatos) {
    const norm = path.normalize(candidato);
    if (vistos.has(norm)) continue;
    vistos.add(norm);
    if (diretorioExiste(norm)) return norm;
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
 * Localiza a pasta da pessoa na cópia local do Drive (Pessoas/{id8} - nome).
 */
export function resolverPastaPessoaDrive({ baseDir, pessoaId, nomePessoa }) {
  if (!baseDir || !diretorioExiste(baseDir)) {
    throw new Error('Pasta base Pessoas não encontrada no Google Drive Desktop.');
  }

  const codigo8 = formatarCodigoPessoa(pessoaId);
  const prefixo = `${codigo8} -`;
  const pastas = listarPastas(baseDir);

  let pastaPessoa = null;
  if (nomePessoa) {
    const esperado = formatarNomePastaPessoa(pessoaId, nomePessoa);
    pastaPessoa = pastas.find((p) => p.name === esperado);
  }
  if (!pastaPessoa) {
    pastaPessoa = pastas.find((p) => p.name.startsWith(prefixo));
  }
  if (!pastaPessoa) {
    throw new Error(`Pessoa ${codigo8} não encontrada em ${baseDir}`);
  }

  return path.join(baseDir, pastaPessoa.name);
}

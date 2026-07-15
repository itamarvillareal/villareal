import readline from 'node:readline/promises';
import os from 'node:os';
import { stdin as input, stdout as output } from 'node:process';
import { detectarBaseClientesDrive } from '../lib/resolver-pasta-cliente-drive.mjs';
import { validarCaminhoBaseClientes } from '../lib/validar-caminho-base-clientes.mjs';

const EXEMPLO_MAC =
  '~/Library/CloudStorage/GoogleDrive-…/Drives compartilhados/Villa Real Documentos/Sistema VilaReal/clientes/01 - Ativos';

function expandirHome(caminho) {
  const s = String(caminho ?? '').trim();
  if (s.startsWith('~/')) {
    return `${os.homedir()}${s.slice(1)}`;
  }
  return s;
}

async function perguntar(rl, texto) {
  const resposta = await rl.question(texto);
  return String(resposta ?? '').trim();
}

/**
 * Detecta ou pergunta a pasta base dos clientes no Google Drive Desktop.
 * @returns {Promise<string>}
 */
export async function resolverBaseClientesInterativo() {
  const detectada = detectarBaseClientesDrive();
  const rl = readline.createInterface({ input, output });

  try {
    if (detectada) {
      console.log('');
      console.log('Pasta de clientes detectada automaticamente:');
      console.log(`  ${detectada}`);
      console.log('');
      const confirmar = await perguntar(rl, 'Usar esta pasta? [S/n]: ');
      if (!confirmar || /^s(sim)?/i.test(confirmar)) {
        return detectada;
      }
    } else {
      console.log('');
      console.log('Não foi possível detectar automaticamente a pasta de clientes.');
      console.log(`Exemplo (macOS): ${EXEMPLO_MAC}`);
      console.log('');
    }

    while (true) {
      const informado = await perguntar(
        rl,
        'Cole o caminho completo da pasta «clientes/01 - Ativos»: ',
      );
      const caminho = await expandirHome(informado);
      const validacao = validarCaminhoBaseClientes(caminho);
      if (validacao.ok) {
        console.log(`\nPasta configurada: ${validacao.caminho}\n`);
        return validacao.caminho;
      }
      console.log(`\n${validacao.erro}\n`);
    }
  } finally {
    rl.close();
  }
}

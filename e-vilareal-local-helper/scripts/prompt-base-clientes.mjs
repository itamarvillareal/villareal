import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { detectarBaseClientesDrive } from '../lib/resolver-pasta-cliente-drive.mjs';
import { validarCaminhoBaseClientes } from '../lib/validar-caminho-base-clientes.mjs';
import { expandirCaminhoUsuario } from '../lib/expandir-caminho-usuario.mjs';

const EXEMPLO_MAC =
  '~/Library/CloudStorage/GoogleDrive-…/Drives compartilhados/Villa Real Documentos/Sistema VilaReal/clientes/01 - Ativos';
const EXEMPLO_WIN =
  'G:\\Drives compartilhados\\Villa Real Documentos\\Sistema VilaReal\\clientes\\01 - Ativos';

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
      console.log(
        process.platform === 'win32'
          ? `Exemplo (Windows): ${EXEMPLO_WIN}`
          : `Exemplo (macOS): ${EXEMPLO_MAC}`,
      );
      console.log('');
    }

    while (true) {
      const informado = await perguntar(
        rl,
        'Cole o caminho completo da pasta «clientes/01 - Ativos»: ',
      );
      const caminho = expandirCaminhoUsuario(informado);
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

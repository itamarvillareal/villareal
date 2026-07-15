import {
  detectarSOUsuario,
  instaladorLocalHelperParaSO,
} from '../utils/detectarSOUsuario.js';

export function mensagemLocalHelperIndisponivel(so = detectarSOUsuario()) {
  const instalador = instaladorLocalHelperParaSO(so);
  const gerenciador = so === 'windows' ? 'Explorer' : 'Finder';

  let msg =
    `Para abrir a pasta no ${gerenciador}, instale o agente local (uma vez nesta máquina).\n\n` +
    'Abra Configurações no sistema e baixe o instalador do seu sistema operacional.';

  if (instalador) {
    msg += `\n\nDepois de baixar:\n1. Extraia o zip\n2. Execute ${so === 'windows' ? 'Instalar-Pasta-Local-VillaReal.bat' : 'Instalar-Pasta-Local-VillaReal.command'}`;
  }

  if (so === 'macos') {
    msg +=
      '\n\nSe você tem o código do projeto neste Mac, também pode rodar no Terminal:\n' +
      '  bash ~/Documents/villareal/e-vilareal-local-helper/install.sh';
  }

  if (so === 'windows') {
    msg +=
      '\n\nNo Windows, se já instalou:\n' +
      '1. Abra %LOCALAPPDATA%\\VillaReal\\local-helper\\Iniciar-Agente-VillaReal.bat\n' +
      '2. No navegador, teste http://127.0.0.1:9876/health (deve mostrar {"ok":true})\n' +
      '3. Se falhar, veja o log em %USERPROFILE%\\.vilareal\\local-helper.log';
  }

  msg += '\n\nRequer Node.js (https://nodejs.org). O Google Drive Desktop precisa estar sincronizado.';
  msg += '\n\nSe o navegador pedir permissão para «rede local», clique em Permitir.';
  return msg;
}

export const MENSAGEM_LOCAL_HELPER_INDISPONIVEL = mensagemLocalHelperIndisponivel();

export function tituloBotaoPastaLocal({ ativo, baseClientes, so = detectarSOUsuario() } = {}) {
  const gerenciador = so === 'windows' ? 'Explorer' : 'Finder';
  const base = ativo
    ? `Abre a pasta do cliente no ${gerenciador} (Google Drive Desktop sincronizado localmente).`
    : `Agente local inativo — instale em Configurações (instalador ${so === 'windows' ? 'Windows' : 'macOS'}).`;
  if (ativo && baseClientes) {
    return `${base}\n\nBase detectada: ${baseClientes}`;
  }
  return base;
}

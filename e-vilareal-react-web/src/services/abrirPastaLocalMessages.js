export const MENSAGEM_LOCAL_HELPER_INDISPONIVEL =
  'Para abrir a pasta no Finder, instale o agente local (uma vez por máquina).\n\n' +
  'Abra Configurações no sistema e baixe o instalador para macOS ou Windows.\n\n' +
  'Ou, se tiver o código-fonte:\n' +
  '  cd ~/Documents/villareal && npm run local-helper:install\n\n' +
  'O Google Drive Desktop precisa estar sincronizado.';

export function tituloBotaoPastaLocal({ ativo, baseClientes } = {}) {
  const base = ativo
    ? 'Abre a pasta do cliente no Finder (Google Drive Desktop sincronizado localmente).'
    : 'Agente local inativo — instale com npm run local-helper:install';
  if (ativo && baseClientes) {
    return `${base}\n\nBase detectada: ${baseClientes}`;
  }
  return base;
}

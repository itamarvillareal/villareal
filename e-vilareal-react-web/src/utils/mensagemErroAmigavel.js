/**
 * Remove sufixo técnico `/api/...` que o backend envia no JSON (campo path).
 */
export function normalizarMensagemErroApi(raw) {
  return String(raw || '')
    .replace(/\s*—\s*\/api\/[^\s]+.*$/i, '')
    .trim();
}

/** Mensagens do backend (422) em português — preservar texto original na UI. */
function pareceMensagemNegocioApi(msg) {
  if (!msg) return false;
  return !/exception|stack trace|nullpointer|java\.|org\.springframework/i.test(msg)
    && !/^error:/i.test(msg)
    && !/^\s*at\s+/m.test(msg);
}

/**
 * Enriquece erros conhecidos do fluxo «Baixar Arquivos para Assinar» (Diagnósticos).
 */
function enriquecerMensagemPrepararAssinar(msg, contexto) {
  const lower = msg.toLowerCase();

  if (/nenhum pdf disponível para nova assinatura|já constam como protocolados/i.test(lower)) {
    return msg;
  }

  if (/nenhum pdf pendente|nenhum pdf encontrado|sem arquivos/i.test(lower)) {
    if (/pasta.*assinar|google drive|drive/i.test(lower)) {
      return msg;
    }
    return (
      `${msg} Verifique se cada processo tem PDFs na subpasta «Assinar» no Google Drive ` +
      '(não em Petição, Movimentações ou outras pastas). PDFs já assinados na fila PROJUDI são ignorados.'
    );
  }

  if (/pdf.*n[aã]o encontrado|store-dir|n[aã]o est[aá] no servidor/i.test(lower)) {
    return (
      'O PDF foi registrado na fila, mas o arquivo sumiu do servidor (comum após reinício do sistema). ' +
      'Clique em «Preparar e baixar ZIP» de novo para buscar os PDFs no Drive. ' +
      'Se repetir, contacte o suporte.'
    );
  }

  if (/google drive.*n[aã]o.*configurado/i.test(lower)) {
    return 'Integração com Google Drive indisponível. Contacte o suporte técnico.';
  }

  if (/credencial.*obrigat/i.test(lower)) {
    return 'Selecione a credencial PROJUDI antes de continuar.';
  }

  if (/falha ao gerar zip/i.test(lower)) {
    return msg.replace(/^Falha ao gerar ZIP:\s*/i, 'Não foi possível montar o ZIP: ');
  }

  if (contexto === 'gerar o ZIP para assinar') {
    return `Não foi possível gerar o ZIP: ${msg}`;
  }
  if (contexto === 'preparar os PDFs da pasta Assinar') {
    return `Não foi possível preparar os PDFs: ${msg}`;
  }

  return msg;
}

/**
 * Converte erros técnicos (API/rede) em mensagens legíveis para o usuário final.
 */
export function mensagemErroAmigavel(erro, contexto = '') {
  const raw =
    typeof erro === 'string'
      ? erro
      : erro?.message || erro?.error || (erro != null ? String(erro) : '');

  let msg = normalizarMensagemErroApi(raw);
  const lower = msg.toLowerCase();

  if (!msg) {
    return contexto
      ? `Não foi possível concluir: ${contexto}. Tente novamente.`
      : 'Não foi possível carregar os dados. Tente novamente.';
  }

  if (/clienteid.*obrigat|cliente.*obrigatório/i.test(lower)) {
    return 'Não foi possível carregar as tarefas. Tente novamente ou contacte o suporte.';
  }

  if (
    /failed to fetch|networkerror|load failed|sem ligação|network error|aborted/i.test(lower)
  ) {
    const emDevLocal =
      typeof window !== 'undefined'
      && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (emDevLocal) {
      return (
        'Sem conexão com o backend local. Inicie o servidor Java (pasta e-vilareal-java-backend: ./scripts/run-dev.sh) ' +
        'ou acesse o portal em produção.'
      );
    }
    return 'Sem conexão com o servidor. Verifique sua internet e tente novamente.';
  }

  if (/\b(401|403)\b/.test(msg) || /não autorizado|nao autorizado|forbidden/i.test(lower)) {
    return 'Sua sessão expirou ou você não tem permissão. Faça login novamente.';
  }

  if (/\b404\b/.test(msg) || /not found|não encontrad/i.test(lower)) {
    return contexto
      ? `${contexto} não encontrado.`
      : 'Registro não encontrado.';
  }

  if (
    /\b413\b/.test(msg)
    || /payload too large|entity too large|request entity too large|demasiado grande|excedeu o tamanho/i.test(
      lower,
    )
  ) {
    return contexto === 'enviar os arquivos assinados'
      ? 'Os arquivos .p7s selecionados são grandes demais (limite: 250 MB por envio). '
          + 'Divida em lotes menores e tente novamente.'
      : 'O envio excedeu o tamanho máximo permitido (250 MB). Reduza o lote e tente novamente.';
  }

  if (/\b(500|502|503|504)\b/.test(msg) || /internal server|erro no servidor/i.test(lower)) {
    return 'O servidor está indisponível no momento. Tente novamente em instantes.';
  }

  const ctxPreparar =
    contexto === 'preparar e baixar os arquivos para assinar'
    || contexto === 'preparar os PDFs da pasta Assinar'
    || contexto === 'gerar o ZIP para assinar';

  if (ctxPreparar || pareceMensagemNegocioApi(msg)) {
    const enriquecida = enriquecerMensagemPrepararAssinar(msg, contexto);
    if (enriquecida.length <= 480) {
      return enriquecida;
    }
    return `${enriquecida.slice(0, 477)}…`;
  }

  if (/^error:/i.test(msg) || /\/api\//i.test(msg) || /exception|stack trace/i.test(lower)) {
    return contexto
      ? `Não foi possível ${contexto}. Tente novamente.`
      : 'Não foi possível carregar os dados. Tente novamente.';
  }

  if (msg.length > 180) {
    return contexto
      ? `Não foi possível ${contexto}. Tente novamente.`
      : 'Ocorreu um erro inesperado. Tente novamente.';
  }

  return msg;
}

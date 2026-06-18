/**
 * Converte erros técnicos (API/rede) em mensagens legíveis para o usuário final.
 * Nunca expõe stack trace, status HTTP cru ou endpoints na UI.
 */
export function mensagemErroAmigavel(erro, contexto = '') {
  const raw =
    typeof erro === 'string'
      ? erro
      : erro?.message || erro?.error || (erro != null ? String(erro) : '');

  const msg = String(raw || '').trim();
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

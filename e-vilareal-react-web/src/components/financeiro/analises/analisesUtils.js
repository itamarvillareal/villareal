/** Percentual de lançamentos fora de IMPORTADO (N). */
export function pctClassificado(totalLancamentos, pendentesImportado) {
  const total = Number(totalLancamentos) || 0;
  const pendentes = Number(pendentesImportado) || 0;
  if (total <= 0) return 0;
  return Math.round(((total - pendentes) / total) * 100);
}

export function rotuloConfianca(confianca) {
  const c = String(confianca ?? '').toUpperCase();
  if (c === 'ALTA') return 'Alta';
  if (c === 'MEDIA') return 'Média';
  if (c === 'BAIXA') return 'Baixa';
  return c || '—';
}

export function chavePadraoRecorrencia(p) {
  return `${p?.descricaoNorm ?? ''}|${p?.numeroBanco ?? ''}`;
}

export function somaCandidatosExato(p) {
  return Number(p?.qtdPendentesExato ?? 0) + Number(p?.qtdCompletarExato ?? 0);
}

export function somaCandidatosAprox(p) {
  return Number(p?.qtdPendentesAprox ?? 0) + Number(p?.qtdCompletarAprox ?? 0);
}

export function novosExato(p) {
  return Number(p?.qtdPendentesExato ?? 0);
}

export function novosAprox(p) {
  return Number(p?.qtdPendentesAprox ?? 0);
}

export function completarExato(p) {
  const exato = Number(p?.qtdCompletarExato ?? 0);
  if (exato > 0) return exato;
  return Number(p?.qtdParaCompletar ?? 0);
}

export function completarAprox(p) {
  return Number(p?.qtdCompletarAprox ?? 0);
}

export function qtdDivergentes(p) {
  return Number(p?.qtdDivergentes ?? 0);
}

/** Total acionável alinhado ao filtro GET (precisaoValor). */
export function somaAcionaveis(p, precisaoValor = 'EXATO') {
  if (p?.qtdAcionaveis != null && Number.isFinite(Number(p.qtdAcionaveis))) {
    return Number(p.qtdAcionaveis);
  }
  if (precisaoValor === 'IGNORAR_VALOR') {
    return somaCandidatosExato(p) + somaCandidatosAprox(p) + qtdDivergentes(p);
  }
  if (precisaoValor === 'TODOS') {
    return somaCandidatosExato(p) + somaCandidatosAprox(p);
  }
  return somaCandidatosExato(p);
}

/** Padrão com lançamentos pendentes (classificar ou completar) no filtro atual. */
export function padraoAcionavel(p, precisaoValor = 'EXATO') {
  return somaAcionaveis(p, precisaoValor) > 0;
}

export function valorFixoPadrao(p) {
  return p?.valorFixo === true;
}

/** Título do card: descrição + data completa quando disponível. */
export function rotuloDescricaoComData(padrao, formatData = (iso) => iso) {
  const desc = padrao?.descricaoExemplo ?? '—';
  const data = padrao?.dataExemplo ? formatData(padrao.dataExemplo) : null;
  return data ? `${desc} · ${data}` : desc;
}

export function limparVinculoSugeridoPadrao(padrao) {
  if (!padrao) return padrao;
  return {
    ...padrao,
    clienteId: null,
    clienteNome: null,
    processoId: null,
    processoNumero: null,
    parteCliente: null,
    parteOposta: null,
    consistenciaVinculo: null,
  };
}

/** Precisão enviada à API a partir do toggle global Valor. */
export function precisaoApiModo(precisaoValorFiltro = 'EXATO') {
  if (precisaoValorFiltro === 'TODOS') return 'TODOS';
  if (precisaoValorFiltro === 'IGNORAR_VALOR') return 'IGNORAR_VALOR';
  return 'EXATO';
}

/** Novos vs completar no modo global (exato, +aprox ou só nome). */
export function contagemEscopoModo(p, precisaoValor = 'EXATO') {
  if (precisaoValor === 'IGNORAR_VALOR') {
    const novos = Number(p?.qtdPendentes ?? 0);
    const completar = Number(p?.qtdParaCompletar ?? 0);
    const divergentes = qtdDivergentes(p);
    return { novos, completar, divergentes, total: somaAcionaveis(p, precisaoValor) };
  }
  if (precisaoValor === 'TODOS') {
    const novos = novosExato(p) + novosAprox(p);
    const completar = completarExato(p) + completarAprox(p);
    return { novos, completar, divergentes: 0, total: novos + completar };
  }
  return {
    novos: novosExato(p),
    completar: completarExato(p),
    divergentes: 0,
    total: somaAcionaveis(p, 'EXATO'),
  };
}

/** Texto de escopo: "2 lançamentos (1 novo · 1 a completar)". */
export function textoEscopoLancamentos(p, precisaoValor = 'EXATO') {
  const { novos, completar, divergentes, total } = contagemEscopoModo(p, precisaoValor);
  if (total <= 0) return '0 lançamentos';
  const partes = [];
  if (novos > 0) partes.push(`${novos} novo${novos === 1 ? '' : 's'}`);
  if (completar > 0) partes.push(`${completar} a completar`);
  if (precisaoValor === 'IGNORAR_VALOR' && divergentes > 0) {
    partes.push(`${divergentes} divergente${divergentes === 1 ? '' : 's'}`);
  }
  const det = partes.length > 0 ? ` (${partes.join(' · ')})` : '';
  return `${total} lançamento${total === 1 ? '' : 's'}${det}`;
}

/** Alvo unificado: conta + vínculo sugerido. */
export function rotuloAlvoPadrao(padrao) {
  const codigo = padrao?.contaCodigo ?? '?';
  const extras = [
    padrao?.clienteNome,
    padrao?.processoNumero ? `proc ${padrao.processoNumero}` : null,
  ].filter(Boolean);
  if (extras.length === 0) return `→ ${codigo}`;
  return `→ ${codigo} · ${extras.join(' · ')}`;
}

/** Rótulo do botão principal do card. */
export function rotuloBotaoPrincipal(padrao, precisaoValor = 'EXATO') {
  const total = somaAcionaveis(padrao, precisaoValor);
  const n = total.toLocaleString('pt-BR');
  if (precisaoValor === 'IGNORAR_VALOR') return `Confirmar (${n})`;
  const isMedia = String(padrao?.confianca ?? '').toUpperCase() === 'MEDIA';
  if (isMedia) return `Revisar (${n})`;
  return `Aplicar (${n})`;
}

/** Escopo/precisão únicos por card — modo global, sempre TODOS. */
export function resolverAcaoCard(precisaoValorFiltro = 'EXATO') {
  return {
    escopo: 'TODOS',
    precisaoValor: precisaoApiModo(precisaoValorFiltro),
  };
}

/** @deprecated use {@link resolverAcaoCard} */
export function resolverAcaoAprovarVinculo(padrao, precisaoValorFiltro = 'EXATO') {
  return resolverAcaoCard(precisaoValorFiltro);
}

const LIMIAR_CONSISTENCIA_PERFEITA = 0.9995;
const TOLERANCIA_APROX = 0.05;

/** Valor fora do modal (não exato nem ±5%). */
export function valorDivergeDoModal(valor, valorModal) {
  const v = Number(valor);
  const modal = Number(valorModal);
  if (!Number.isFinite(v) || !Number.isFinite(modal)) return true;
  if (Math.abs(v - modal) < 0.005) return false;
  const ref = Math.abs(modal);
  if (ref < 1e-9) return true;
  return Math.abs(v - modal) / ref > TOLERANCIA_APROX;
}

/** Lançamentos de preview cujo valor não corrobora o histórico. */
export function filtrarLancamentosDivergentes(lancamentos, valorModal) {
  if (valorModal == null) return [];
  return (Array.isArray(lancamentos) ? lancamentos : []).filter((l) =>
    valorDivergeDoModal(l?.valor, valorModal),
  );
}

/** Padrão com confiança Alta e consistência histórica (e vínculo, se houver) em 100%. */
export function padraoConfiancaPerfeita(p) {
  if (String(p?.confianca ?? '').toUpperCase() !== 'ALTA') return false;
  if (Number(p?.consistenciaConta ?? 0) < LIMIAR_CONSISTENCIA_PERFEITA) return false;
  const vinculo = p?.consistenciaVinculo;
  if (vinculo != null && Number(vinculo) < LIMIAR_CONSISTENCIA_PERFEITA) return false;
  return true;
}

export function pctConsistenciaConta(p) {
  return Math.round(Number(p?.consistenciaConta ?? 0) * 100);
}

/** Parâmetros de aplicarRecorrencia para aprovação em lote (sem diálogo). */
export function resolverAcaoLoteRecorrencia(_padrao, precisaoValorFiltro = 'EXATO') {
  return resolverAcaoCard(precisaoValorFiltro);
}

/** @deprecated unificado em uma chamada TODOS por modo */
export function resolverAcoesExtrasLoteRecorrencia() {
  return [];
}

/** Elegível para aprovação em massa automática (nunca no modo só nome). */
export function padraoElegivelAprovarTodos(p, precisaoValorFiltro = 'EXATO') {
  if (precisaoValorFiltro === 'IGNORAR_VALOR') return false;
  if (String(p?.confianca ?? '').toUpperCase() !== 'ALTA') return false;
  return somaAcionaveis(p, precisaoValorFiltro) > 0;
}

/** Elegível para lote com seleção manual (inclui só nome; exclui confiança média). */
export function padraoElegivelLoteSelecionado(p, precisaoValorFiltro = 'EXATO') {
  if (!padraoAcionavel(p, precisaoValorFiltro)) return false;
  if (precisaoValorFiltro === 'IGNORAR_VALOR') return true;
  return String(p?.confianca ?? '').toUpperCase() === 'ALTA';
}

/** IDs de botões esperados no card (para testes de UI simplificada). */
export function idsBotoesCard(precisaoValor = 'EXATO') {
  const principal = precisaoValor === 'IGNORAR_VALOR' ? 'confirmar' : 'aplicar';
  return [principal, 'descartar'];
}

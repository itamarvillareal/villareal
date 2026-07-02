/** @param {string | null | undefined} cod */
export function normalizarCodigoUnidadeCobranca(cod) {
  return String(cod ?? '')
    .trim()
    .toUpperCase();
}

/** @param {string | null | undefined} doc */
function docValido(doc) {
  const d = String(doc ?? '').replace(/\D/g, '');
  return d.length === 11 || d.length === 14;
}

/**
 * Preenche proprietário das unidades da extração PDF com a planilha Condo Id (prioridade sobre legado/DB).
 * @param {Record<string, unknown> | null | undefined} extracao
 * @param {Record<string, unknown> | null | undefined} extracaoPlanilha
 */
export function mesclarProprietariosPlanilhaNaExtracao(extracao, extracaoPlanilha) {
  const mapPlanilha = new Map();
  for (const u of extracaoPlanilha?.unidades || []) {
    const cod = normalizarCodigoUnidadeCobranca(u?.codigoUnidade);
    if (cod) mapPlanilha.set(cod, u);
  }

  const unidadesAtualizadas = [];
  const semProprietario = [];

  for (const u of extracao?.unidades || []) {
    const cod = normalizarCodigoUnidadeCobranca(u?.codigoUnidadeNormalizada || u?.codigoUnidade);
    const legadoNome = String(u?.proprietarioLegadoNome ?? '').trim();
    const legadoDoc = String(u?.proprietarioLegadoDocDigitos ?? '').replace(/\D/g, '');

    const lin = mapPlanilha.get(cod);
    const prop = lin?.proprietario;
    let nome = '';
    let doc = '';

    if (prop && docValido(prop.cpfCnpjNormalizado ?? prop.cpfCnpjBruto)) {
      nome = String(prop.nome ?? '').trim();
      doc = String(prop.cpfCnpjNormalizado ?? prop.cpfCnpjBruto ?? '').replace(/\D/g, '');
    } else if (docValido(legadoDoc)) {
      nome = legadoNome;
      doc = legadoDoc;
    }

    if (!nome || !docValido(doc)) {
      semProprietario.push(cod || '?');
    }

    unidadesAtualizadas.push({
      ...u,
      codigoUnidadeNormalizada: cod || u?.codigoUnidadeNormalizada,
      proprietarioNome: nome,
      proprietarioDocDigitos: doc,
      proprietarioLegadoNome: legadoNome,
      proprietarioLegadoDocDigitos: legadoDoc,
    });
  }

  const debitos = unidadesAtualizadas.reduce(
    (acc, u) => acc + (Array.isArray(u.cobrancas) ? u.cobrancas.length : 0),
    0,
  );
  let pf = 0;
  let pj = 0;
  for (const u of unidadesAtualizadas) {
    const n = String(u.proprietarioDocDigitos ?? '').replace(/\D/g, '').length;
    if (n === 11) pf += 1;
    else if (n === 14) pj += 1;
  }
  const valorTotalCentavos = unidadesAtualizadas.reduce((acc, u) => {
    const list = u.cobrancas;
    if (!Array.isArray(list)) return acc;
    return acc + list.reduce((s, c) => s + (Number(c?.valorCentavos) || 0), 0);
  }, 0);

  return {
    ...extracao,
    unidades: unidadesAtualizadas,
    unidadesSemProprietario: semProprietario,
    totais: {
      ...(extracao?.totais || {}),
      unidades: unidadesAtualizadas.length,
      debitos,
      pf,
      pj,
      valorTotalCentavos,
    },
  };
}

/** @param {Record<string, unknown> | null | undefined} extracao @param {Record<string, unknown> | null | undefined} planilha */
export function montarPayloadDiagnosticoProprietarios(clienteCodigo, extracao, planilha) {
  const unidades = (extracao?.unidades || []).map((u) => ({
    codigoUnidadeNormalizada: normalizarCodigoUnidadeCobranca(
      u?.codigoUnidadeNormalizada || u?.codigoUnidade,
    ),
    proprietarioNome: String(u?.proprietarioNome ?? ''),
    proprietarioDocDigitos: String(u?.proprietarioDocDigitos ?? '').replace(/\D/g, ''),
    cobrancas: Array.isArray(u?.cobrancas) ? u.cobrancas : [],
    proprietarioLegadoNome: u?.proprietarioLegadoNome ?? null,
    proprietarioLegadoDocDigitos: u?.proprietarioLegadoDocDigitos ?? null,
  }));
  return {
    clienteCodigo: String(clienteCodigo ?? '').trim(),
    unidades,
    planilhaUnidades: planilha?.unidades || [],
  };
}

/**
 * API imóvel + vínculo N:N (imovel_processo) — V67+.
 * Fallback PUT legado se POST /processos retornar 404 (backend pré-V67).
 */

function isEndpointProcessosIndisponivel(status, text) {
  return status === 404 && /No static resource|not found/i.test(text || '');
}

export async function buscarImovelPorClientePlanilha(baseUrl, token, clientePk, numeroPlanilha) {
  const q = new URLSearchParams({ clienteId: String(clientePk) });
  const res = await fetch(
    `${baseUrl}/api/imoveis/por-numero-planilha/${numeroPlanilha}?${q}`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }
  );
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GET imovel planilha ${numeroPlanilha} cliente ${clientePk}: ${res.status} ${t.slice(0, 200)}`);
  }
  const im = await res.json();
  if (im.clienteId != null && Number(im.clienteId) !== Number(clientePk)) {
    return null;
  }
  return im;
}

export async function listarVinculosProcessoImovel(baseUrl, token, imovelId) {
  const res = await fetch(`${baseUrl}/api/imoveis/${imovelId}/processos`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  const t = await res.text();
  if (res.status === 404 && isEndpointProcessosIndisponivel(res.status, t)) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`GET imovel processos: ${res.status} ${t.slice(0, 200)}`);
  }
  return t ? JSON.parse(t) : [];
}

export async function criarImovel(baseUrl, token, body) {
  const res = await fetch(`${baseUrl}/api/imoveis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const t = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, text: t };
  }
  return { ok: true, imovel: JSON.parse(t) };
}

export async function atualizarImovelLegado(baseUrl, token, imovelId, body) {
  const res = await fetch(`${baseUrl}/api/imoveis/${imovelId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const t = await res.text();
  if (!res.ok) {
    return { ok: false, status: res.status, text: t };
  }
  return { ok: true, imovel: JSON.parse(t) };
}

/**
 * Garante imóvel do cliente com nº planilha; cria se não existir para esse cliente (UK por cliente).
 */
export async function garantirImovelClientePlanilha(
  baseUrl,
  token,
  clientePk,
  numeroPlanilha,
  extras = {}
) {
  let imovel = await buscarImovelPorClientePlanilha(baseUrl, token, clientePk, numeroPlanilha);
  if (imovel?.id) {
    return { imovel, criado: false };
  }
  const body = {
    clienteId: clientePk,
    numeroPlanilha,
    situacao: 'DESOCUPADO',
    ativo: true,
    observacoes: extras.observacoes ?? `Vínculo Proc/0.89.1 (planilha ${numeroPlanilha}).`,
  };
  const criado = await criarImovel(baseUrl, token, body);
  if (!criado.ok) {
    throw new Error(`POST imovel: ${criado.status} ${criado.text?.slice(0, 200)}`);
  }
  return { imovel: criado.imovel, criado: true };
}

/**
 * Vincula processo via POST /api/imoveis/{id}/processos (V67).
 * Se endpoint ausente (404 static resource), fallback PUT imovel.processo_id.
 */
export async function vincularProcessoImovel(
  baseUrl,
  token,
  imovel,
  processoId,
  observacao,
  clientePk
) {
  const imovelId = imovel.id;
  const res = await fetch(`${baseUrl}/api/imoveis/${imovelId}/processos`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      processoId,
      observacao: observacao ?? 'Vínculo Proc/0.89.1.',
    }),
  });
  const t = await res.text();
  if (res.status === 201 || res.ok) {
    return { ok: true, modo: 'imovel_processo', idempotente: false };
  }
  if (res.status === 409 || /duplicate|unique|já vinculado|ja vinculado/i.test(t)) {
    return { ok: true, modo: 'imovel_processo', idempotente: true };
  }
  if (isEndpointProcessosIndisponivel(res.status, t)) {
    const putBody = {
      clienteId: clientePk ?? imovel.clienteId,
      processoId,
      numeroPlanilha: imovel.numeroPlanilha ?? null,
      situacao: imovel.situacao ?? 'DESOCUPADO',
      ativo: imovel.ativo ?? true,
      observacoes: imovel.observacoes ?? observacao ?? null,
      titulo: imovel.titulo ?? null,
      enderecoCompleto: imovel.enderecoCompleto ?? null,
      condominio: imovel.condominio ?? null,
      unidade: imovel.unidade ?? null,
      tipoImovel: imovel.tipoImovel ?? null,
      garagens: imovel.garagens ?? null,
      inscricaoImobiliaria: imovel.inscricaoImobiliaria ?? null,
      camposExtrasJson: imovel.camposExtrasJson ?? null,
      responsavelPessoaId: imovel.responsavelPessoaId ?? null,
    };
    const legado = await atualizarImovelLegado(baseUrl, token, imovelId, putBody);
    if (!legado.ok) {
      return {
        ok: false,
        status: legado.status,
        text: legado.text,
        hint: 'Rebuild do backend Java (V67) necessário para POST /api/imoveis/{id}/processos',
      };
    }
    return { ok: true, modo: 'legado_put', idempotente: false };
  }
  return { ok: false, status: res.status, text: t };
}

export async function jaVinculadoProcesso(baseUrl, token, imovel, processoId) {
  const vinculos = await listarVinculosProcessoImovel(baseUrl, token, imovel.id);
  if (vinculos === null) {
    return Number(imovel.processoId) === Number(processoId);
  }
  return vinculos.some((v) => Number(v.processoId) === Number(processoId));
}

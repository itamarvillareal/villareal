export const CADASTRO_TODOS = 'todos';
export const CADASTRO_PLENO = 'pleno';
export const CADASTRO_PARCIAL = 'parcial';

const VALIDOS = new Set([CADASTRO_PLENO, CADASTRO_PARCIAL]);

export function parseCadastroFiltroParam(params) {
  const raw = String(params.get('cadastro') ?? '').trim().toLowerCase();
  if (!raw || raw === CADASTRO_TODOS) return CADASTRO_TODOS;
  return VALIDOS.has(raw) ? raw : CADASTRO_TODOS;
}

export function cadastroParaQueryApi(cadastro) {
  const v = String(cadastro ?? CADASTRO_TODOS).trim().toLowerCase();
  if (v === CADASTRO_PLENO) return { cadastroPlenitude: 'PLENO' };
  if (v === CADASTRO_PARCIAL) return { cadastroPlenitude: 'PARCIAL' };
  return { cadastroPlenitude: undefined };
}

export function rotuloCadastroFiltro(cadastro) {
  const v = String(cadastro ?? CADASTRO_TODOS).trim().toLowerCase();
  if (v === CADASTRO_PLENO) return 'Cadastro pleno';
  if (v === CADASTRO_PARCIAL) return 'Cadastro parcial';
  return 'Cadastro';
}

/**
 * Espelha regras do backend para badges/indicadores na UI.
 * @returns {'pleno'|'parcial'|'importado'|null}
 */
export function classificarCadastroExtratoRow(row) {
  const cod = String(row?.contaCodigo ?? 'N').trim().toUpperCase() || 'N';
  if (cod === 'N') return 'importado';

  if (cod === 'A') {
    return temCodigoEProcExtratoRow(row) ? 'pleno' : 'parcial';
  }

  if (cod === 'E') {
    const grupo = String(row?.grupoCompensacao ?? '').trim();
    return grupo ? 'pleno' : 'parcial';
  }

  return 'pleno';
}

/** Conta Escritório (A): código de cliente e processo preenchidos. */
export function temCodigoEProcExtratoRow(row) {
  const temCliente =
    (row?.clienteId != null && Number(row.clienteId) > 0) ||
    String(row?.codCliente ?? '').trim() !== '';
  const temProc =
    (row?.processoId != null && Number(row.processoId) > 0) ||
    String(row?.proc ?? '').trim() !== '';
  return temCliente && temProc;
}

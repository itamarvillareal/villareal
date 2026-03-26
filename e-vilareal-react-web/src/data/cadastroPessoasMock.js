/** Lista estática para modo offline — sem dados de demonstração. */
export const CADASTRO_PESSOAS_MOCK = [];

function inferirTipoPessoaMock(cpf) {
  const d = String(cpf ?? '').replace(/\D/g, '');
  if (d.length >= 12 && d.length <= 14) return 'JURIDICA';
  if (d.length >= 11) return 'FISICA';
  return null;
}

export function getCadastroPessoasMock(apenasAtivos) {
  const base = apenasAtivos ? CADASTRO_PESSOAS_MOCK.filter((p) => p.ativo) : [...CADASTRO_PESSOAS_MOCK];
  return base.map((p) => {
    if (p.id === 1) {
      const resp = CADASTRO_PESSOAS_MOCK.find((x) => x.id === 2);
      if (!resp) return { ...p, responsavelId: null, responsavel: null };
      return {
        ...p,
        responsavelId: 2,
        responsavel: {
          id: resp.id,
          nome: resp.nome,
          cpf: resp.cpf,
          tipoPessoa: inferirTipoPessoaMock(resp.cpf),
        },
      };
    }
    return {
      ...p,
      responsavelId: p.responsavelId ?? null,
      responsavel: p.responsavel ?? null,
    };
  });
}

let __pessoaPorId;
/** @returns {{ id: number, nome: string, cpf: string, email?: string } | null} */
export function getPessoaPorId(id) {
  const n = Number(id);
  if (!Number.isFinite(n)) return null;
  if (!__pessoaPorId) {
    __pessoaPorId = new Map(CADASTRO_PESSOAS_MOCK.map((p) => [p.id, p]));
  }
  return __pessoaPorId.get(n) ?? null;
}

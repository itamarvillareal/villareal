/**
 * Árvore de tópicos: ramos (`children`) ou folha com lista selecionável (`items`).
 * Estrutura recursiva — novos níveis = novos `children`; último nível = `items` + checkboxes na UI.
 */

export const TOPICOS_RAIZ = {
  id: '_raiz',
  label: 'Início',
  children: [
    {
      id: 'contratos',
      label: 'CONTRATOS',
      children: [
        {
          id: 'contratos-cv',
          label: 'COMPRA E VENDA + CONFISSÃO DE DÍVIDA',
          items: [
            { id: 'contratos-cv-1', label: 'CARTEIRA DE CLIENTES' },
            { id: 'contratos-cv-2', label: 'COM GARANTIA' },
            { id: 'contratos-cv-3', label: 'IMÓVEL' },
            { id: 'contratos-cv-4', label: 'PERMUTA' },
            { id: 'contratos-cv-5', label: 'VEÍCULOS' },
            { id: 'contratos-cv-6', label: 'OUTROS BENS' },
            { id: 'contratos-cv-7', label: 'CLÁUSULAS ESPECIAIS' },
            { id: 'contratos-cv-8', label: 'FORMA DE PAGAMENTO' },
            { id: 'contratos-cv-9', label: 'DOCUMENTAÇÃO' },
            { id: 'contratos-cv-10', label: 'REGISTRO' },
            { id: 'contratos-cv-11', label: 'OBRIGAÇÕES ACESSÓRIAS' },
            { id: 'contratos-cv-12', label: 'DISPOSIÇÕES FINAIS' },
          ],
        },
        { id: 'contratos-trab', label: 'DE TRABALHO', items: [{ id: 'ct-1', label: 'Item exemplo trabalho 1' }] },
        { id: 'contratos-gar', label: 'GARANTIDORA', items: [{ id: 'cg-1', label: 'Item exemplo garantia 1' }] },
        { id: 'contratos-hon', label: 'HONORÁRIOS ADVOCATÍCIOS', items: [{ id: 'ch-1', label: 'Item exemplo honorários 1' }] },
        { id: 'contratos-imob', label: 'INTERMEDIAÇÃO IMOBILIÁRIA', items: [{ id: 'ci-1', label: 'Item exemplo imobiliária 1' }] },
        { id: 'contratos-loc', label: 'LOCAÇÃO', items: [{ id: 'cl-1', label: 'Item exemplo locação 1' }] },
        { id: 'contratos-mus', label: 'SERVIÇOS MUSICAIS', items: [{ id: 'cm-1', label: 'Item exemplo musical 1' }] },
      ],
    },
    {
      id: 'dativos',
      label: 'DATIVOS',
      children: [
        {
          id: 'dativos-n1',
          label: 'NÍVEL DATIVOS A',
          children: [
            {
              id: 'dativos-n2',
              label: 'NÍVEL DATIVOS B',
              items: [
                { id: 'd-1', label: 'Tópico dativo 1' },
                { id: 'd-2', label: 'Tópico dativo 2' },
                { id: 'd-3', label: 'Tópico dativo 3' },
              ],
            },
          ],
        },
      ],
    },
    { id: 'impugnacoes', label: 'IMPUGNAÇÕES', items: [{ id: 'imp-1', label: 'Fundamentação' }] },
    { id: 'inicial', label: 'INICIAL', items: [{ id: 'ini-1', label: 'Fatos' }] },
    { id: 'recurso', label: 'RECURSO', items: [{ id: 'rec-1', label: 'Preliminares' }] },
    { id: 'requerimentos', label: 'REQUERIMENTOS', items: [{ id: 'req-1', label: 'Pedido genérico' }] },
  ],
};

/**
 * @param {TopicoNo} root
 * @param {string[]} stackIds ids do caminho a partir dos filhos da raiz (não inclui _raiz)
 * @returns {TopicoNo | null}
 */
export function resolverNoPorCaminho(root, stackIds) {
  let node = root;
  for (const id of stackIds) {
    const next = node.children?.find((c) => c.id === id);
    if (!next) return null;
    node = next;
  }
  return node;
}

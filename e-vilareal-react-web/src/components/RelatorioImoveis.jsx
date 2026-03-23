import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { getImovelMock, getImoveisMockTotal } from '../data/imoveisMockData.js';
import { padCliente } from '../data/processosDadosRelatorio.js';

function s(v) {
  if (v == null) return '';
  return String(v);
}

/**
 * Colunas na mesma ordem lógica do cadastro Imóveis (identificação → endereço → locação/IPTU → utilidades → contrato/cond. → banco → partes).
 */
const COLUNAS = [
  { key: 'id', label: 'Nº', narrow: true, mono: false },
  { key: 'codigoPadded', label: 'Cód. cliente', narrow: true, mono: true },
  { key: 'proc', label: 'Proc.', narrow: true },
  { key: 'endereco', label: 'Endereço', truncate: true },
  { key: 'condominio', label: 'Condomínio', truncate: true },
  { key: 'unidade', label: 'Unidade', truncate: true },
  { key: 'garagens', label: 'Garagens', narrow: true },
  { key: 'ocupado', label: 'Ocupado', narrow: true },
  { key: 'observacoesInquilino', label: 'Obs. inquilino', truncate: true },
  { key: 'garantia', label: 'Garantia' },
  { key: 'valorGarantia', label: 'Valor garantia', right: true },
  { key: 'valorLocacao', label: 'Valor locação', right: true },
  { key: 'diaPagAluguel', label: 'Dia pag. aluguel', narrow: true },
  { key: 'dataPag1TxCond', label: 'Data 1ª tx cond.', narrow: true },
  { key: 'inscricaoImobiliaria', label: 'Insc. imobiliária' },
  { key: 'existeDebIptu', label: 'Existe déb. IPTU', narrow: true },
  { key: 'dataConsIptu', label: 'Cons. IPTU', narrow: true },
  { key: 'aguaNumero', label: 'Nº conta água' },
  { key: 'dataConsAgua', label: 'Cons. água', narrow: true },
  { key: 'existeDebAgua', label: 'Déb. água', narrow: true },
  { key: 'diaVencAgua', label: 'Venc. água (dia)', narrow: true },
  { key: 'energiaNumero', label: 'Nº conta energia' },
  { key: 'dataConsEnergia', label: 'Cons. energia', narrow: true },
  { key: 'existeDebEnergia', label: 'Déb. energia', narrow: true },
  { key: 'diaVencEnergia', label: 'Venc. energia (dia)', narrow: true },
  { key: 'gasNumero', label: 'Nº conta gás' },
  { key: 'dataConsGas', label: 'Cons. gás', narrow: true },
  { key: 'existeDebGas', label: 'Déb. gás', narrow: true },
  { key: 'diaVencGas', label: 'Venc. gás (dia)', narrow: true },
  { key: 'dataInicioContrato', label: 'Início contrato', narrow: true },
  { key: 'dataFimContrato', label: 'Fim contrato', narrow: true },
  { key: 'dataConsDebitoCond', label: 'Cons. déb. cond.', narrow: true },
  { key: 'existeDebitoCond', label: 'Déb. cond.', narrow: true },
  { key: 'diaRepasse', label: 'Dia repasse', narrow: true },
  { key: 'banco', label: 'Banco' },
  { key: 'numeroBanco', label: 'Nº banco', narrow: true },
  { key: 'agencia', label: 'Agência', narrow: true },
  { key: 'conta', label: 'Conta', narrow: true },
  { key: 'cpfBanco', label: 'CPF (conta)', narrow: true },
  { key: 'chavePix', label: 'Chave Pix' },
  { key: 'titular', label: 'Titular', truncate: true },
  { key: 'proprietarioNumeroPessoa', label: 'Nº pessoa prop.', narrow: true },
  { key: 'proprietario', label: 'Proprietário', truncate: true },
  { key: 'proprietarioCpf', label: 'CPF prop.', narrow: true },
  { key: 'proprietarioContato', label: 'Contato prop.', truncate: true },
  { key: 'inquilinoNumeroPessoa', label: 'Nº pessoa inq.', narrow: true },
  { key: 'inquilino', label: 'Inquilino', truncate: true },
  { key: 'inquilinoCpf', label: 'CPF inq.', narrow: true },
  { key: 'inquilinoContato', label: 'Contato inq.', truncate: true },
  { key: 'linkVistoria', label: 'Link vistoria', truncate: true },
];

function linhaFromMock(id, m) {
  return {
    id,
    codigoPadded: padCliente(m.codigo),
    proc: m.proc,
    endereco: s(m.endereco),
    condominio: s(m.condominio),
    unidade: s(m.unidade),
    garagens: s(m.garagens),
    ocupado: m.imovelOcupado ? 'Sim' : 'Não',
    observacoesInquilino: s(m.observacoesInquilino),
    garantia: s(m.garantia),
    valorGarantia: s(m.valorGarantia),
    valorLocacao: s(m.valorLocacao),
    diaPagAluguel: s(m.diaPagAluguel),
    dataPag1TxCond: s(m.dataPag1TxCond),
    inscricaoImobiliaria: s(m.inscricaoImobiliaria),
    existeDebIptu: s(m.existeDebIptu),
    dataConsIptu: s(m.dataConsIptu),
    aguaNumero: s(m.aguaNumero),
    dataConsAgua: s(m.dataConsAgua),
    existeDebAgua: s(m.existeDebAgua),
    diaVencAgua: s(m.diaVencAgua),
    energiaNumero: s(m.energiaNumero),
    dataConsEnergia: s(m.dataConsEnergia),
    existeDebEnergia: s(m.existeDebEnergia),
    diaVencEnergia: s(m.diaVencEnergia),
    gasNumero: s(m.gasNumero),
    dataConsGas: s(m.dataConsGas),
    existeDebGas: s(m.existeDebGas),
    diaVencGas: s(m.diaVencGas),
    dataInicioContrato: s(m.dataInicioContrato),
    dataFimContrato: s(m.dataFimContrato),
    dataConsDebitoCond: s(m.dataConsDebitoCond),
    existeDebitoCond: s(m.existeDebitoCond),
    diaRepasse: s(m.diaRepasse),
    banco: s(m.banco),
    numeroBanco: s(m.numeroBanco),
    agencia: s(m.agencia),
    conta: s(m.conta),
    cpfBanco: s(m.cpfBanco),
    chavePix: s(m.chavePix),
    titular: s(m.titular),
    proprietarioNumeroPessoa: s(m.proprietarioNumeroPessoa),
    proprietario: s(m.proprietario),
    proprietarioCpf: s(m.proprietarioCpf),
    proprietarioContato: s(m.proprietarioContato),
    inquilinoNumeroPessoa: s(m.inquilinoNumeroPessoa),
    inquilino: s(m.inquilino),
    inquilinoCpf: s(m.inquilinoCpf),
    inquilinoContato: s(m.inquilinoContato),
    linkVistoria: s(m.linkVistoria),
  };
}

function textoBuscaLinha(r) {
  return COLUNAS.map((c) => s(r[c.key])).join(' ').toLowerCase();
}

/**
 * Listagem consolidada dos imóveis mock (mesma base do cadastro Imóveis).
 */
export function RelatorioImoveis() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');

  const linhas = useMemo(() => {
    const total = getImoveisMockTotal();
    const out = [];
    for (let id = 1; id <= total; id++) {
      const m = getImovelMock(id);
      if (!m) continue;
      out.push(linhaFromMock(id, m));
    }
    return out;
  }, []);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return linhas;
    return linhas.filter((r) => textoBuscaLinha(r).includes(t));
  }, [linhas, busca]);

  const th = 'px-3 py-2 text-left text-xs font-semibold text-slate-700 border-b border-slate-200 bg-slate-100 whitespace-nowrap';
  const td = 'px-3 py-2 text-sm text-slate-800 border-b border-slate-100 align-top';

  return (
    <div className="min-h-full bg-slate-200 p-4">
      <div className="max-w-[1600px] mx-auto space-y-4">
        <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-5">
          <h1 className="text-xl font-bold text-slate-800">Relatório Imóveis</h1>
          <p className="text-sm text-slate-600 mt-1">
            Visão tabular do cadastro de imóveis (colunas alinhadas à tela <strong>Imóveis</strong>). Use a barra de rolagem
            horizontal para ver todos os campos. Clique numa linha para abrir o imóvel no cadastro.
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate-300 shadow-sm p-4">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Filtrar por qualquer coluna (endereço, contas, datas, nomes…)"
                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-sm"
              />
            </div>
            <span className="text-xs text-slate-500">
              {filtradas.length} de {linhas.length} registro(s)
            </span>
          </div>

          <div className="overflow-x-auto rounded border border-slate-200">
            <table className="w-full text-left border-collapse min-w-[2400px]">
              <thead>
                <tr>
                  {COLUNAS.map((col) => (
                    <th
                      key={col.key}
                      className={`${th} ${col.right ? 'text-right' : ''}`}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-blue-50/60 cursor-pointer"
                    onClick={() => navigate('/imoveis', { state: { imovelId: r.id } })}
                  >
                    {COLUNAS.map((col) => {
                      const val = r[col.key];
                      const base = `${td} ${col.right ? 'text-right tabular-nums' : ''} ${col.mono ? 'font-mono text-xs' : ''} ${col.narrow ? 'tabular-nums' : ''}`;
                      const cellClass = col.truncate ? `${base} max-w-[200px] truncate` : base;
                      return (
                        <td key={col.key} className={cellClass} title={col.truncate && val ? val : undefined}>
                          {col.key === 'id' ? <span className="font-medium">{val}</span> : val}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {filtradas.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-8">Nenhum registro com o filtro atual.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

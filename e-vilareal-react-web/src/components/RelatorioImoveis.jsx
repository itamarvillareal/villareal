import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowUp, ArrowUpDown, Building2, RefreshCw, Search } from 'lucide-react';
import { carregarItensRelatorioImoveisApi } from '../repositories/imoveisRepository.js';
import { featureFlags } from '../config/featureFlags.js';

function s(v) {
  if (v == null) return '';
  return String(v);
}

function codigoClientePadded(codigoRaw) {
  const cod = String(codigoRaw ?? '').replace(/\D/g, '');
  const n = Number(cod || '0');
  if (!cod || !Number.isFinite(n) || n <= 0) return '';
  return String(Math.floor(n)).padStart(8, '0');
}

/** Converte o objeto de UI do cadastro (mapApiToUi) em linha da tabela do relatório. */
function mapCadastroUiParaLinha(item) {
  return {
    id: item.imovelId,
    apiImovelId: item._apiImovelId,
    codigoPadded: codigoClientePadded(item.codigo),
    proc: s(item.proc),
    endereco: s(item.endereco),
    condominio: s(item.condominio),
    unidade: s(item.unidade),
    garagens: s(item.garagens),
    ocupado: item.imovelOcupado ? 'Sim' : 'Não',
    observacoesInquilino: s(item.observacoesInquilino),
    garantia: s(item.garantia),
    valorGarantia: s(item.valorGarantia),
    valorLocacao: s(item.valorLocacao),
    diaPagAluguel: s(item.diaPagAluguel),
    dataPag1TxCond: s(item.dataPag1TxCond),
    inscricaoImobiliaria: s(item.inscricaoImobiliaria),
    existeDebIptu: s(item.existeDebIptu),
    dataConsIptu: s(item.dataConsIptu),
    aguaNumero: s(item.aguaNumero),
    dataConsAgua: s(item.dataConsAgua),
    existeDebAgua: s(item.existeDebAgua),
    diaVencAgua: s(item.diaVencAgua),
    energiaNumero: s(item.energiaNumero),
    dataConsEnergia: s(item.dataConsEnergia),
    existeDebEnergia: s(item.existeDebEnergia),
    diaVencEnergia: s(item.diaVencEnergia),
    gasNumero: s(item.gasNumero),
    dataConsGas: s(item.dataConsGas),
    existeDebGas: s(item.existeDebGas),
    diaVencGas: s(item.diaVencGas),
    dataInicioContrato: s(item.dataInicioContrato),
    dataFimContrato: s(item.dataFimContrato),
    dataConsDebitoCond: s(item.dataConsDebitoCond),
    existeDebitoCond: s(item.existeDebitoCond),
    diaRepasse: s(item.diaRepasse),
    banco: s(item.banco),
    numeroBanco: s(item.numeroBanco),
    agencia: s(item.agencia),
    conta: s(item.conta),
    cpfBanco: s(item.cpfBanco),
    chavePix: s(item.chavePix),
    titular: s(item.titular),
    proprietarioNumeroPessoa: s(item.proprietarioNumeroPessoa),
    proprietario: s(item.proprietario),
    proprietarioCpf: s(item.proprietarioCpf),
    proprietarioContato: s(item.proprietarioContato),
    inquilinoNumeroPessoa: s(item.inquilinoNumeroPessoa),
    inquilino: s(item.inquilino),
    inquilinoCpf: s(item.inquilinoCpf),
    inquilinoContato: s(item.inquilinoContato),
    linkVistoria: s(item.linkVistoria),
  };
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
  { key: 'inquilinoContato', label: 'Contato inq.', narrow: true },
  { key: 'linkVistoria', label: 'Link vistoria', truncate: true },
];

function textoBuscaLinha(r) {
  return COLUNAS.map((c) => s(r[c.key])).join(' ').toLowerCase();
}

/** Tipo de comparação por coluna (demais tratadas como texto). */
const ORDENACAO_TIPO = {
  id: 'numero',
  proc: 'numero',
  garagens: 'numero',
  valorGarantia: 'numero',
  valorLocacao: 'numero',
  diaPagAluguel: 'numero',
  diaVencAgua: 'numero',
  diaVencEnergia: 'numero',
  diaVencGas: 'numero',
  diaRepasse: 'numero',
  proprietarioNumeroPessoa: 'numero',
  inquilinoNumeroPessoa: 'numero',
  dataPag1TxCond: 'dataBr',
  dataConsIptu: 'dataBr',
  dataConsAgua: 'dataBr',
  dataConsEnergia: 'dataBr',
  dataConsGas: 'dataBr',
  dataInicioContrato: 'dataBr',
  dataFimContrato: 'dataBr',
  dataConsDebitoCond: 'dataBr',
};

function parseDataBrParaMs(str) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(str ?? '').trim());
  if (!m) return Number.NaN;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return Number.isNaN(d.getTime()) ? Number.NaN : d.getTime();
}

function parseNumeroMoedaOuDia(str) {
  const t = String(str ?? '').trim();
  if (!t) return Number.NaN;
  const soDigitos = t.replace(/\D/g, '');
  if (soDigitos && /^\d+$/.test(soDigitos) && t.length <= 3) {
    const n = Number(soDigitos);
    return Number.isFinite(n) ? n : Number.NaN;
  }
  const normalizado = t.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, '');
  const n = Number(normalizado);
  return Number.isFinite(n) ? n : Number.NaN;
}

function valorOrdenacaoCelula(row, colKey) {
  const tipo = ORDENACAO_TIPO[colKey] ?? 'texto';
  const raw = row[colKey];

  if (tipo === 'numero') {
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    if (colKey === 'id' || colKey === 'proc') {
      const n = Number(String(raw).replace(/\D/g, ''));
      return Number.isFinite(n) ? n : Number.NaN;
    }
    return parseNumeroMoedaOuDia(raw);
  }
  if (tipo === 'dataBr') {
    return parseDataBrParaMs(raw);
  }
  return String(raw ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR');
}

function compararLinhas(a, b, colKey, dir) {
  const va = valorOrdenacaoCelula(a, colKey);
  const vb = valorOrdenacaoCelula(b, colKey);
  const tipo = ORDENACAO_TIPO[colKey] ?? 'texto';
  const mult = dir === 'asc' ? 1 : -1;

  const vazioA = va === '' || (typeof va === 'number' && Number.isNaN(va));
  const vazioB = vb === '' || (typeof vb === 'number' && Number.isNaN(vb));
  if (vazioA && vazioB) return (a.apiImovelId ?? 0) - (b.apiImovelId ?? 0);
  if (vazioA) return 1;
  if (vazioB) return -1;

  if (tipo === 'texto') {
    const c = String(va).localeCompare(String(vb), 'pt-BR', { numeric: true, sensitivity: 'base' });
    if (c !== 0) return mult * c;
  } else if (typeof va === 'number' && typeof vb === 'number') {
    if (va !== vb) return mult * (va - vb);
  }

  return (a.apiImovelId ?? 0) - (b.apiImovelId ?? 0);
}

export function RelatorioImoveis() {
  const navigate = useNavigate();
  const [busca, setBusca] = useState('');
  const [linhas, setLinhas] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [ultimaCarga, setUltimaCarga] = useState(null);
  const [ordenacao, setOrdenacao] = useState({ col: null, dir: 'asc' });

  const executarRelatorio = useCallback(async () => {
    setErro('');
    setCarregando(true);
    try {
      const { ok, motivo, itens } = await carregarItensRelatorioImoveisApi();
      if (!ok) {
        setLinhas([]);
        setErro(motivo || 'Não foi possível carregar o relatório.');
        return;
      }
      setLinhas(itens.map(mapCadastroUiParaLinha));
      setUltimaCarga(new Date());
    } catch (e) {
      setLinhas([]);
      setErro(e?.message || 'Falha ao carregar o relatório.');
    } finally {
      setCarregando(false);
    }
  }, []);

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase();
    if (!t) return linhas;
    return linhas.filter((r) => textoBuscaLinha(r).includes(t));
  }, [linhas, busca]);

  const linhasOrdenadas = useMemo(() => {
    const col = ordenacao.col;
    if (!col || filtradas.length === 0) return filtradas;
    const dir = ordenacao.dir;
    return [...filtradas].sort((a, b) => compararLinhas(a, b, col, dir));
  }, [filtradas, ordenacao.col, ordenacao.dir]);

  function aoClicarOrdenar(colKey) {
    setOrdenacao((prev) => {
      if (prev.col !== colKey) {
        return { col: colKey, dir: 'asc' };
      }
      if (prev.dir === 'asc') {
        return { col: colKey, dir: 'desc' };
      }
      return { col: null, dir: 'asc' };
    });
  }

  const th =
    'px-3 py-2 text-left text-xs font-semibold text-white border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 whitespace-nowrap';
  const thBtn =
    'group flex w-full min-w-0 items-center gap-1 text-left font-semibold text-white hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40 rounded px-0.5 -mx-0.5';
  const td = 'px-3 py-2 text-sm text-slate-800 border-b border-slate-100 align-top';

  const btnPrimario =
    'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:pointer-events-none shadow-lg shadow-indigo-500/20';

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/40 to-emerald-50/50 p-4">
      <div className="max-w-[1600px] mx-auto space-y-4">
        <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-slate-200/90 shadow-xl ring-1 ring-indigo-500/10 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex items-start gap-3">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
                <Building2 className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
              <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-800 to-violet-800 bg-clip-text text-transparent">
                Relatório Imóveis
              </h1>
              <p className="text-sm text-slate-600 mt-1 max-w-3xl">
                Lista o cadastro de cada imóvel na API (mesmos campos do formulário de administração). Use{' '}
                <strong>Atualizar relatório</strong> para buscar os dados no servidor. Clique no{' '}
                <strong>cabeçalho de uma coluna</strong> para ordenar (ascendente, descendente, depois volta ao padrão).
                Rolagem horizontal para ver todas as colunas; clique numa linha para abrir o imóvel no cadastro.
              </p>
              {!featureFlags.useApiImoveis ? (
                <p className="text-sm text-amber-800 mt-2">
                  A API de imóveis está desligada (<code className="text-xs">VITE_USE_API_IMOVEIS</code>). Ative-a para
                  carregar este relatório.
                </p>
              ) : null}
              {ultimaCarga ? (
                <p className="text-xs text-slate-500 mt-2">
                  Última atualização: {ultimaCarga.toLocaleString('pt-BR')}
                </p>
              ) : null}
              </div>
            </div>
            <button
              type="button"
              className={btnPrimario}
              onClick={() => void executarRelatorio()}
              disabled={carregando || !featureFlags.useApiImoveis}
              title={
                !featureFlags.useApiImoveis
                  ? 'API de imóveis desligada'
                  : 'Buscar todos os imóveis e montar o relatório'
              }
            >
              <RefreshCw className={`w-4 h-4 shrink-0 ${carregando ? 'animate-spin' : ''}`} aria-hidden />
              {carregando ? 'Carregando…' : 'Atualizar relatório'}
            </button>
          </div>
        </div>

        {erro ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-3 text-sm text-red-800 shadow-sm">{erro}</div>
        ) : null}

        <div className="bg-white/95 backdrop-blur-sm rounded-2xl border border-slate-200/90 shadow-xl ring-1 ring-indigo-500/10 p-4">
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
              {ordenacao.col ? (
                <span className="text-indigo-700 ml-1">
                  · ordenado por {COLUNAS.find((c) => c.key === ordenacao.col)?.label ?? ordenacao.col} (
                  {(() => {
                    const t = ORDENACAO_TIPO[ordenacao.col];
                    if (t === 'texto' || t == null) {
                      return ordenacao.dir === 'asc' ? 'A→Z' : 'Z→A';
                    }
                    return ordenacao.dir === 'asc' ? 'crescente' : 'decrescente';
                  })()}
                  )
                </span>
              ) : null}
            </span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200/90 ring-1 ring-slate-100">
            <table className="w-full text-left border-collapse min-w-[2400px]">
              <thead>
                <tr>
                  {COLUNAS.map((col) => {
                    const ativo = ordenacao.col === col.key;
                    return (
                      <th key={col.key} className={`${th} ${col.right ? 'text-right' : ''}`} scope="col">
                        <button
                          type="button"
                          className={`${thBtn} ${col.right ? 'justify-end' : 'justify-start'}`}
                          onClick={() => aoClicarOrdenar(col.key)}
                          title="Ordenar por esta coluna (clique de novo para inverter; terceiro clique remove ordenação)"
                        >
                          <span className="truncate">{col.label}</span>
                          <span className="inline-flex shrink-0 text-white/90 opacity-80 group-hover:opacity-100">
                            {!ativo ? (
                              <ArrowUpDown className="w-3.5 h-3.5" aria-hidden />
                            ) : ordenacao.dir === 'asc' ? (
                              <ArrowUp className="w-3.5 h-3.5" aria-hidden />
                            ) : (
                              <ArrowDown className="w-3.5 h-3.5" aria-hidden />
                            )}
                          </span>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {linhasOrdenadas.map((r) => (
                  <tr
                    key={r.apiImovelId ?? `row-${r.id}`}
                    className="hover:bg-blue-50/60 cursor-pointer"
                    onClick={() =>
                      navigate('/imoveis', {
                        state: { numeroPlanilha: r.id },
                      })
                    }
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
            {linhas.length === 0 && !carregando ? (
              <p className="text-sm text-slate-500 text-center py-8">
                {featureFlags.useApiImoveis
                  ? 'Nenhum dado carregado. Clique em «Atualizar relatório» para buscar os imóveis na API.'
                  : 'Ative a API de imóveis para usar este relatório.'}
              </p>
            ) : null}
            {linhas.length > 0 && filtradas.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">Nenhum registro com o filtro atual.</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

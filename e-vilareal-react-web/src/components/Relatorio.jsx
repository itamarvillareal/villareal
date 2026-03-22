import { useState, useMemo, useEffect, useRef } from 'react';
import { ChevronDown, Columns3 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RelatorioUltimoAndamentoHeader } from './RelatorioUltimoAndamentoHeader.jsx';
import { RelatorioPresetsPanel } from './RelatorioPresetsPanel.jsx';
import {
  CAMPOS_DATA_COLUNA_DINAMICA,
  CAMPOS_OPCOES_ULTIMO_ANDAMENTO,
  carregarCampoUltimoAndamentoSalvo,
  salvarCampoUltimoAndamento,
  enriquecerCamposRelatorioProcessos,
} from '../data/relatorioProcessosColunaDinamica.js';
import { normalizarFiltroProcessoAtivo } from '../data/relatorioPresets.js';
import {
  getRelatorioProcessosMockLinhasBase,
  RELATORIO_PROCESSOS_MOCK_COUNT,
} from '../data/relatorioProcessosDados.js';

const STORAGE_COLUNAS_RELATORIO = 'vilareal.relatorioProcessos.colunasVisiveis.v1';
const STORAGE_LARGURA_UNIFORME = 'vilareal.relatorioProcessos.larguraUniforme.v1';
const STORAGE_FILTRO_PROCESSO_ATIVO = 'vilareal.relatorioProcessos.filtroProcessoAtivo.v1';
const STORAGE_MODO_ALTERACAO = 'vilareal.relatorioProcessos.modoAlteracao.v1';
const STORAGE_DADOS_RELATORIO = 'vilareal.relatorioProcessos.dadosLinhas.v1';

/** Colunas que identificam o processo — não editáveis no modo de alteração. */
const COLUNAS_RELATORIO_SO_LEITURA = new Set(['codCliente', 'proc']);

/** Gera número CNJ mock determinístico (prioriza dados reais: numeroProcesso / numeroProcessoNovo). */
function gerarNumeroProcessoCnjMock(row, idx) {
  const proc = Number(String(row.proc ?? '').replace(/\D/g, '')) || 1;
  const seq = 5600000 + idx * 137 + proc * 11;
  const dv = String(10 + ((idx + proc) % 90)).padStart(2, '0');
  const foro = String(1000 + ((idx * 13 + proc * 7) % 900)).slice(-4);
  return `${String(seq).slice(0, 7)}-${dv}.2025.8.09.${foro}`;
}

/** Colunas cujo valor é data dd/mm/aaaa — ordenação cronológica, não lexicográfica. */
const COLUNAS_DATA_BR = new Set([
  'dataConsulta',
  'proximaConsulta',
  'prazoFatal',
  'dataAudiencia',
  ...CAMPOS_DATA_COLUNA_DINAMICA,
]);

/** dd/mm/aaaa → timestamp (UTC local); vazio ou inválido → 0 (vai ao início na ordem crescente). */
function timestampDataBr(val) {
  const t = String(val ?? '').trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return 0;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return 0;
  const d = new Date(yyyy, mm - 1, dd);
  const x = d.getTime();
  return Number.isNaN(x) ? 0 : x;
}

const COLUNAS = [
  { id: 'codCliente', label: 'Cod. Cliente', minW: '96px' },
  { id: 'cliente', label: 'Cliente', minW: '180px' },
  { id: 'numeroProcesso', label: 'N.º Processo', minW: '200px' },
  { id: 'inRequerente', label: 'In Requerente/Recurso', minW: '140px' },
  { id: 'ultimoAndamento', label: 'Último Andamento', minW: '200px' },
  { id: 'dataConsulta', label: 'Data da Consulta', minW: '100px' },
  { id: 'proximaConsulta', label: 'Próxima Consulta', minW: '110px' },
  { id: 'observacaoProcesso', label: 'Observação do Processo', minW: '180px' },
  { id: 'consultor', label: 'Consultor', minW: '100px' },
  { id: 'proc', label: 'Proc.', minW: '56px' },
  { id: 'lmv', label: 'Lmv', minW: '56px' },
  { id: 'fase', label: 'Fase', minW: '140px' },
  { id: 'observacaoFase', label: 'Observação de Fase', minW: '140px' },
  { id: 'descricaoAcao', label: 'Descrição da Ação', minW: '140px' },
  { id: 'prazoFatal', label: 'Prazo Fatal', minW: '90px' },
  { id: 'competencia', label: 'Competência', minW: '180px' },
  { id: 'dataAudiencia', label: 'Data da Audiência', minW: '110px' },
  { id: 'horaAudiencia', label: 'Hora da Audiência', minW: '100px' },
  { id: 'cepReu', label: 'CEP [primeiro réu]', minW: '100px' },
  { id: 'inv', label: 'Inv', minW: '56px' },
  { id: 'consultas', label: 'Consultas', minW: '80px' },
];

function carregarColunasVisiveisSalvas() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_COLUNAS_RELATORIO);
    if (!raw) return null;
    const p = JSON.parse(raw);
    return p && typeof p === 'object' ? p : null;
  } catch {
    return null;
  }
}

function carregarLarguraUniformeSalva() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_LARGURA_UNIFORME) === '1';
  } catch {
    return false;
  }
}

function carregarFiltroProcessoAtivoSalvo() {
  if (typeof window === 'undefined') return 'todos';
  try {
    const raw = window.localStorage.getItem(STORAGE_FILTRO_PROCESSO_ATIVO);
    return normalizarFiltroProcessoAtivo(raw);
  } catch {
    return 'todos';
  }
}

function linhaPassaFiltroAtivo(row, filtro) {
  const f = normalizarFiltroProcessoAtivo(filtro);
  if (f === 'todos') return true;
  const ativo = row.processoCadastroAtivo === true;
  if (f === 'ativos') return ativo;
  return !ativo;
}

function montarLinhasRelatorioBase() {
  return getRelatorioProcessosMockLinhasBase().map((row, idx) => {
    const enriched = enriquecerCamposRelatorioProcessos(
      {
        ...row,
        codCliente: row.codCliente ?? String(idx + 1).padStart(8, '0'),
        numeroProcesso: row.numeroProcesso ?? row.numeroProcessoNovo ?? gerarNumeroProcessoCnjMock(row, idx),
      },
      idx
    );
    return { ...enriched, __relatorioIdx: idx };
  });
}

function carregarDadosRelatorioInicial() {
  const n = RELATORIO_PROCESSOS_MOCK_COUNT;
  if (typeof window === 'undefined') return montarLinhasRelatorioBase();
  try {
    const raw = window.localStorage.getItem(STORAGE_DADOS_RELATORIO);
    if (!raw) return montarLinhasRelatorioBase();
    const p = JSON.parse(raw);
    if (!Array.isArray(p) || p.length !== n) return montarLinhasRelatorioBase();
    const base = montarLinhasRelatorioBase();
    return p.map((salvo, i) => ({
      ...base[i],
      ...salvo,
      __relatorioIdx: i,
      codCliente: base[i].codCliente,
      proc: base[i].proc,
    }));
  } catch {
    return montarLinhasRelatorioBase();
  }
}

function carregarModoAlteracaoSalvo() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_MODO_ALTERACAO) === '1';
  } catch {
    return false;
  }
}

export function Relatorio() {
  const navigate = useNavigate();
  const [ordenarPor, setOrdenarPor] = useState(null);
  const [ordemAsc, setOrdemAsc] = useState(true);
  const [painelColunasAberto, setPainelColunasAberto] = useState(false);
  const painelColunasRef = useRef(null);
  const [colunasVisiveis, setColunasVisiveis] = useState(() => {
    const salvo = carregarColunasVisiveisSalvas();
    const base = Object.fromEntries(COLUNAS.map((c) => [c.id, true]));
    if (!salvo) return base;
    return { ...base, ...Object.fromEntries(COLUNAS.map((c) => [c.id, salvo[c.id] !== false])) };
  });
  const [larguraUniforme, setLarguraUniforme] = useState(() => carregarLarguraUniformeSalva());
  const [campoUltimoAndamento, setCampoUltimoAndamento] = useState(() => carregarCampoUltimoAndamentoSalvo());
  const [filtroProcessoAtivo, setFiltroProcessoAtivo] = useState(() => carregarFiltroProcessoAtivoSalvo());

  useEffect(() => {
    salvarCampoUltimoAndamento(campoUltimoAndamento);
  }, [campoUltimoAndamento]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_COLUNAS_RELATORIO, JSON.stringify(colunasVisiveis));
    } catch {
      /* ignore */
    }
  }, [colunasVisiveis]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_LARGURA_UNIFORME, larguraUniforme ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [larguraUniforme]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_FILTRO_PROCESSO_ATIVO, normalizarFiltroProcessoAtivo(filtroProcessoAtivo));
    } catch {
      /* ignore */
    }
  }, [filtroProcessoAtivo]);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_MODO_ALTERACAO, modoAlteracao ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [modoAlteracao]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (!painelColunasAberto) return;
      const el = painelColunasRef.current;
      if (el && !el.contains(e.target)) setPainelColunasAberto(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [painelColunasAberto]);

  const colunasAtivas = useMemo(() => {
    const list = COLUNAS.filter((c) => colunasVisiveis[c.id] !== false);
    return list.length > 0 ? list : COLUNAS;
  }, [colunasVisiveis]);

  const colIdsRelatorio = useMemo(() => COLUNAS.map((c) => c.id), []);

  const marcarTodasColunas = () => {
    setColunasVisiveis(Object.fromEntries(COLUNAS.map((c) => [c.id, true])));
  };

  const desmarcarTodasColunas = () => {
    const primeiro = COLUNAS[0]?.id;
    if (!primeiro) return;
    const next = Object.fromEntries(COLUNAS.map((c) => [c.id, c.id === primeiro]));
    setColunasVisiveis(next);
  };

  const alternarColuna = (id) => {
    setColunasVisiveis((prev) => {
      const visivel = prev[id] !== false;
      if (visivel) {
        const outrasVisiveis = COLUNAS.filter((c) => c.id !== id && prev[c.id] !== false);
        if (outrasVisiveis.length === 0) return prev;
        return { ...prev, [id]: false };
      }
      return { ...prev, [id]: true };
    });
  };

  const [dados, setDados] = useState(() => carregarDadosRelatorioInicial());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_DADOS_RELATORIO, JSON.stringify(dados));
    } catch {
      /* ignore */
    }
  }, [dados]);

  const atualizarCelulaRelatorio = (relIdx, chaveCampo, valor) => {
    setDados((prev) => {
      const next = [...prev];
      const i = next.findIndex((r) => r.__relatorioIdx === relIdx);
      if (i < 0) return prev;
      next[i] = { ...next[i], [chaveCampo]: valor };
      return next;
    });
  };
  const [filtrosPorColuna, setFiltrosPorColuna] = useState(() =>
    COLUNAS.reduce((acc, col) => ({ ...acc, [col.id]: '' }), {})
  );

  const dadosFiltrados = useMemo(() => {
    return dados.filter((row) => {
      if (!linhaPassaFiltroAtivo(row, filtroProcessoAtivo)) return false;
      return COLUNAS.every((col) => {
        const filtro = String(filtrosPorColuna[col.id] ?? '').trim().toLowerCase();
        if (!filtro) return true;
        const chave =
          col.id === 'ultimoAndamento' ? campoUltimoAndamento : col.id;
        const valor = String(row[chave] ?? '').toLowerCase();
        return valor.includes(filtro);
      });
    });
  }, [dados, filtrosPorColuna, campoUltimoAndamento, filtroProcessoAtivo]);

  const dadosOrdenados = useMemo(() => {
    if (!ordenarPor) return dadosFiltrados;
    return [...dadosFiltrados].sort((a, b) => {
      const chaveOrdenacao = ordenarPor === 'ultimoAndamento' ? campoUltimoAndamento : ordenarPor;

      if (ordenarPor === 'ultimoAndamento' && COLUNAS_DATA_BR.has(chaveOrdenacao)) {
        const ta = timestampDataBr(a[chaveOrdenacao]);
        const tb = timestampDataBr(b[chaveOrdenacao]);
        const cmp = ta === tb ? 0 : ta < tb ? -1 : 1;
        return ordemAsc ? cmp : -cmp;
      }
      if (COLUNAS_DATA_BR.has(ordenarPor) && ordenarPor !== 'ultimoAndamento') {
        const ta = timestampDataBr(a[ordenarPor]);
        const tb = timestampDataBr(b[ordenarPor]);
        const cmp = ta === tb ? 0 : ta < tb ? -1 : 1;
        return ordemAsc ? cmp : -cmp;
      }
      const va = a[chaveOrdenacao] ?? '';
      const vb = b[chaveOrdenacao] ?? '';
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return ordemAsc ? cmp : -cmp;
    });
  }, [dadosFiltrados, ordenarPor, ordemAsc, campoUltimoAndamento]);

  const toggleOrdenacao = (id) => {
    if (ordenarPor === id) setOrdemAsc((a) => !a);
    else {
      setOrdenarPor(id);
      setOrdemAsc(true);
    }
  };

  return (
    <div className="min-h-full bg-slate-200 flex flex-col">
      <div className="flex-1 min-h-0 p-3 flex flex-col">
        <header className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-xl font-bold text-slate-800">Relatório</h1>
          <div className="flex flex-wrap items-center gap-2">
          <RelatorioPresetsPanel
            colIds={colIdsRelatorio}
            colunasVisiveis={colunasVisiveis}
            setColunasVisiveis={setColunasVisiveis}
            larguraUniforme={larguraUniforme}
            setLarguraUniforme={setLarguraUniforme}
            campoUltimoAndamento={campoUltimoAndamento}
            setCampoUltimoAndamento={setCampoUltimoAndamento}
            filtroProcessoAtivo={filtroProcessoAtivo}
            setFiltroProcessoAtivo={setFiltroProcessoAtivo}
            modoAlteracao={modoAlteracao}
            setModoAlteracao={setModoAlteracao}
          />
          <div className="relative" ref={painelColunasRef}>
            <button
              type="button"
              onClick={() => setPainelColunasAberto((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-teal-600 bg-white text-teal-800 text-sm font-medium hover:bg-teal-50 shadow-sm"
              title="Escolher quais colunas exibir e largura"
            >
              <Columns3 className="w-4 h-4 shrink-0" aria-hidden />
              Colunas
            </button>
            {painelColunasAberto ? (
              <div className="absolute right-0 top-full mt-1 z-20 w-[min(100vw-2rem,22rem)] rounded-lg border border-slate-200 bg-white shadow-lg p-3 text-sm">
                <p className="text-xs text-slate-600 mb-2">
                  Marque as colunas que deseja ver na tabela. Use <strong>Marcar todas</strong> para exibir todas.
                </p>
                <div className="flex flex-wrap gap-2 mb-2">
                  <button
                    type="button"
                    onClick={marcarTodasColunas}
                    className="px-2 py-1 rounded border border-slate-300 bg-slate-50 text-xs hover:bg-slate-100"
                  >
                    Marcar todas
                  </button>
                  <button
                    type="button"
                    onClick={desmarcarTodasColunas}
                    className="px-2 py-1 rounded border border-slate-300 bg-slate-50 text-xs hover:bg-slate-100"
                    title="Mantém só a primeira coluna (Cod. Cliente)"
                  >
                    Só primeira coluna
                  </button>
                </div>
                <label className="flex items-center gap-2 mb-2 cursor-pointer border-b border-slate-100 pb-2">
                  <input
                    type="checkbox"
                    checked={larguraUniforme}
                    onChange={(e) => setLarguraUniforme(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span className="text-slate-800">Mesma largura em todas as colunas visíveis</span>
                </label>
                <div className="max-h-52 overflow-y-auto space-y-1.5 pr-1">
                  {COLUNAS.map((col) => (
                    <label
                      key={col.id}
                      className="flex items-center gap-2 cursor-pointer text-slate-700 hover:text-slate-900"
                    >
                      <input
                        type="checkbox"
                        checked={colunasVisiveis[col.id] !== false}
                        onChange={() => alternarColuna(col.id)}
                        className="rounded border-slate-300"
                      />
                      <span className="truncate">{col.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
          </div>
        </header>
        <div className="flex-1 min-h-0 bg-white rounded border border-slate-300 shadow-sm overflow-hidden flex flex-col">
          <div className="overflow-auto flex-1">
            <table
              className={`w-full text-sm border-collapse ${larguraUniforme ? 'table-fixed' : ''}`}
              style={{ minWidth: larguraUniforme ? '100%' : 'max-content' }}
            >
              <thead className="sticky top-0 z-10">
                <tr className="bg-teal-700 text-white">
                  {colunasAtivas.map((col) =>
                    col.id === 'ultimoAndamento' ? (
                      <RelatorioUltimoAndamentoHeader
                        key={col.id}
                        minWStyle={{ minWidth: col.minW }}
                        larguraUniforme={larguraUniforme}
                        colunasAtivasLength={colunasAtivas.length}
                        options={CAMPOS_OPCOES_ULTIMO_ANDAMENTO}
                        selectedFieldKey={campoUltimoAndamento}
                        onSelectField={setCampoUltimoAndamento}
                        onSort={() => toggleOrdenacao('ultimoAndamento')}
                        ordenarAtivo={ordenarPor === 'ultimoAndamento'}
                        ordemAsc={ordemAsc}
                        modoAlteracao={modoAlteracao}
                      />
                    ) : (
                      <th
                        key={col.id}
                        className={`text-left px-2 py-2 font-semibold whitespace-nowrap border-b border-r border-teal-600 last:border-r-0 cursor-pointer hover:bg-teal-600 select-none ${
                          modoAlteracao ? 'text-red-200' : 'text-white'
                        }`}
                        style={larguraUniforme ? { width: `${100 / colunasAtivas.length}%`, minWidth: 0 } : { minWidth: col.minW }}
                        onClick={() => toggleOrdenacao(col.id)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          <ChevronDown className={`w-4 h-4 opacity-80 transition-transform ${ordenarPor === col.id && !ordemAsc ? 'rotate-180' : ''}`} />
                        </span>
                      </th>
                    )
                  )}
                </tr>
                <tr className="bg-slate-100">
                  {colunasAtivas.map((col) => (
                    <th
                      key={`${col.id}-filtro`}
                      className="px-1.5 py-1 border-b border-r border-slate-300 last:border-r-0"
                      style={larguraUniforme ? { width: `${100 / colunasAtivas.length}%`, minWidth: 0 } : { minWidth: col.minW }}
                    >
                      <input
                        type="text"
                        value={filtrosPorColuna[col.id] ?? ''}
                        onChange={(e) =>
                          setFiltrosPorColuna((prev) => ({
                            ...prev,
                            [col.id]: e.target.value,
                          }))
                        }
                        placeholder="Filtrar..."
                        className={`w-full px-2 py-1 border rounded text-xs bg-white ${
                          modoAlteracao
                            ? 'border-red-200 text-red-700 placeholder:text-red-300'
                            : 'border-slate-300 text-slate-700'
                        }`}
                      />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dadosOrdenados.length === 0 ? (
                  <tr>
                    <td colSpan={colunasAtivas.length} className="px-3 py-6 text-center text-slate-500">
                      Nenhum resultado para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  dadosOrdenados.map((row, idx) => (
                    <tr
                      key={row.__relatorioIdx ?? idx}
                      className={`border-b border-slate-200 hover:bg-slate-50 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} ${
                        modoAlteracao ? 'cursor-default' : 'cursor-pointer'
                      }`}
                      title={
                        modoAlteracao
                          ? 'Modo alteração: edite as células (texto em vermelho). Cod. Cliente e Proc. são fixos.'
                          : 'Duplo clique: abrir processo'
                      }
                      onDoubleClick={() => {
                        if (modoAlteracao) return;
                        navigate('/processos', {
                          state: {
                            codCliente: String(row.codCliente ?? ''),
                            proc: String(row.proc ?? ''),
                          },
                        });
                      }}
                    >
                      {colunasAtivas.map((col) => {
                        const chaveValor = col.id === 'ultimoAndamento' ? campoUltimoAndamento : col.id;
                        const textoCelula = row[chaveValor] ?? '';
                        const valorStr = String(textoCelula);
                        const soLeitura = COLUNAS_RELATORIO_SO_LEITURA.has(col.id) || !modoAlteracao;

                        if (!modoAlteracao) {
                          return (
                            <td
                              key={col.id}
                              className={`px-2 py-1.5 border-r border-slate-200 last:border-r-0 text-slate-800 ${
                                col.id === 'codCliente' ? 'tabular-nums' : ''
                              } ${larguraUniforme ? 'truncate max-w-0' : ''}`}
                              style={larguraUniforme ? { width: `${100 / colunasAtivas.length}%`, minWidth: 0 } : { minWidth: col.minW }}
                              title={larguraUniforme ? valorStr : undefined}
                            >
                              {valorStr}
                            </td>
                          );
                        }

                        if (soLeitura) {
                          return (
                            <td
                              key={col.id}
                              className={`px-2 py-1.5 border-r border-slate-200 last:border-r-0 text-red-600 font-semibold tabular-nums ${
                                col.id === 'codCliente' ? '' : ''
                              } ${larguraUniforme ? 'truncate max-w-0' : ''}`}
                              style={larguraUniforme ? { width: `${100 / colunasAtivas.length}%`, minWidth: 0 } : { minWidth: col.minW }}
                              title={larguraUniforme ? valorStr : undefined}
                            >
                              {valorStr}
                            </td>
                          );
                        }

                        return (
                          <td
                            key={col.id}
                            className={`p-0 border-r border-slate-200 last:border-r-0 align-stretch ${larguraUniforme ? 'max-w-0' : ''}`}
                            style={larguraUniforme ? { width: `${100 / colunasAtivas.length}%`, minWidth: 0 } : { minWidth: col.minW }}
                          >
                            <input
                              type="text"
                              value={valorStr}
                              onChange={(e) =>
                                atualizarCelulaRelatorio(row.__relatorioIdx, chaveValor, e.target.value)
                              }
                              className="w-full min-w-0 bg-transparent px-2 py-1.5 text-sm text-red-600 outline-none border-0 focus:ring-2 focus:ring-inset focus:ring-red-200"
                              aria-label={`${col.label} — linha ${(row.__relatorioIdx ?? idx) + 1}`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

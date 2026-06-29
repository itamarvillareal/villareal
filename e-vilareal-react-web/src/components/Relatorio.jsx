import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Columns3, FileSpreadsheet, FileText, Loader2, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { RelatorioUltimoAndamentoHeader } from './RelatorioUltimoAndamentoHeader.jsx';
import { RelatorioPresetsPanel } from './RelatorioPresetsPanel.jsx';
import {
  CAMPOS_DATA_COLUNA_DINAMICA,
  CAMPOS_OPCOES_ULTIMO_ANDAMENTO,
  COLUNAS_RELATORIO_PROCESSOS,
  carregarCampoPorColunaSalvo,
  salvarCampoPorColuna,
  enriquecerCamposRelatorioProcessos,
} from '../data/relatorioProcessosColunaDinamica.js';
import { normalizarFiltroProcessoAtivo } from '../data/relatorioPresets.js';
import { obterLinhasBaseRelatorioProcessos } from '../data/relatorioProcessosDados.js';
import { preaquecerCamposRelatorioApiFirst, resolverStatusAtivoRelatorioProcesso } from '../data/processosDadosRelatorio.js';
import { featureFlags } from '../config/featureFlags.js';
import { EVENT_RELATORIO_PERSISTENCIA_EXTERNA } from '../services/crossTabLocalStorageSync.js';
import { buildRouterStateChaveClienteProcesso } from '../domain/camposProcessoCliente.js';
import { removerRegistroProcessoDoHistorico } from '../data/processosHistoricoData.js';
import { excluirProcessoCompleto, atualizarCampoProcessoRelatorio } from '../repositories/processosRepository.js';
import {
  chavesLinhaBaseRelatorio,
  tipoPersistenciaCampoRelatorio,
} from '../data/relatorioProcessoCampoPersistencia.js';
import { ChaveEdicaoOnOff } from './cadastro-pessoas/ChaveEdicaoOnOff.jsx';
import {
  carregarSessaoRelatorioProcessos,
  salvarSessaoRelatorioProcessos,
} from '../data/relatorioProcessosSessaoPersistencia.js';
import {
  MODOS_FILTRO_COLUNA,
  OPCOES_MODO_FILTRO_COLUNA,
  linhaPassaFiltroColunaRelatorio,
} from '../data/relatorioFiltroColuna.js';

const STORAGE_COLUNAS_RELATORIO = 'vilareal.relatorioProcessos.colunasVisiveis.v1';
const STORAGE_LARGURA_UNIFORME = 'vilareal.relatorioProcessos.larguraUniforme.v1';
const STORAGE_FILTRO_PROCESSO_ATIVO = 'vilareal.relatorioProcessos.filtroProcessoAtivo.v1';
const STORAGE_MODO_ALTERACAO = 'vilareal.relatorioProcessos.modoAlteracao.v1';
const STORAGE_DADOS_RELATORIO = 'vilareal.relatorioProcessos.dadosLinhas.v1';

/** Acima disso não hidrata nem grava linhas editáveis no localStorage (evita quota e lentidão com o relatório completo). */
const RELATORIO_MAX_LINHAS_PERSISTIDAS = 400;

/** Colunas que identificam o processo — não editáveis no modo de alteração. */
const COLUNAS_RELATORIO_SO_LEITURA = new Set(['codCliente', 'proc']);

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

function chaveProcessoRelatorio(row) {
  const cod = String(row?.codCliente ?? '').trim();
  const proc = String(row?.proc ?? '').trim();
  if (!cod || !proc) return '';
  return `${cod}:${proc}`;
}

/** Colunas fixas ({@link COLUNAS_RELATORIO_PROCESSOS}); o menu de cada cabeçalho ainda lista todos os campos. */
const COLUNAS = COLUNAS_RELATORIO_PROCESSOS;

const COLUNA_IDS_RELATORIO = COLUNAS.map((c) => c.id);

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
  if (typeof window === 'undefined') return 'ativos';
  try {
    const raw = window.localStorage.getItem(STORAGE_FILTRO_PROCESSO_ATIVO);
    return normalizarFiltroProcessoAtivo(raw);
  } catch {
    return 'ativos';
  }
}

function linhaPassaFiltroAtivo(row, filtro) {
  const f = normalizarFiltroProcessoAtivo(filtro);
  if (f === 'todos') return true;
  const cod = row.codCliente ?? row.codigoClienteProcesso;
  const proc = row.proc ?? row.numeroProcessoInterno;
  const ativo = resolverStatusAtivoRelatorioProcesso(cod, proc, row.processoCadastroAtivo !== false);
  if (f === 'ativos') return ativo;
  return !ativo;
}

function montarLinhasRelatorioBaseDeCruas(linhasCruas) {
  const rows = Array.isArray(linhasCruas) ? linhasCruas : [];
  return rows.map((row, idx) => {
    const enriched = enriquecerCamposRelatorioProcessos(
      {
        ...row,
        codCliente: row.codCliente ?? String(idx + 1).padStart(8, '0'),
        numeroProcesso: row.numeroProcesso ?? row.numeroProcessoNovo ?? '',
      },
      idx
    );
    return { ...enriched, __relatorioIdx: idx };
  });
}

function montarLinhasRelatorioBase() {
  return montarLinhasRelatorioBaseDeCruas([]);
}

/**
 * @param {boolean} preferirCamposDaBase - Se true (após «Atualizar relatório»), valores vindos da base
 *   sobrescrevem o snapshot em localStorage — senão dados novos da API nunca aparecem.
 * @param {Array|null|undefined} baseLinhas - Linhas já enriquecidas; se omitido, usa {@link montarLinhasRelatorioBase}.
 */
function mesclarLinhasRelatorioComPersistido(preferirCamposDaBase, baseLinhas) {
  const base = Array.isArray(baseLinhas) ? baseLinhas : montarLinhasRelatorioBase();
  const n = base.length;
  if (typeof window === 'undefined') return base;
  if (n > RELATORIO_MAX_LINHAS_PERSISTIDAS) return base;
  try {
    const raw = window.localStorage.getItem(STORAGE_DADOS_RELATORIO);
    if (!raw) return base;
    const p = JSON.parse(raw);
    if (!Array.isArray(p) || p.length !== n) return base;
    return p.map((salvo, i) => {
      const b = base[i];
      const statusDaBase =
        typeof b.processoCadastroAtivo === 'boolean'
          ? {
              processoCadastroAtivo: b.processoCadastroAtivo,
              statusAtivoTexto: b.statusAtivoTexto,
            }
          : {};
      if (preferirCamposDaBase) {
        return {
          ...salvo,
          ...b,
          ...statusDaBase,
          __relatorioIdx: i,
          codCliente: b.codCliente,
          proc: b.proc,
        };
      }
      return {
        ...b,
        ...salvo,
        ...statusDaBase,
        __relatorioIdx: i,
        codCliente: b.codCliente,
        proc: b.proc,
      };
    });
  } catch {
    return base;
  }
}

function carregarDadosRelatorioInicial() {
  return mesclarLinhasRelatorioComPersistido(false);
}

function carregarModoAlteracaoSalvo() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_MODO_ALTERACAO) === '1';
  } catch {
    return false;
  }
}

function filtrosColunaPadrao() {
  return COLUNAS.reduce((acc, col) => ({ ...acc, [col.id]: '' }), {});
}

function modosFiltroColunaPadrao() {
  return COLUNAS.reduce((acc, col) => ({ ...acc, [col.id]: MODOS_FILTRO_COLUNA.contem }), {});
}

/** Restaura grade/filtros da sessão ao reentrar na rota (ex.: voltar de Processos). */
function restaurarEstadoRelatorioDaSessao() {
  const sessao = carregarSessaoRelatorioProcessos();
  const ui = sessao.ui ?? {};
  const filtrosPorColuna = { ...filtrosColunaPadrao(), ...(ui.filtrosPorColuna ?? {}) };
  const modoFiltroPorColuna = { ...modosFiltroColunaPadrao(), ...(ui.modoFiltroPorColuna ?? {}) };

  if (!sessao.emitido) {
    return {
      relatorioEmitido: false,
      dados: [],
      baseRaw: [],
      filtrosPorColuna,
      modoFiltroPorColuna,
      ordenarPor: ui.ordenarPor ?? null,
      ordemAsc: ui.ordemAsc !== false,
      precisaRecarregar: false,
    };
  }

  const baseRaw = sessao.baseRaw ?? [];

  if (Array.isArray(sessao.dados) && sessao.dados.length > 0) {
    return {
      relatorioEmitido: true,
      dados: sessao.dados,
      baseRaw,
      filtrosPorColuna,
      modoFiltroPorColuna,
      ordenarPor: ui.ordenarPor ?? null,
      ordemAsc: ui.ordemAsc !== false,
      precisaRecarregar: false,
    };
  }

  if (baseRaw.length > 0) {
    const enriched = montarLinhasRelatorioBaseDeCruas(baseRaw);
    return {
      relatorioEmitido: true,
      dados: mesclarLinhasRelatorioComPersistido(false, enriched),
      baseRaw,
      filtrosPorColuna,
      modoFiltroPorColuna,
      ordenarPor: ui.ordenarPor ?? null,
      ordemAsc: ui.ordemAsc !== false,
      precisaRecarregar: false,
    };
  }

  return {
    relatorioEmitido: true,
    dados: [],
    baseRaw: [],
    filtrosPorColuna,
    modoFiltroPorColuna,
    ordenarPor: ui.ordenarPor ?? null,
    ordemAsc: ui.ordemAsc !== false,
    precisaRecarregar: true,
  };
}

export function Relatorio() {
  const navigate = useNavigate();
  const [estadoSessao] = useState(() => restaurarEstadoRelatorioDaSessao());
  const [ordenarPor, setOrdenarPor] = useState(() => estadoSessao.ordenarPor);
  const [ordemAsc, setOrdemAsc] = useState(() => estadoSessao.ordemAsc);
  const [painelColunasAberto, setPainelColunasAberto] = useState(false);
  const painelColunasRef = useRef(null);
  const [colunasVisiveis, setColunasVisiveis] = useState(() => {
    const salvo = carregarColunasVisiveisSalvas();
    const base = Object.fromEntries(COLUNAS.map((c) => [c.id, true]));
    if (!salvo) return base;
    return { ...base, ...Object.fromEntries(COLUNAS.map((c) => [c.id, salvo[c.id] !== false])) };
  });
  const [larguraUniforme, setLarguraUniforme] = useState(() => carregarLarguraUniformeSalva());
  const [campoPorColuna, setCampoPorColuna] = useState(() => carregarCampoPorColunaSalvo(COLUNA_IDS_RELATORIO));
  const [filtroProcessoAtivo, setFiltroProcessoAtivo] = useState(() => carregarFiltroProcessoAtivoSalvo());
  const [modoAlteracao, setModoAlteracao] = useState(() => carregarModoAlteracaoSalvo());
  const [filtrosPorColuna, setFiltrosPorColuna] = useState(() => estadoSessao.filtrosPorColuna);
  const [modoFiltroPorColuna, setModoFiltroPorColuna] = useState(() => estadoSessao.modoFiltroPorColuna);

  useEffect(() => {
    salvarCampoPorColuna(campoPorColuna, COLUNA_IDS_RELATORIO);
  }, [campoPorColuna]);

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
    return () => {
      try {
        window.localStorage.setItem(STORAGE_MODO_ALTERACAO, '0');
      } catch {
        /* ignore */
      }
    };
  }, []);

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

  const [dados, setDados] = useState(() => estadoSessao.dados);
  /** Só após o usuário clicar em «Emitir relatório» — evita montar milhares de linhas ao abrir a página. */
  const [relatorioEmitido, setRelatorioEmitido] = useState(() => estadoSessao.relatorioEmitido);
  const [emitindoRelatorio, setEmitindoRelatorio] = useState(false);
  const [enriquecendoDetalhes, setEnriquecendoDetalhes] = useState(false);
  const [erroEmissao, setErroEmissao] = useState('');
  const [excluindoChave, setExcluindoChave] = useState(null);
  const [excluindoEmLote, setExcluindoEmLote] = useState(false);
  const [selecionados, setSelecionados] = useState(() => new Set());
  const [erroExclusao, setErroExclusao] = useState('');
  const [erroPersistencia, setErroPersistencia] = useState('');
  const [salvandoCelula, setSalvandoCelula] = useState(null);
  const selectAllRef = useRef(null);
  const emitindoRelatorioRef = useRef(false);
  const baseRawEmissaoRef = useRef(estadoSessao.baseRaw);
  const precisaRecarregarSessaoRef = useRef(estadoSessao.precisaRecarregar);
  const recarregouSessaoRef = useRef(false);
  const uiSessaoRef = useRef({
    filtrosPorColuna: estadoSessao.filtrosPorColuna,
    modoFiltroPorColuna: estadoSessao.modoFiltroPorColuna,
    ordenarPor: estadoSessao.ordenarPor,
    ordemAsc: estadoSessao.ordemAsc,
  });

  useEffect(() => {
    uiSessaoRef.current = {
      filtrosPorColuna,
      modoFiltroPorColuna,
      ordenarPor,
      ordemAsc,
    };
  }, [filtrosPorColuna, modoFiltroPorColuna, ordenarPor, ordemAsc]);

  const emitirOuAtualizarRelatorio = useCallback(() => {
    if (emitindoRelatorioRef.current) return;
    emitindoRelatorioRef.current = true;
    setEmitindoRelatorio(true);
    setErroEmissao('');
    void (async () => {
      let baseRaw = [];
      try {
        if (!featureFlags.useApiProcessos || !featureFlags.useApiClientes) {
          setErroEmissao(
            'Relatório requer API de clientes e processos ativa (VITE_USE_API_CLIENTES e VITE_USE_API_PROCESSOS).'
          );
        } else {
          baseRaw = await obterLinhasBaseRelatorioProcessos();
        }
      } catch (e) {
        console.error(e);
        setErroEmissao(e?.message || 'Não foi possível carregar processos da API.');
        baseRaw = [];
      }

      baseRawEmissaoRef.current = baseRaw;
      const baseEnriched = montarLinhasRelatorioBaseDeCruas(baseRaw);
      const next = mesclarLinhasRelatorioComPersistido(relatorioEmitido, baseEnriched);
      setDados(next);
      setSelecionados(new Set());
      setRelatorioEmitido(true);
      emitindoRelatorioRef.current = false;
      setEmitindoRelatorio(false);

      salvarSessaoRelatorioProcessos({
        baseRaw,
        dados: next,
        ui: uiSessaoRef.current,
      });

      if (!featureFlags.useApiProcessos || baseRaw.length === 0) return;

      const entradasPreaquecer = baseRaw.map((r) => ({
        codCliente: r.codCliente,
        proc: r.proc,
        processoId: r.processoApiId,
      }));
      setEnriquecendoDetalhes(true);
      try {
        await preaquecerCamposRelatorioApiFirst(entradasPreaquecer, { concurrency: 12 });
        const atualizado = montarLinhasRelatorioBaseDeCruas(baseRawEmissaoRef.current);
        const dadosAtualizados = mesclarLinhasRelatorioComPersistido(true, atualizado);
        setDados(dadosAtualizados);
        salvarSessaoRelatorioProcessos({
          baseRaw: baseRawEmissaoRef.current,
          dados: dadosAtualizados,
          ui: uiSessaoRef.current,
        });
      } catch {
        /* grade já exibida com dados da listagem */
      } finally {
        setEnriquecendoDetalhes(false);
      }
    })();
  }, [relatorioEmitido]);

  useEffect(() => {
    if (recarregouSessaoRef.current) return;
    if (!relatorioEmitido || !precisaRecarregarSessaoRef.current) return;
    recarregouSessaoRef.current = true;
    emitirOuAtualizarRelatorio();
  }, [relatorioEmitido, emitirOuAtualizarRelatorio]);

  useEffect(() => {
    if (!relatorioEmitido) return undefined;
    const id = window.setTimeout(() => {
      salvarSessaoRelatorioProcessos({
        baseRaw: baseRawEmissaoRef.current,
        dados,
        ui: uiSessaoRef.current,
      });
    }, 350);
    return () => window.clearTimeout(id);
  }, [relatorioEmitido, dados, filtrosPorColuna, modoFiltroPorColuna, ordenarPor, ordemAsc]);

  useEffect(() => {
    if (!relatorioEmitido) return;
    if (dados.length > RELATORIO_MAX_LINHAS_PERSISTIDAS) return;
    try {
      window.localStorage.setItem(STORAGE_DADOS_RELATORIO, JSON.stringify(dados));
    } catch {
      /* ignore */
    }
  }, [dados, relatorioEmitido]);

  useEffect(() => {
    if (!relatorioEmitido) return undefined;
    const h = () => setDados(carregarDadosRelatorioInicial());
    window.addEventListener(EVENT_RELATORIO_PERSISTENCIA_EXTERNA, h);
    return () => window.removeEventListener(EVENT_RELATORIO_PERSISTENCIA_EXTERNA, h);
  }, [relatorioEmitido]);

  const atualizarCelulaRelatorio = (relIdx, chaveCampo, valor) => {
    setDados((prev) => {
      const next = [...prev];
      const i = next.findIndex((r) => r.__relatorioIdx === relIdx);
      if (i < 0) return prev;
      next[i] = { ...next[i], [chaveCampo]: valor };
      return next;
    });
  };

  const persistirCelulaRelatorio = useCallback(async (row, chaveCampo, valor) => {
    if (!modoAlteracao) return;
    const cod = String(row.codCliente ?? '').trim();
    const proc = String(row.proc ?? '').trim();
    if (!cod || !proc) return;

    const chaveSalvando = `${cod}:${proc}:${chaveCampo}`;
    setErroPersistencia('');

    if (featureFlags.useApiProcessos) {
      if (!tipoPersistenciaCampoRelatorio(chaveCampo)) {
        setErroPersistencia(`O campo «${chaveCampo}» não é gravado na API.`);
        return;
      }
      setSalvandoCelula(chaveSalvando);
      try {
        const res = await atualizarCampoProcessoRelatorio({
          processoId: row.processoApiId,
          codigoCliente: cod,
          numeroInterno: proc,
          fieldKey: chaveCampo,
          valor,
        });
        if (chaveCampo === 'statusAtivoTexto' && res?.statusAtivo != null) {
          const ativo = res.statusAtivo !== false;
          atualizarCelulaRelatorio(row.__relatorioIdx, 'processoCadastroAtivo', ativo);
          atualizarCelulaRelatorio(row.__relatorioIdx, 'statusAtivoTexto', ativo ? 'Ativo' : 'Inativo');
        }
        const chavesBase = chavesLinhaBaseRelatorio(chaveCampo);
        baseRawEmissaoRef.current = (baseRawEmissaoRef.current || []).map((r) => {
          if (String(r.codCliente) !== cod || String(r.proc) !== proc) return r;
          const patch = {};
          for (const k of chavesBase) {
            if (k === 'processoCadastroAtivo' && res?.statusAtivo != null) {
              patch.processoCadastroAtivo = res.statusAtivo !== false;
              patch.statusAtivoTexto = res.statusAtivo !== false ? 'Ativo' : 'Inativo';
            } else {
              patch[k] = valor;
            }
          }
          return { ...r, ...patch };
        });
      } catch (e) {
        setErroPersistencia(e?.message || 'Não foi possível gravar a alteração na API.');
      } finally {
        setSalvandoCelula(null);
      }
      return;
    }
  }, [modoAlteracao]);

  const executarExclusaoProcesso = useCallback(async (row) => {
    const cod = String(row.codCliente ?? '').trim();
    const proc = String(row.proc ?? '').trim();
    if (!cod || !proc) return;
    if (featureFlags.useApiProcessos) {
      await excluirProcessoCompleto({
        processoId: row.processoApiId,
        codigoCliente: cod,
        numeroInterno: proc,
      });
    }
    removerRegistroProcessoDoHistorico(cod, proc);
    setDados((prev) => prev.filter((r) => String(r.codCliente) !== cod || String(r.proc) !== proc));
    baseRawEmissaoRef.current = (baseRawEmissaoRef.current || []).filter(
      (r) => String(r.codCliente) !== cod || String(r.proc) !== proc
    );
    setSelecionados((prev) => {
      const next = new Set(prev);
      next.delete(`${cod}:${proc}`);
      return next;
    });
  }, []);

  const excluirProcessoDaLinha = useCallback(
    async (row) => {
      const cod = String(row.codCliente ?? '').trim();
      const proc = String(row.proc ?? '').trim();
      if (!cod || !proc) return;
      const chave = `${cod}:${proc}`;
      const cliente = String(row.cliente ?? '').trim() || cod;
      const msg =
        `Excluir permanentemente o processo?\n\n` +
        `${cliente}\nCod. ${cod} · Proc. ${proc}\n\n` +
        `Apaga andamentos, partes, cálculos, financeiro e demais vínculos. Esta ação não pode ser desfeita.`;
      if (!window.confirm(msg)) return;

      setErroExclusao('');
      setExcluindoChave(chave);
      try {
        await executarExclusaoProcesso(row);
      } catch (e) {
        setErroExclusao(e?.message || 'Não foi possível excluir o processo.');
      } finally {
        setExcluindoChave(null);
      }
    },
    [executarExclusaoProcesso]
  );

  const excluirProcessosSelecionados = useCallback(async () => {
    const rows = dados.filter((r) => selecionados.has(chaveProcessoRelatorio(r)));
    if (rows.length === 0) return;
    const msg =
      `Excluir permanentemente ${rows.length} processo(s) selecionado(s)?\n\n` +
      `Apaga andamentos, partes, cálculos, financeiro e demais vínculos. Esta ação não pode ser desfeita.`;
    if (!window.confirm(msg)) return;

    setErroExclusao('');
    setExcluindoEmLote(true);
    let ok = 0;
    const falhas = [];
    try {
      for (const row of rows) {
        const chave = chaveProcessoRelatorio(row);
        try {
          await executarExclusaoProcesso(row);
          ok += 1;
        } catch (e) {
          falhas.push(`${chave}: ${e?.message || 'erro'}`);
        }
      }
      if (falhas.length > 0) {
        setErroExclusao(
          `${ok} excluído(s), ${falhas.length} falha(s). ${falhas.slice(0, 3).join(' · ')}${
            falhas.length > 3 ? '…' : ''
          }`
        );
      } else {
        setSelecionados(new Set());
      }
    } finally {
      setExcluindoEmLote(false);
    }
  }, [dados, selecionados, executarExclusaoProcesso]);

  const dadosFiltrados = useMemo(() => {
    return dados.filter((row) => {
      if (!linhaPassaFiltroAtivo(row, filtroProcessoAtivo)) return false;
      return COLUNAS.every((col) => {
        const chave = campoPorColuna[col.id] ?? col.id;
        const valor = row[chave];
        const modo = modoFiltroPorColuna[col.id] ?? MODOS_FILTRO_COLUNA.contem;
        const filtro = filtrosPorColuna[col.id] ?? '';
        return linhaPassaFiltroColunaRelatorio(valor, filtro, modo);
      });
    });
  }, [dados, filtrosPorColuna, modoFiltroPorColuna, campoPorColuna, filtroProcessoAtivo]);

  const dadosOrdenados = useMemo(() => {
    if (!ordenarPor) return dadosFiltrados;
    return [...dadosFiltrados].sort((a, b) => {
      const chaveOrdenacao = campoPorColuna[ordenarPor] ?? ordenarPor;

      if (COLUNAS_DATA_BR.has(chaveOrdenacao)) {
        const ta = timestampDataBr(a[chaveOrdenacao]);
        const tb = timestampDataBr(b[chaveOrdenacao]);
        const cmp = ta === tb ? 0 : ta < tb ? -1 : 1;
        return ordemAsc ? cmp : -cmp;
      }
      const va = a[chaveOrdenacao] ?? '';
      const vb = b[chaveOrdenacao] ?? '';
      const cmp = String(va).localeCompare(String(vb), undefined, { numeric: true });
      return ordemAsc ? cmp : -cmp;
    });
  }, [dadosFiltrados, ordenarPor, ordemAsc, campoPorColuna]);

  const chavesFiltradas = useMemo(
    () => dadosFiltrados.map(chaveProcessoRelatorio).filter(Boolean),
    [dadosFiltrados]
  );

  const qtdSelecionados = selecionados.size;
  const todosFiltradosSelecionados =
    chavesFiltradas.length > 0 && chavesFiltradas.every((k) => selecionados.has(k));
  const algumFiltradoSelecionado = chavesFiltradas.some((k) => selecionados.has(k));
  const exclusaoEmAndamento = excluindoEmLote || excluindoChave != null;

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    el.indeterminate = algumFiltradoSelecionado && !todosFiltradosSelecionados;
  }, [algumFiltradoSelecionado, todosFiltradosSelecionados]);

  useEffect(() => {
    setSelecionados((prev) => {
      const validas = new Set(dados.map(chaveProcessoRelatorio).filter(Boolean));
      let changed = false;
      const next = new Set();
      for (const k of prev) {
        if (validas.has(k)) next.add(k);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [dados]);

  const toggleSelecionarTodosFiltrados = () => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (todosFiltradosSelecionados) {
        chavesFiltradas.forEach((k) => next.delete(k));
      } else {
        chavesFiltradas.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  const toggleSelecaoLinha = (chave) => {
    if (!chave) return;
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(chave)) next.delete(chave);
      else next.add(chave);
      return next;
    });
  };

  const toggleOrdenacao = (id) => {
    if (ordenarPor === id) setOrdemAsc((a) => !a);
    else {
      setOrdenarPor(id);
      setOrdemAsc(true);
    }
  };

  return (
    <div className="flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-gradient-to-br from-slate-100 via-indigo-50/40 to-emerald-50/50 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d] overscroll-y-contain">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
        <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex items-start gap-3">
            <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
              <FileText className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
            <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-800 to-violet-800 dark:from-indigo-200 dark:to-violet-200 bg-clip-text text-transparent">
              Relatório de Processos
            </h1>
            {!relatorioEmitido ? (
              <p className="mt-1 max-w-xl text-xs text-slate-600">
                Para não travar o navegador, as linhas só são montadas depois que você emitir o relatório.
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-600">
                {enriquecendoDetalhes ? (
                  <span className="text-indigo-700">Carregando partes e histórico em segundo plano…</span>
                ) : null}
                {dados.length === 0 ? (
                  erroEmissao || 'Nenhum processo carregado.'
                ) : dadosFiltrados.length === dados.length ? (
                  <>
                    <span className="font-semibold text-slate-800 tabular-nums">{dadosFiltrados.length}</span>
                    {dadosFiltrados.length === 1 ? ' processo' : ' processos'}
                  </>
                ) : (
                  <>
                    Exibindo{' '}
                    <span className="font-semibold text-slate-800 tabular-nums">{dadosFiltrados.length}</span>
                    {' de '}
                    <span className="tabular-nums">{dados.length}</span>
                    {' processos'}
                  </>
                )}
              </p>
            )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          {relatorioEmitido ? (
            <ChaveEdicaoOnOff
              edicaoHabilitada={modoAlteracao}
              onChange={setModoAlteracao}
              disabled={emitindoRelatorio || exclusaoEmAndamento}
              className="scale-90 origin-right"
            />
          ) : null}
          <button
            type="button"
            onClick={emitirOuAtualizarRelatorio}
            disabled={emitindoRelatorio}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:from-indigo-500 hover:to-violet-500 disabled:opacity-60 disabled:pointer-events-none shadow-lg shadow-indigo-500/20"
            title={
              relatorioEmitido
                ? 'Recarrega processos (API/mock); células editadas no relatório só permanecem em campos que não vêm da base atualizada'
                : 'Monta a tabela com todos os processos (pode levar alguns segundos)'
            }
          >
            {emitindoRelatorio ? (
              <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
            ) : (
              <FileSpreadsheet className="w-4 h-4 shrink-0" aria-hidden />
            )}
            {relatorioEmitido ? 'Atualizar relatório' : 'Emitir relatório'}
          </button>
          {relatorioEmitido && qtdSelecionados > 0 ? (
            <button
              type="button"
              disabled={exclusaoEmAndamento || modoAlteracao}
              onClick={() => void excluirProcessosSelecionados()}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm font-semibold hover:bg-red-100 disabled:opacity-60 disabled:pointer-events-none"
              title="Excluir todos os processos marcados na lista"
            >
              {excluindoEmLote ? (
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="w-4 h-4 shrink-0" aria-hidden />
              )}
              Excluir selecionados ({qtdSelecionados})
            </button>
          ) : null}
          <RelatorioPresetsPanel
            colIds={colIdsRelatorio}
            colunasVisiveis={colunasVisiveis}
            setColunasVisiveis={setColunasVisiveis}
            larguraUniforme={larguraUniforme}
            setLarguraUniforme={setLarguraUniforme}
            campoPorColuna={campoPorColuna}
            setCampoPorColuna={setCampoPorColuna}
            filtroProcessoAtivo={filtroProcessoAtivo}
            setFiltroProcessoAtivo={setFiltroProcessoAtivo}
            modoAlteracao={modoAlteracao}
            setModoAlteracao={setModoAlteracao}
          />
          <div className="relative" ref={painelColunasRef}>
            <button
              type="button"
              onClick={() => setPainelColunasAberto((v) => !v)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-indigo-200 bg-white text-indigo-900 text-sm font-medium hover:bg-indigo-50 shadow-sm"
              title="Escolher quais colunas exibir e largura"
            >
              <Columns3 className="w-4 h-4 shrink-0" aria-hidden />
              Colunas
            </button>
            {painelColunasAberto ? (
              <div className="absolute right-0 top-full mt-1 z-20 w-[min(100vw-2rem,22rem)] rounded-xl border border-slate-200/90 bg-white shadow-xl ring-1 ring-indigo-500/10 p-3 text-sm">
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
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-xl ring-1 ring-indigo-500/10">
          {emitindoRelatorio && !relatorioEmitido ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 p-10 text-slate-600">
              <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" aria-hidden />
              <p className="text-sm font-medium text-slate-800">Gerando relatório…</p>
              <p className="text-xs text-slate-500 text-center max-w-sm">Aguarde enquanto as linhas são montadas.</p>
            </div>
          ) : !relatorioEmitido ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 p-10 text-center">
              <FileSpreadsheet className="w-14 h-14 text-slate-300" aria-hidden />
              <div className="max-w-md space-y-2">
                <p className="text-slate-800 font-medium">Relatório de Processos ainda não foi emitido</p>
                <p className="text-sm text-slate-600">
                  Use o botão <strong className="text-slate-800">Emitir relatório</strong> acima para carregar a grade. Isso evita que a página congele ao entrar no menu.
                </p>
              </div>
              <button
                type="button"
                onClick={emitirOuAtualizarRelatorio}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/20"
              >
                <FileSpreadsheet className="w-4 h-4 shrink-0" aria-hidden />
                Emitir relatório
              </button>
            </div>
          ) : (
          <div className="relative min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable]">
            {emitindoRelatorio ? (
              <div className="absolute inset-0 z-20 bg-white/70 flex items-center justify-center gap-2 text-sm font-medium text-slate-700">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" aria-hidden />
                Atualizando…
              </div>
            ) : null}
            {erroEmissao && dados.length === 0 ? (
              <p className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-100">{erroEmissao}</p>
            ) : null}
            {erroExclusao ? (
              <p className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-100">{erroExclusao}</p>
            ) : null}
            {erroPersistencia ? (
              <p className="px-4 py-3 text-sm text-red-700 bg-red-50 border-b border-red-100">{erroPersistencia}</p>
            ) : null}
            <table
              className={`w-full text-sm border-collapse ${larguraUniforme ? 'table-fixed' : ''}`}
              style={{ minWidth: larguraUniforme ? '100%' : 'max-content' }}
            >
              <thead className="sticky top-0 z-10">
                <tr className="bg-gradient-to-r from-indigo-600 to-violet-700 text-white shadow-md">
                  <th
                    className="px-2 py-2 w-10 text-center sticky left-0 z-20 bg-indigo-600 shadow-[4px_0_8px_-2px_rgba(0,0,0,0.15)]"
                    title="Selecionar todos os processos visíveis (filtros aplicados)"
                  >
                    <input
                      ref={selectAllRef}
                      type="checkbox"
                      checked={todosFiltradosSelecionados}
                      disabled={
                        !relatorioEmitido ||
                        chavesFiltradas.length === 0 ||
                        exclusaoEmAndamento ||
                        modoAlteracao
                      }
                      onChange={toggleSelecionarTodosFiltrados}
                      className="rounded border-white/40"
                      aria-label="Selecionar todos os processos da lista filtrada"
                    />
                  </th>
                  {colunasAtivas.map((col) => (
                    <RelatorioUltimoAndamentoHeader
                      key={col.id}
                      menuInstanceId={col.id}
                      minWStyle={{ minWidth: col.minW }}
                      larguraUniforme={larguraUniforme}
                      colunasAtivasLength={colunasAtivas.length}
                      options={CAMPOS_OPCOES_ULTIMO_ANDAMENTO}
                      selectedFieldKey={campoPorColuna[col.id] ?? col.id}
                      onSelectField={(fieldKey) =>
                        setCampoPorColuna((prev) => ({ ...prev, [col.id]: fieldKey }))
                      }
                      onSort={() => toggleOrdenacao(col.id)}
                      ordenarAtivo={ordenarPor === col.id}
                      ordemAsc={ordemAsc}
                      modoAlteracao={modoAlteracao}
                    />
                  ))}
                  <th
                    className="px-2 py-2 text-left text-xs font-semibold whitespace-nowrap w-12 sticky right-0 bg-gradient-to-r from-indigo-600 to-violet-700 shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.15)]"
                    title="Excluir processo"
                  >
                    <span className="sr-only">Excluir</span>
                  </th>
                </tr>
                <tr className="bg-slate-100">
                  <th className="px-1.5 py-1 border-b border-r border-slate-300 sticky left-0 z-20 bg-slate-100 w-10" aria-hidden />
                  {colunasAtivas.map((col) => {
                    const modoFiltro = modoFiltroPorColuna[col.id] ?? MODOS_FILTRO_COLUNA.contem;
                    const filtroPorTexto = modoFiltro === MODOS_FILTRO_COLUNA.contem;
                    return (
                    <th
                      key={`${col.id}-filtro`}
                      className="px-1.5 py-1 border-b border-r border-slate-300 last:border-r-0"
                      style={larguraUniforme ? { width: `${100 / colunasAtivas.length}%`, minWidth: 0 } : { minWidth: col.minW }}
                    >
                      <div className="flex min-w-0 gap-1">
                        <select
                          value={modoFiltro}
                          onChange={(e) =>
                            setModoFiltroPorColuna((prev) => ({
                              ...prev,
                              [col.id]: e.target.value,
                            }))
                          }
                          className={`shrink-0 max-w-[5.5rem] px-1 py-1 border rounded text-[11px] bg-white ${
                            modoFiltro !== MODOS_FILTRO_COLUNA.contem
                              ? 'border-indigo-300 text-indigo-800 font-medium'
                              : modoAlteracao
                                ? 'border-red-200 text-red-700'
                                : 'border-slate-300 text-slate-600'
                          }`}
                          title="Tipo de filtro da coluna"
                          aria-label={`Tipo de filtro — ${col.label}`}
                        >
                          {OPCOES_MODO_FILTRO_COLUNA.map((op) => (
                            <option key={op.value} value={op.value}>
                              {op.label}
                            </option>
                          ))}
                        </select>
                        <input
                          type="text"
                          value={filtrosPorColuna[col.id] ?? ''}
                          disabled={!filtroPorTexto}
                          onChange={(e) =>
                            setFiltrosPorColuna((prev) => ({
                              ...prev,
                              [col.id]: e.target.value,
                            }))
                          }
                          placeholder={filtroPorTexto ? 'Filtrar...' : '—'}
                          className={`min-w-0 flex-1 px-2 py-1 border rounded text-xs bg-white disabled:bg-slate-50 disabled:text-slate-400 ${
                            modoAlteracao
                              ? 'border-red-200 text-red-700 placeholder:text-red-300'
                              : 'border-slate-300 text-slate-700'
                          }`}
                        />
                      </div>
                    </th>
                    );
                  })}
                  <th className="px-1.5 py-1 border-b border-slate-300 bg-slate-100 sticky right-0 w-12" aria-hidden />
                </tr>
              </thead>
              <tbody>
                {dadosOrdenados.length === 0 ? (
                  <tr>
                    <td colSpan={colunasAtivas.length + 2} className="px-3 py-6 text-center text-slate-500">
                      Nenhum resultado para os filtros aplicados.
                    </td>
                  </tr>
                ) : (
                  dadosOrdenados.map((row, idx) => {
                    const chaveExcluir = chaveProcessoRelatorio(row);
                    const excluindo = excluindoChave === chaveExcluir;
                    const selecionado = selecionados.has(chaveExcluir);
                    const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50';
                    return (
                    <tr
                      key={row.__relatorioIdx ?? idx}
                      className={`border-b border-slate-200 hover:bg-slate-50 ${rowBg} ${
                        modoAlteracao ? 'cursor-default' : 'cursor-pointer'
                      } ${selecionado ? 'ring-1 ring-inset ring-indigo-200' : ''}`}
                      title={
                        modoAlteracao
                          ? 'Modo alteração: edite as células (texto em vermelho). Saia do campo para gravar na API. Cod. Cliente e Proc. são fixos.'
                          : 'Duplo clique: abrir processo'
                      }
                      onDoubleClick={() => {
                        if (modoAlteracao) return;
                        navigate('/processos', {
                          state: buildRouterStateChaveClienteProcesso(row.codCliente ?? '', row.proc ?? ''),
                        });
                      }}
                    >
                      <td
                        className={`px-2 py-1.5 border-r border-slate-200 text-center sticky left-0 z-[1] ${rowBg}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selecionado}
                          disabled={!chaveExcluir || exclusaoEmAndamento || modoAlteracao}
                          onChange={() => toggleSelecaoLinha(chaveExcluir)}
                          className="rounded border-slate-300"
                          aria-label={`Selecionar processo ${row.codCliente} proc. ${row.proc}`}
                        />
                      </td>
                      {colunasAtivas.map((col) => {
                        const chaveValor = campoPorColuna[col.id] ?? col.id;
                        const textoCelula = row[chaveValor] ?? '';
                        const valorStr = String(textoCelula);
                        const persistivelApi =
                          !featureFlags.useApiProcessos || !!tipoPersistenciaCampoRelatorio(chaveValor);
                        const soLeitura =
                          COLUNAS_RELATORIO_SO_LEITURA.has(col.id) ||
                          !modoAlteracao ||
                          (modoAlteracao && featureFlags.useApiProcessos && !persistivelApi);
                        const labelAcessivel =
                          CAMPOS_OPCOES_ULTIMO_ANDAMENTO.find((o) => o.fieldKey === chaveValor)?.label ?? col.label;
                        const chaveSalvandoCelula = `${row.codCliente}:${row.proc}:${chaveValor}`;
                        const salvandoEstaCelula = salvandoCelula === chaveSalvandoCelula;

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
                              className={`px-2 py-1.5 border-r border-slate-200 last:border-r-0 ${
                                modoAlteracao ? 'text-red-600 font-semibold' : 'text-slate-800'
                              } ${col.id === 'codCliente' ? 'tabular-nums' : ''} ${
                                larguraUniforme ? 'truncate max-w-0' : ''
                              }`}
                              style={larguraUniforme ? { width: `${100 / colunasAtivas.length}%`, minWidth: 0 } : { minWidth: col.minW }}
                              title={
                                larguraUniforme
                                  ? valorStr
                                  : modoAlteracao && featureFlags.useApiProcessos && !persistivelApi
                                    ? 'Campo somente leitura (não gravado na API)'
                                    : undefined
                              }
                            >
                              {valorStr}
                            </td>
                          );
                        }

                        return (
                          <td
                            key={col.id}
                            className={`p-0 border-r border-slate-200 last:border-r-0 align-stretch ${larguraUniforme ? 'max-w-0' : ''} ${
                              salvandoEstaCelula ? 'bg-amber-50/80' : ''
                            }`}
                            style={larguraUniforme ? { width: `${100 / colunasAtivas.length}%`, minWidth: 0 } : { minWidth: col.minW }}
                          >
                            <input
                              type="text"
                              value={valorStr}
                              onChange={(e) =>
                                atualizarCelulaRelatorio(row.__relatorioIdx, chaveValor, e.target.value)
                              }
                              onBlur={(e) => void persistirCelulaRelatorio(row, chaveValor, e.target.value)}
                              disabled={salvandoEstaCelula}
                              className="w-full min-w-0 bg-transparent px-2 py-1.5 text-sm text-red-600 outline-none border-0 focus:ring-2 focus:ring-inset focus:ring-red-200 disabled:opacity-60"
                              aria-label={`${labelAcessivel} — linha ${(row.__relatorioIdx ?? idx) + 1}`}
                            />
                          </td>
                        );
                      })}
                      <td
                        className={`px-1 py-1 border-r-0 border-slate-200 text-center sticky right-0 ${rowBg}`}
                      >
                        <button
                          type="button"
                          disabled={excluindo || exclusaoEmAndamento || modoAlteracao}
                          onClick={(e) => {
                            e.stopPropagation();
                            void excluirProcessoDaLinha(row);
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md text-red-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-40 disabled:pointer-events-none"
                          title={
                            modoAlteracao
                              ? 'Desative o modo de alteração para excluir'
                              : 'Excluir processo e todos os dados vinculados'
                          }
                          aria-label={`Excluir processo ${row.codCliente} proc. ${row.proc}`}
                        >
                          {excluindo ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                          ) : (
                            <Trash2 className="w-4 h-4" aria-hidden />
                          )}
                        </button>
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, HelpCircle, X } from 'lucide-react';
import { Column } from './Column';
import { columns, getBoardData, tasksByColumn } from '../data/mockData';
import { getUsuariosAtivos } from '../data/agendaPersistenciaData';
import { getNomeExibicaoUsuario } from '../data/usuarioDisplayHelpers.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  agruparTarefasPorColunas,
  buildAtualizarTarefaBody,
  buildCriarTarefaBody,
  colunasBoardComSemResponsavel,
  itemFromApi,
  pendenciaVaziaApi,
} from '../data/tarefasBoardAdapter.js';
import {
  atualizarTarefaOperacional,
  criarTarefaOperacional,
  listarTarefasOperacionais,
  patchStatusTarefaOperacional,
} from '../repositories/tarefasOperacionaisRepository.js';
import { buildRouterStateChaveClienteProcesso } from '../domain/camposProcessoCliente.js';

/**
 * IDs antigos da tela Pendências (mock) → mesmo cadastro de Usuários (ex.: kari ↔ karla no storage).
 */
const PENDENCIAS_STORAGE_ID_FALLBACK = {
  kari: 'karla',
  isabelia: 'isabella',
  ana: 'thalita',
};

function getColumnsPendencias() {
  try {
    const u = getUsuariosAtivos();
    if (Array.isArray(u) && u.length > 0) {
      return u.map((x) => ({ id: String(x.id), name: String(x.nome) }));
    }
  } catch {
    /* ignore */
  }
  return columns.map((c) => ({ ...c }));
}

function obterListaNoStorage(parsed, colId) {
  if (!parsed || typeof parsed !== 'object') return null;
  if (Array.isArray(parsed[colId])) return parsed[colId];
  const fb = PENDENCIAS_STORAGE_ID_FALLBACK[colId];
  if (fb && Array.isArray(parsed[fb])) return parsed[fb];
  return null;
}

function seedTasksTitlesForColumn(colId) {
  const direct = tasksByColumn[colId];
  if (Array.isArray(direct) && direct.length) return direct;
  const fb = PENDENCIAS_STORAGE_ID_FALLBACK[colId];
  if (fb && tasksByColumn[fb]) return tasksByColumn[fb];
  return [];
}

const PENDENCIAS_STORAGE_KEY_V1 = 'pendencias_por_usuario_v1';
const PENDENCIAS_STORAGE_KEY_V2 = 'pendencias_por_usuario_v2';
const PROCESSOS_STORAGE_KEY = 'vilareal:processos-historico:v1';

function makePendenciaId() {
  return `p-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function pendenciaVazia() {
  return { id: makePendenciaId(), texto: '', criadoEm: null, finalizadoEm: null };
}

function normalizarPendenciaItem(item, seedNowIso) {
  if (typeof item === 'string') {
    const texto = String(item ?? '');
    return {
      id: makePendenciaId(),
      texto,
      criadoEm: texto.trim() ? seedNowIso : null,
      finalizadoEm: null,
    };
  }

  if (!item || typeof item !== 'object') {
    return { id: makePendenciaId(), texto: '', criadoEm: null, finalizadoEm: null };
  }

  const texto = String(item.texto ?? item.valor ?? item.title ?? '');
  const criadoEm = item.criadoEm ?? item.dataHoraCriada ?? null;
  const finalizadoEm = item.finalizadoEm ?? item.dataHoraFinalizada ?? null;

  return {
    id: item.id ? String(item.id) : makePendenciaId(),
    texto,
    criadoEm: criadoEm || (texto.trim() ? seedNowIso : null),
    finalizadoEm: finalizadoEm || null,
  };
}

function normalizarListaPendencias(lista, seedNow) {
  const arr = Array.isArray(lista) ? lista : [];
  const normalizados = arr.map((it) => normalizarPendenciaItem(it, seedNow));
  while (
    normalizados.length > 1 &&
    String(normalizados[normalizados.length - 1]?.texto ?? '').trim() === '' &&
    String(normalizados[normalizados.length - 2]?.texto ?? '').trim() === ''
  ) {
    normalizados.pop();
  }
  const ultimo = normalizados[normalizados.length - 1];
  if (!ultimo || String(ultimo.texto ?? '').trim() !== '') {
    normalizados.push(pendenciaVazia());
  }
  return normalizados;
}

function getPendenciasIniciais() {
  const seedNow = nowIso();
  const cols = getColumnsPendencias();

  try {
    const rawV2 = window.localStorage.getItem(PENDENCIAS_STORAGE_KEY_V2);
    if (rawV2) {
      const parsedV2 = JSON.parse(rawV2);
      if (parsedV2 && typeof parsedV2 === 'object' && !Array.isArray(parsedV2)) {
        const normalized = {};
        for (const col of cols) {
          const rawLista = obterListaNoStorage(parsedV2, col.id);
          normalized[col.id] = normalizarListaPendencias(rawLista || [], seedNow);
        }
        return normalized;
      }
    }

    const rawV1 = window.localStorage.getItem(PENDENCIAS_STORAGE_KEY_V1);
    if (rawV1) {
      const parsedV1 = JSON.parse(rawV1);
      if (parsedV1 && typeof parsedV1 === 'object' && !Array.isArray(parsedV1)) {
        const migrated = {};
        for (const col of cols) {
          const rawLista = obterListaNoStorage(parsedV1, col.id);
          migrated[col.id] = normalizarListaPendencias(rawLista || [], seedNow);
        }
        return migrated;
      }
    }
  } catch {
    // segue fallback
  }

  const base = {};
  for (const col of cols) {
    const origem = seedTasksTitlesForColumn(col.id);
    const textos = origem.map((t) => String(t.title || '')).filter((t) => t.trim() !== '');
    base[col.id] = [...textos].map((texto) => normalizarPendenciaItem(texto, seedNow));
    base[col.id].push(pendenciaVazia());
  }
  return base;
}

export function Board() {
  const location = useLocation();
  const navigate = useNavigate();
  const [usuariosColunas, setUsuariosColunas] = useState(() => getUsuariosAtivos());

  useEffect(() => {
    const sync = () => setUsuariosColunas(getUsuariosAtivos());
    sync();
    window.addEventListener('vilareal:usuarios-agenda-atualizados', sync);
    return () => window.removeEventListener('vilareal:usuarios-agenda-atualizados', sync);
  }, []);

  useEffect(() => {
    if (location.pathname === '/pendencias') {
      setUsuariosColunas(getUsuariosAtivos());
    }
  }, [location.pathname]);

  const columnsPendencias = useMemo(() => {
    if (Array.isArray(usuariosColunas) && usuariosColunas.length > 0) {
      return usuariosColunas.map((x) => ({ id: String(x.id), name: String(getNomeExibicaoUsuario(x)) }));
    }
    return columns.map((c) => ({ ...c }));
  }, [usuariosColunas]);

  const colIdsKeyPendencias = useMemo(() => columnsPendencias.map((c) => c.id).join('|'), [columnsPendencias]);

  const emPendencias = useMemo(
    () => location.pathname === '/pendencias',
    [location.pathname]
  );

  const columnsParaPendencias = useMemo(() => {
    if (!emPendencias || !featureFlags.useApiTarefas) return columnsPendencias;
    return colunasBoardComSemResponsavel(columnsPendencias, true);
  }, [emPendencias, columnsPendencias]);

  const colIdsKeyParaPendencias = useMemo(
    () => columnsParaPendencias.map((c) => c.id).join('|'),
    [columnsParaPendencias]
  );

  const [selectedTaskId, setSelectedTaskId] = useState('k1');
  const [pendenciasInicial] = useState(() =>
    typeof window !== 'undefined' && featureFlags.useApiTarefas ? {} : getPendenciasIniciais()
  );
  const [pendenciasPorUsuario, setPendenciasPorUsuario] = useState(() => pendenciasInicial);
  const [pendenciasDraftPorUsuario, setPendenciasDraftPorUsuario] = useState(() =>
    JSON.parse(JSON.stringify(pendenciasInicial))
  );

  /** Pendências em localStorage: outra aba grava → recarrega listas (modo legado). */
  useEffect(() => {
    if (featureFlags.useApiTarefas) return undefined;
    const h = () => {
      const next = getPendenciasIniciais();
      setPendenciasPorUsuario(next);
      setPendenciasDraftPorUsuario(JSON.parse(JSON.stringify(next)));
    };
    window.addEventListener('vilareal:pendencias-por-usuario-atualizadas', h);
    return () => window.removeEventListener('vilareal:pendencias-por-usuario-atualizadas', h);
  }, []);

  const [modalPendencias, setModalPendencias] = useState(null);
  const [modalAcoesPendencia, setModalAcoesPendencia] = useState(null);
  const [modalConsultaPendencia, setModalConsultaPendencia] = useState(null);
  const [erroLocalizarPendencia, setErroLocalizarPendencia] = useState('');
  const [refreshTickTarefasApi, setRefreshTickTarefasApi] = useState(0);
  const [apiLoadingTarefas, setApiLoadingTarefas] = useState(false);
  const [apiErrorTarefas, setApiErrorTarefas] = useState('');
  const [apiSuccessTarefas, setApiSuccessTarefas] = useState('');
  const [apiMutationBusy, setApiMutationBusy] = useState(false);
  const [filtroApiResponsavel, setFiltroApiResponsavel] = useState('');
  const [filtroApiStatus, setFiltroApiStatus] = useState('');
  const [filtroApiPrioridade, setFiltroApiPrioridade] = useState('');
  const boardData = getBoardData();
  const usarApiPendencias = emPendencias && featureFlags.useApiTarefas;

  const refreshTarefasApi = useCallback(() => {
    setRefreshTickTarefasApi((t) => t + 1);
  }, []);

  /** Criação contextual de tarefas (Processos/Publicações) — mesmo refresh explícito do board. */
  useEffect(() => {
    if (!featureFlags.useApiTarefas) return;
    const h = () => setRefreshTickTarefasApi((t) => t + 1);
    window.addEventListener('vilareal:tarefas-criada', h);
    return () => window.removeEventListener('vilareal:tarefas-criada', h);
  }, []);

  function montarQueryListagemTarefas() {
    const q = {};
    if (filtroApiStatus) q.status = filtroApiStatus;
    if (filtroApiPrioridade) q.prioridade = filtroApiPrioridade;
    if (filtroApiResponsavel && filtroApiResponsavel !== '__sem__') {
      q.responsavelId = Number(filtroApiResponsavel);
    }
    return q;
  }

  function pendenciaVaziaAtual() {
    return usarApiPendencias ? pendenciaVaziaApi() : pendenciaVazia();
  }

  /** Carrega tarefas da API (Fase 8) — query no repository + agrupamento com coluna “Sem responsável”. */
  useEffect(() => {
    if (!emPendencias || !featureFlags.useApiTarefas) return;
    let ativo = true;
    setApiLoadingTarefas(true);
    setApiErrorTarefas('');
    void listarTarefasOperacionais(montarQueryListagemTarefas())
      .then((list) => {
        if (!ativo) return;
        let arr = Array.isArray(list) ? list : [];
        if (filtroApiResponsavel === '__sem__') {
          arr = arr.filter((t) => t.responsavelUsuarioId == null);
        }
        const grouped = agruparTarefasPorColunas(arr, columnsParaPendencias);
        setPendenciasPorUsuario(grouped);
        setPendenciasDraftPorUsuario(JSON.parse(JSON.stringify(grouped)));
      })
      .catch((e) => {
        if (ativo) setApiErrorTarefas(e?.message || 'Falha ao carregar tarefas.');
      })
      .finally(() => {
        if (ativo) setApiLoadingTarefas(false);
      });
    return () => {
      ativo = false;
    };
  }, [
    emPendencias,
    colIdsKeyParaPendencias,
    refreshTickTarefasApi,
    columnsParaPendencias,
    filtroApiResponsavel,
    filtroApiStatus,
    filtroApiPrioridade,
  ]);

  useEffect(() => {
    if (!apiSuccessTarefas) return;
    const t = setTimeout(() => setApiSuccessTarefas(''), 4500);
    return () => clearTimeout(t);
  }, [apiSuccessTarefas]);

  /** Novas pessoas em Usuários: cria listas de pendências alinhadas ao storage / seed. */
  useEffect(() => {
    if (!emPendencias || featureFlags.useApiTarefas) return;
    const cols = getColumnsPendencias();
    const seedNow = nowIso();
    setPendenciasPorUsuario((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const col of cols) {
        if (next[col.id] !== undefined && Array.isArray(next[col.id])) continue;
        changed = true;
        try {
          const rawV2 = window.localStorage.getItem(PENDENCIAS_STORAGE_KEY_V2);
          const parsedV2 = rawV2 ? JSON.parse(rawV2) : {};
          const fromStore = obterListaNoStorage(parsedV2, col.id);
          if (fromStore) {
            next[col.id] = normalizarListaPendencias(fromStore, seedNow);
          } else {
            const origem = seedTasksTitlesForColumn(col.id);
            const textos = origem.map((t) => String(t.title || '')).filter((t) => t.trim() !== '');
            next[col.id] = [...textos].map((texto) => normalizarPendenciaItem(texto, seedNow));
            next[col.id].push(pendenciaVazia());
          }
        } catch {
          next[col.id] = [pendenciaVazia()];
        }
      }
      return changed ? next : prev;
    });
    setPendenciasDraftPorUsuario((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const col of cols) {
        if (next[col.id] !== undefined && Array.isArray(next[col.id])) continue;
        changed = true;
        try {
          const rawV2 = window.localStorage.getItem(PENDENCIAS_STORAGE_KEY_V2);
          const parsedV2 = rawV2 ? JSON.parse(rawV2) : {};
          const fromStore = obterListaNoStorage(parsedV2, col.id);
          if (fromStore) {
            next[col.id] = normalizarListaPendencias(fromStore, seedNow);
          } else {
            const origem = seedTasksTitlesForColumn(col.id);
            const textos = origem.map((t) => String(t.title || '')).filter((t) => t.trim() !== '');
            next[col.id] = [...textos].map((texto) => normalizarPendenciaItem(texto, seedNow));
            next[col.id].push(pendenciaVazia());
          }
        } catch {
          next[col.id] = [pendenciaVazia()];
        }
      }
      return changed ? next : prev;
    });
  }, [emPendencias, colIdsKeyPendencias]);

  function persistirPendencias(next) {
    if (featureFlags.useApiTarefas) return;
    try {
      window.localStorage.setItem(PENDENCIAS_STORAGE_KEY_V2, JSON.stringify(next));
    } catch {
      // storage pode estar indisponível
    }
  }

  function atualizarPendenciaDraft(usuarioId, idx, valor) {
    const vazio = pendenciaVaziaAtual();
    setPendenciasDraftPorUsuario((prev) => {
      const base = Array.isArray(prev[usuarioId]) ? prev[usuarioId] : [vazio];
      const listaAtual = base.map((x) => ({ ...(x || {}) }));

      if (!listaAtual[idx]) {
        while (listaAtual.length <= idx) listaAtual.push(pendenciaVaziaAtual());
      }

      listaAtual[idx] = { ...(listaAtual[idx] || pendenciaVaziaAtual()), texto: valor };

      // Se preencheu a última caixa, cria outra em branco (lista infinita).
      if (idx === listaAtual.length - 1 && String(valor).trim() !== '') {
        listaAtual.push(pendenciaVaziaAtual());
      }

      // Mantém apenas uma caixa vazia no final.
      while (
        listaAtual.length > 1 &&
        String(listaAtual[listaAtual.length - 1]?.texto ?? '').trim() === '' &&
        String(listaAtual[listaAtual.length - 2]?.texto ?? '').trim() === ''
      ) {
        listaAtual.pop();
      }

      return { ...prev, [usuarioId]: listaAtual };
    });
  }

  function abrirModalConfirmacao(usuarioId, idx, acaoDepois = null) {
    if (modalPendencias) return;

    const listaPersistida = Array.isArray(pendenciasPorUsuario?.[usuarioId])
      ? pendenciasPorUsuario[usuarioId]
      : [pendenciaVaziaAtual()];
    const listaDraft = Array.isArray(pendenciasDraftPorUsuario?.[usuarioId])
      ? pendenciasDraftPorUsuario[usuarioId]
      : [pendenciaVaziaAtual()];

    const valorAnterior = listaPersistida[idx]?.texto ?? '';
    const valorNovo = listaDraft[idx]?.texto ?? '';

    if (String(valorAnterior) === String(valorNovo)) return;

    setModalPendencias({
      usuarioId,
      idx,
      valorAnterior: String(valorAnterior ?? ''),
      valorNovo: String(valorNovo ?? ''),
      listaAnterior: listaPersistida.map((x) => ({ ...(x || pendenciaVaziaAtual()) })),
      acaoDepois,
    });
  }

  function reverterAlteracaoModal() {
    if (!modalPendencias) return;
    const { usuarioId, listaAnterior } = modalPendencias;
    setPendenciasDraftPorUsuario((prev) => ({ ...prev, [usuarioId]: [...listaAnterior] }));
    setModalPendencias(null);
  }

  async function confirmarAlteracaoModal() {
    if (!modalPendencias) return;
    const { usuarioId, idx, listaAnterior, acaoDepois } = modalPendencias;

    if (!usarApiPendencias) {
      const next = {
        ...(pendenciasPorUsuario || {}),
        ...(pendenciasDraftPorUsuario || {}),
      };

      const listaDraft = Array.isArray(pendenciasDraftPorUsuario?.[usuarioId])
        ? pendenciasDraftPorUsuario[usuarioId]
        : [];
      const novaLista = listaDraft.map((x) => ({ ...(x || pendenciaVazia()) }));

      if (!novaLista[idx]) novaLista[idx] = pendenciaVazia();

      const textoFinal = String(novaLista[idx]?.texto ?? '');
      const itemAnterior = listaAnterior?.[idx] || null;
      const criadoJaExiste = !!(itemAnterior && itemAnterior.criadoEm);
      if (!novaLista[idx].criadoEm && textoFinal.trim() && !criadoJaExiste) {
        novaLista[idx].criadoEm = nowIso();
      }
      if (!novaLista[idx].criadoEm && textoFinal.trim()) {
        novaLista[idx].criadoEm = nowIso();
      }

      next[usuarioId] = novaLista;

      setPendenciasPorUsuario(next);
      persistirPendencias(next);
      setModalPendencias(null);

      if (!acaoDepois) return;

      if (acaoDepois.tipo === 'finalizar') {
        const listaAtualizada = next[usuarioId].map((x) => ({ ...(x || pendenciaVazia()) }));
        const item = listaAtualizada[idx] || pendenciaVazia();
        item.finalizadoEm = item.finalizadoEm || nowIso();
        listaAtualizada[idx] = item;
        const nextFinal = { ...(next || {}), [usuarioId]: listaAtualizada };
        setPendenciasPorUsuario(nextFinal);
        setPendenciasDraftPorUsuario((prev) => ({ ...(prev || {}), [usuarioId]: listaAtualizada }));
        persistirPendencias(nextFinal);
        return;
      }

      if (acaoDepois.tipo === 'localizar') {
        const texto = String(next[usuarioId]?.[idx]?.texto ?? '');
        const ref = extrairReferenciaProcesso(texto);
        if (!ref) {
          setErroLocalizarPendencia('Não encontrei referência de processo no texto da pendência.');
          return;
        }
        navigate('/processos', { state: buildRouterStateChaveClienteProcesso(ref.codCliente ?? '', ref.proc ?? '') });
        return;
      }

      if (acaoDepois.tipo === 'consultar') {
        const item = next[usuarioId]?.[idx] || null;
        setModalConsultaPendencia(item ? { usuarioId, idx, ...item } : null);
      }
      return;
    }

    const listaDraft = Array.isArray(pendenciasDraftPorUsuario?.[usuarioId])
      ? pendenciasDraftPorUsuario[usuarioId]
      : [];
    const novaLista = listaDraft.map((x) => ({ ...(x || pendenciaVaziaApi()) }));
    if (!novaLista[idx]) novaLista[idx] = pendenciaVaziaApi();
    const textoFinal = String(novaLista[idx]?.texto ?? '');
    const itemAtual = novaLista[idx] || pendenciaVaziaApi();

    if (!textoFinal.trim() && !itemAtual.apiId) {
      setApiErrorTarefas('Informe um texto para criar a tarefa.');
      reverterAlteracaoModal();
      return;
    }

    setApiMutationBusy(true);
    setApiErrorTarefas('');
    setApiSuccessTarefas('');
    try {
      let resp;
      if (itemAtual.apiId) {
        resp = await atualizarTarefaOperacional(
          itemAtual.apiId,
          buildAtualizarTarefaBody(usuarioId, textoFinal, itemAtual)
        );
      } else {
        resp = await criarTarefaOperacional(buildCriarTarefaBody(usuarioId, textoFinal));
      }
      let merged = itemFromApi(resp);

      if (acaoDepois?.tipo === 'finalizar') {
        const r2 = await patchStatusTarefaOperacional(merged.apiId, { status: 'CONCLUIDA' });
        merged = itemFromApi(r2);
      }

      setModalPendencias(null);
      setApiSuccessTarefas(
        acaoDepois?.tipo === 'finalizar' ? 'Tarefa concluída com sucesso.' : 'Tarefa salva com sucesso.'
      );

      if (acaoDepois?.tipo === 'localizar') {
        const texto = String(merged.texto ?? '');
        const ref = extrairReferenciaProcesso(texto);
        if (!ref) {
          setErroLocalizarPendencia('Não encontrei referência de processo no texto da pendência.');
          refreshTarefasApi();
          return;
        }
        navigate('/processos', { state: buildRouterStateChaveClienteProcesso(ref.codCliente ?? '', ref.proc ?? '') });
        refreshTarefasApi();
        return;
      }

      if (acaoDepois?.tipo === 'consultar') {
        setModalConsultaPendencia({ usuarioId, idx, ...merged });
      }
      refreshTarefasApi();
    } catch (e) {
      setApiErrorTarefas(e?.message || 'Falha ao salvar a tarefa.');
    } finally {
      setApiMutationBusy(false);
    }
  }

  function abrirModalAcoesPendencia(usuarioId, idx) {
    setModalAcoesPendencia({
      usuarioId,
      idx,
      acaoSelecionada: 'finalizar', // default (como no anexo)
    });
  }

  function fecharModalAcoesPendencia() {
    setModalAcoesPendencia(null);
  }

  function apenasDigitos(v) {
    return String(v ?? '').replace(/\D/g, '');
  }

  function buscarProcessoNoStorePorNumero(numeroProcesso) {
    const target = apenasDigitos(numeroProcesso);
    if (!target) return null;

    let store = {};
    try {
      const raw = window.localStorage.getItem(PROCESSOS_STORAGE_KEY);
      if (raw) store = JSON.parse(raw) || {};
    } catch {
      // ignora
    }

    for (const [key, regRaw] of Object.entries(store)) {
      const reg = regRaw || {};
      const novo = apenasDigitos(reg.numeroProcessoNovo);
      const velho = apenasDigitos(reg.numeroProcessoVelho);
      if (novo && target && novo === target) {
        const [codCliente, proc] = key.split(':');
        return { codCliente: reg.codCliente || codCliente || '', proc: reg.proc ?? proc ?? '' };
      }
      if (velho && target && velho === target) {
        const [codCliente, proc] = key.split(':');
        return { codCliente: reg.codCliente || codCliente || '', proc: reg.proc ?? proc ?? '' };
      }
    }
    return null;
  }

  function extrairReferenciaProcesso(textoPendencia) {
    const s = String(textoPendencia ?? '');

    // 1) Número do processo (padrão CNJ mock: 0000000-00.0000.8.09.0137).
    const mNumeroProcesso = s.match(/\b\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}\b/);
    if (mNumeroProcesso && mNumeroProcesso[0]) {
      const found = buscarProcessoNoStorePorNumero(mNumeroProcesso[0]);
      if (found?.codCliente && found?.proc) return found;
    }

    // 2) Código do Cliente + Processo (ex.: "codCliente 3 proc 2", "Cod. Cliente: 3 / Proc: 2").
    const mCod =
      s.match(/\bcod(?:\\.?\s*)?cliente\b\s*[-:]?\s*(\d{1,10})/i) ||
      s.match(/\bcodigo(?:\s*do)?\s*cliente\b\s*[-:]?\s*(\d{1,10})/i) ||
      s.match(/\bcliente\b\s*[-:]?\s*(\d{1,10})/i);
    const mProc =
      s.match(/\bproc(?:esso)?\b\s*[-:]?\s*(\d{1,10})/i) ||
      s.match(/\bprocesso\b\s*[-:]?\s*(\d{1,10})/i) ||
      s.match(/\bproc\b\s*(\d{1,10})/i);

    const codCliente = mCod?.[1];
    const proc = mProc?.[1];
    if (codCliente && proc) return { codCliente, proc };

    return null;
  }

  async function executarAcaoPendencia(acaoTipo) {
    if (!modalAcoesPendencia) return;
    const { usuarioId, idx } = modalAcoesPendencia;

    const listaPersistida = Array.isArray(pendenciasPorUsuario?.[usuarioId]) ? pendenciasPorUsuario[usuarioId] : [];
    const listaDraft = Array.isArray(pendenciasDraftPorUsuario?.[usuarioId]) ? pendenciasDraftPorUsuario[usuarioId] : [];

    const textoAnterior = listaPersistida[idx]?.texto ?? '';
    const textoNovo = listaDraft[idx]?.texto ?? '';

    if (String(textoAnterior) !== String(textoNovo)) {
      setModalAcoesPendencia(null);
      abrirModalConfirmacao(usuarioId, idx, { tipo: acaoTipo });
      return;
    }

    if (acaoTipo === 'finalizar') {
      if (usarApiPendencias) {
        const item = listaPersistida[idx] || listaDraft[idx];
        const texto = String(item?.texto ?? '');
        setApiMutationBusy(true);
        setApiErrorTarefas('');
        setApiSuccessTarefas('');
        try {
          let apiId = item?.apiId;
          if (!apiId) {
            if (!texto.trim()) {
              setApiErrorTarefas('Preencha o texto da tarefa antes de finalizar.');
              return;
            }
            const criado = await criarTarefaOperacional(buildCriarTarefaBody(usuarioId, texto));
            apiId = criado?.id;
          }
          if (!apiId) {
            setApiErrorTarefas('Não foi possível identificar a tarefa.');
            return;
          }
          await patchStatusTarefaOperacional(apiId, { status: 'CONCLUIDA' });
          setApiSuccessTarefas('Tarefa concluída com sucesso.');
          fecharModalAcoesPendencia();
          refreshTarefasApi();
        } catch (e) {
          setApiErrorTarefas(e?.message || 'Falha ao finalizar a tarefa.');
        } finally {
          setApiMutationBusy(false);
        }
        return;
      }

      const next = { ...(pendenciasPorUsuario || {}) };
      const novaLista = (next[usuarioId] || []).map((x) => ({ ...(x || pendenciaVazia()) }));
      if (!novaLista[idx]) novaLista[idx] = pendenciaVazia();
      novaLista[idx].finalizadoEm = novaLista[idx].finalizadoEm || nowIso();
      next[usuarioId] = novaLista;
      setPendenciasPorUsuario(next);
      setPendenciasDraftPorUsuario((prev) => ({ ...(prev || {}), [usuarioId]: novaLista }));
      persistirPendencias(next);
      fecharModalAcoesPendencia();
      return;
    }

    if (acaoTipo === 'localizar') {
      const texto = String(pendenciasPorUsuario?.[usuarioId]?.[idx]?.texto ?? pendenciasDraftPorUsuario?.[usuarioId]?.[idx]?.texto ?? '');
      const ref = extrairReferenciaProcesso(texto);
      if (!ref) {
        setErroLocalizarPendencia('Não encontrei referência de processo no texto da pendência.');
        return;
      }
      navigate('/processos', { state: buildRouterStateChaveClienteProcesso(ref.codCliente ?? '', ref.proc ?? '') });
      fecharModalAcoesPendencia();
      return;
    }

    if (acaoTipo === 'consultar') {
      const item = pendenciasPorUsuario?.[usuarioId]?.[idx] || null;
      setModalConsultaPendencia(item ? { usuarioId, idx, ...item } : null);
      fecharModalAcoesPendencia();
      return;
    }
  }

  if (emPendencias) {
    return (
      <div className="flex-1 overflow-auto p-4">
        {featureFlags.useApiTarefas && (
          <div className="flex flex-wrap items-end gap-3 mb-3 text-sm">
            <label className="flex flex-col gap-0.5 min-w-[10rem]">
              <span className="text-slate-600">Responsável</span>
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-800 max-w-[14rem]"
                value={filtroApiResponsavel}
                onChange={(e) => setFiltroApiResponsavel(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="__sem__">Sem responsável</option>
                {columnsPendencias.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-0.5 min-w-[9rem]">
              <span className="text-slate-600">Status</span>
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-800"
                value={filtroApiStatus}
                onChange={(e) => setFiltroApiStatus(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="PENDENTE">Pendente</option>
                <option value="EM_ANDAMENTO">Em andamento</option>
                <option value="CONCLUIDA">Concluída</option>
                <option value="CANCELADA">Cancelada</option>
              </select>
            </label>
            <label className="flex flex-col gap-0.5 min-w-[9rem]">
              <span className="text-slate-600">Prioridade</span>
              <select
                className="rounded border border-slate-300 bg-white px-2 py-1.5 text-slate-800"
                value={filtroApiPrioridade}
                onChange={(e) => setFiltroApiPrioridade(e.target.value)}
              >
                <option value="">Todas</option>
                <option value="BAIXA">Baixa</option>
                <option value="NORMAL">Normal</option>
                <option value="ALTA">Alta</option>
                <option value="URGENTE">Urgente</option>
              </select>
            </label>
          </div>
        )}
        {featureFlags.useApiTarefas && (
          <div className="space-y-2 mb-3">
            {apiLoadingTarefas && (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                Carregando tarefas…
              </div>
            )}
            {apiMutationBusy && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Salvando…
              </div>
            )}
            {apiErrorTarefas && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900 flex justify-between gap-2 items-start">
                <span>{apiErrorTarefas}</span>
                <button
                  type="button"
                  className="shrink-0 text-red-800 underline hover:no-underline"
                  onClick={() => setApiErrorTarefas('')}
                >
                  Fechar
                </button>
              </div>
            )}
            {apiSuccessTarefas && (
              <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-900 flex justify-between gap-2 items-start">
                <span>{apiSuccessTarefas}</span>
                <button
                  type="button"
                  className="shrink-0 text-green-800 underline hover:no-underline"
                  onClick={() => setApiSuccessTarefas('')}
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        )}
        <div className="flex gap-4 overflow-x-auto pb-2 min-h-0">
          {columnsParaPendencias.map((col) => {
            const pendencias = pendenciasDraftPorUsuario[col.id] || [pendenciaVazia()];
            return (
              <div
                key={col.id}
                className="flex flex-col w-56 shrink-0 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
              >
                <div className="flex items-center justify-between px-3 py-2.5 bg-gray-100 border-b border-gray-200">
                  <span className="font-semibold text-gray-800 text-sm">{col.name}</span>
                  <div className="flex gap-0.5">
                    <button type="button" className="p-1 rounded hover:bg-gray-200 text-gray-600" aria-label="Anterior">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button type="button" className="p-1 rounded hover:bg-gray-200 text-gray-600" aria-label="Próximo">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2 p-2 flex-1 min-h-0 overflow-y-auto">
                  {pendencias.map((item, idx) => (
                    <textarea
                      key={`${col.id}-${item?.id ?? idx}`}
                      value={item?.texto ?? ''}
                      onChange={(e) => atualizarPendenciaDraft(col.id, idx, e.target.value)}
                      onBlur={() => {
                        if (modalAcoesPendencia || modalConsultaPendencia || erroLocalizarPendencia) return; // evita conflito com modais
                        abrirModalConfirmacao(col.id, idx);
                      }}
                      onDoubleClick={() => abrirModalAcoesPendencia(col.id, idx)}
                      placeholder="Nova tarefa..."
                      rows={3}
                      className="min-h-[72px] rounded-md border-2 p-3 text-sm bg-white border-gray-200 hover:border-gray-300 text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-400"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {modalPendencias && (
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/30 p-4"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="w-full max-w-2xl bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 bg-white">
                <div className="text-sm font-medium text-slate-800">Pergunta</div>
                <button
                  type="button"
                  className="p-1.5 rounded text-slate-500 hover:bg-slate-100"
                  aria-label="Fechar"
                  onClick={reverterAlteracaoModal}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="px-6 py-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center">
                      <HelpCircle className="w-8 h-8 text-white" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-lg font-medium text-slate-900">
                      Deseja alterar a grafia desta pendência???
                    </div>
                    <div className="mt-3 text-sm text-slate-900 leading-relaxed">
                      LEMBRE-SE! ESTE NÃO É O PROCEDIMENTO PARA 'FINALIZAR' A PENDÊNCIA:
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-4 bg-white">
                <button
                  type="button"
                  className="px-10 py-2 rounded border border-slate-300 bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  disabled={apiMutationBusy}
                  onClick={() => void confirmarAlteracaoModal()}
                >
                  Sim
                </button>
                <button
                  type="button"
                  className="px-10 py-2 rounded border border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                  onClick={reverterAlteracaoModal}
                >
                  Não
                </button>
              </div>
            </div>
          </div>
        )}

        {modalAcoesPendencia && (
          <div
            className="fixed inset-0 z-[90] flex items-start justify-center bg-black/20 p-4 pt-24"
            role="dialog"
            aria-modal="true"
          >
            <div
              className="w-full max-w-md bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
                <h2 className="text-lg font-medium text-slate-900">Ações</h2>
                <button type="button" className="p-1.5 rounded text-slate-500 hover:bg-slate-50" onClick={fecharModalAcoesPendencia} aria-label="Fechar">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="px-6 py-5">
                <div className="space-y-3">
                  {[
                    { tipo: 'finalizar', label: 'Finalizar Pendência' },
                    { tipo: 'localizar', label: 'Localizar Processo' },
                    { tipo: 'consultar', label: 'Consultar dados da Pendência' },
                  ].map((opt) => (
                    <label key={opt.tipo} className="flex items-center gap-3 cursor-pointer text-base text-slate-900">
                      <input
                        type="radio"
                        name="acoes-pendencia"
                        checked={modalAcoesPendencia.acaoSelecionada === opt.tipo}
                        onChange={() => setModalAcoesPendencia((prev) => ({ ...(prev || {}), acaoSelecionada: opt.tipo }))}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="px-6 pb-5 flex justify-center border-t border-slate-200 pt-4 bg-white">
                <button
                  type="button"
                  className="w-40 px-4 py-2 rounded border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                  disabled={apiMutationBusy}
                  onClick={() => void executarAcaoPendencia(modalAcoesPendencia.acaoSelecionada)}
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {modalConsultaPendencia && (
          <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" onClick={() => setModalConsultaPendencia(null)}>
            <div className="w-full max-w-lg bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
                <h2 className="text-base font-semibold text-slate-800">Dados da Pendência</h2>
                <button type="button" className="p-1.5 rounded text-slate-500 hover:bg-slate-50" onClick={() => setModalConsultaPendencia(null)} aria-label="Fechar">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 py-5 space-y-3">
                {modalConsultaPendencia.apiId != null && (
                  <div className="text-sm text-slate-700">
                    <span className="font-medium">ID (API):</span> {String(modalConsultaPendencia.apiId)}
                  </div>
                )}
                <div className="text-sm text-slate-700">
                  <span className="font-medium">Texto:</span> {modalConsultaPendencia.texto || ''}
                </div>
                {modalConsultaPendencia.status != null && modalConsultaPendencia.status !== '' && (
                  <div className="text-sm text-slate-700">
                    <span className="font-medium">Status:</span> {String(modalConsultaPendencia.status)}
                  </div>
                )}
                {modalConsultaPendencia.prioridade != null && modalConsultaPendencia.prioridade !== '' && (
                  <div className="text-sm text-slate-700">
                    <span className="font-medium">Prioridade:</span> {String(modalConsultaPendencia.prioridade)}
                  </div>
                )}
                {modalConsultaPendencia.dataLimite != null && modalConsultaPendencia.dataLimite !== '' && (
                  <div className="text-sm text-slate-700">
                    <span className="font-medium">Data limite:</span>{' '}
                    {typeof modalConsultaPendencia.dataLimite === 'string'
                      ? modalConsultaPendencia.dataLimite
                      : String(modalConsultaPendencia.dataLimite)}
                  </div>
                )}
                <div className="text-sm text-slate-700">
                  <span className="font-medium">Criada em:</span>{' '}
                  {modalConsultaPendencia.criadoEm ? new Date(modalConsultaPendencia.criadoEm).toLocaleString('pt-BR') : '—'}
                </div>
                <div className="text-sm text-slate-700">
                  <span className="font-medium">Finalizada em:</span>{' '}
                  {modalConsultaPendencia.finalizadoEm ? new Date(modalConsultaPendencia.finalizadoEm).toLocaleString('pt-BR') : '—'}
                </div>
              </div>
              <div className="px-6 py-4 border-t border-slate-200 flex justify-center bg-white">
                <button type="button" className="px-10 py-2 rounded border border-slate-300 bg-white text-slate-800 hover:bg-slate-50" onClick={() => setModalConsultaPendencia(null)}>
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {erroLocalizarPendencia && (
          <div className="fixed inset-0 z-[96] flex items-center justify-center bg-black/30 p-4" role="dialog" aria-modal="true" onClick={() => setErroLocalizarPendencia('')}>
            <div className="w-full max-w-md bg-white rounded-lg shadow-xl border border-slate-200 overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white">
                <h2 className="text-base font-semibold text-slate-800">Erro</h2>
                <button type="button" className="p-1.5 rounded text-slate-500 hover:bg-slate-50" onClick={() => setErroLocalizarPendencia('')} aria-label="Fechar">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="px-6 py-5 text-slate-800">{erroLocalizarPendencia}</div>
              <div className="px-6 pb-5 flex justify-center border-t border-slate-200 pt-3 bg-white">
                <button type="button" className="w-40 px-4 py-2 rounded border border-slate-300 bg-white text-slate-800 hover:bg-slate-50" onClick={() => setErroLocalizarPendencia('')}>
                  OK
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="flex gap-4 overflow-x-auto pb-2">
        {boardData.map((column) => (
          <Column
            key={column.id}
            column={column}
            selectedTaskId={selectedTaskId}
            onSelectTask={(task) => setSelectedTaskId(task?.id ?? null)}
          />
        ))}
      </div>
    </div>
  );
}

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { CalendarDays, CalendarX2, ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  agendaUsuarios,
  agendaDataEsquerda,
  agendaDataDireita,
  agendaEventosTerça,
  agendaEventosQuarta,
  agendaCalendarioMarco2026,
} from '../data/mockData';
import {
  getEventosAgendaPersistidosPorData,
  getUsuariosAtivos,
  setUsuariosAtivos,
  criarNovoCompromissoAgendaPersistido,
  normalizarStatusCurtoAgenda,
  ordenarListaEventosAgenda,
  criarUsuarioRegistroMinimo,
  listarTodosCompromissosAgendaMes,
} from '../data/agendaPersistenciaData';
import { buscarProcessoUnicoNaBasePorTextoAgenda } from '../data/processosHistoricoData';
import { resolverAliasHojeEmTexto } from '../services/hjDateAliasService.js';
import { getNomeExibicaoUsuario } from '../data/usuarioDisplayHelpers.js';
import { featureFlags } from '../config/featureFlags.js';
import { buildRouterStateChaveClienteProcesso } from '../domain/camposProcessoCliente.js';
import { extrairChaveProcessoEventoAgenda } from '../domain/agendaProcessoRef.js';
import { listarUsuarios } from '../repositories/usuariosRepository.js';
import { getApiUsuarioSessao } from '../data/usuarioPermissoesStorage.js';
import {
  listarEventosPorDataUsuario,
  listarAgendaMensal,
  salvarCamposEvento,
  criarEvento,
  excluirEvento,
} from '../repositories/agendaRepository.js';

/** Retorna string DD/MM/YYYY para dia/mês/ano */
function dataStr(dia, mes, ano) {
  return `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}/${ano}`;
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/** Linha com hora, descrição ou status OK — não confundir com a linha vazia «Novo compromisso». */
function temCompromissoNaLinhaAgenda(ev) {
  const h = String(ev?.hora ?? '').trim();
  const d = String(ev?.descricao ?? '').trim();
  const ok = normalizarStatusCurtoAgenda(ev?.statusCurto) === 'OK';
  return !!(h || d || ok);
}

/** Pode enviar exclusão à API (id numérico) ou remover do armazenamento local (id presente). */
function eventoAgendaPodeExcluir(ev, usarApiAgenda) {
  if (!ev || !temCompromissoNaLinhaAgenda(ev)) return false;
  if (usarApiAgenda) {
    const n = Number(ev.id);
    return Number.isFinite(n) && n >= 1;
  }
  return String(ev?.id ?? '').trim() !== '';
}

function parseDataBrCompleta(str) {
  const s = String(str ?? '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  const dd = Number(m[1]);
  const mm = Number(m[2]);
  const yyyy = Number(m[3]);
  if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
  if (mm < 1 || mm > 12) return null;
  const maxDia = new Date(yyyy, mm, 0).getDate();
  if (dd < 1 || dd > maxDia) return null;
  return { dd, mm, yyyy };
}

/** Ex.: "10/03/2026 (ter)" */
function rotuloDataComDiaSemana(dataBr) {
  const p = parseDataBrCompleta(dataBr);
  if (!p) return String(dataBr ?? '');
  const dt = new Date(p.yyyy, p.mm - 1, p.dd);
  const dias = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
  return `${dataBr} (${dias[dt.getDay()] ?? '—'})`;
}

/** Remove acentos e minúsculas para busca insensível a maiúsculas/acentos. */
function normalizarParaBuscaPalavraChave(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/**
 * "instrução" / "instrucao" → vermelho;
 * "conciliação" / "sessão de julgamento" (e variantes sem acento) → amarelo.
 * Se instrução e amarelo aparecerem, instrução tem prioridade.
 */
function temaPorTextoCompromisso(texto) {
  const n = normalizarParaBuscaPalavraChave(texto);
  if (n.includes('instrucao')) return 'instrucao';
  if (n.includes('conciliacao') || n.includes('sessao de julgamento')) return 'conciliacao';
  return null;
}

/** Classes para o bloco de descrição no modal (duplo clique). */
function classesTemaDescricaoModal(texto) {
  const t = temaPorTextoCompromisso(texto);
  if (t === 'instrucao') {
    return 'text-sm whitespace-pre-wrap rounded px-2 py-2 bg-red-600 text-white border border-red-700';
  }
  if (t === 'conciliacao') {
    return 'text-sm whitespace-pre-wrap rounded px-2 py-2 bg-yellow-300 text-black border border-yellow-600';
  }
  return 'text-sm text-slate-800 whitespace-pre-wrap';
}

/** Campo de texto clicável para editar (hora ou descrição). */
function EditableTextCell({
  texto,
  onSalvar,
  multiline = false,
  align = 'left',
  maxLen = 2000,
  temaPorPalavraChave = false,
  /** Duplo clique (2º clique): abre detalhe / processo — não entra em edição. */
  onDuploClique = null,
  /** Quando true, só exibe texto (sem edição). */
  readOnly = false,
}) {
  const original = String(texto ?? '');
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(original);
  const inputRef = useRef(null);
  const cancelouRef = useRef(false);

  useEffect(() => {
    if (!editando) setValor(original);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original]);

  useEffect(() => {
    if (!editando) return;
    const el = inputRef.current;
    if (!el) return;
    try {
      el.focus();
      if (!multiline) el.select?.();
    } catch {
      // ignore
    }
  }, [editando, multiline]);

  function salvarSeMudou() {
    const novo = String(valor ?? '').slice(0, maxLen);
    if (novo === original) {
      setEditando(false);
      return;
    }
    onSalvar?.(novo);
    setEditando(false);
  }

  const alignClass = align === 'right' ? 'text-right' : 'text-left';
  const inputAlign = align === 'right' ? 'text-right' : 'text-left';

  const textoParaTema = temaPorPalavraChave ? String(editando ? valor : original) : '';
  const tema = temaPorPalavraChave ? temaPorTextoCompromisso(textoParaTema) : null;
  const classesTemaInput =
    tema === 'instrucao'
      ? 'bg-red-600 text-white border-red-700 focus:ring-red-400 placeholder:text-red-200'
      : tema === 'conciliacao'
        ? 'bg-yellow-300 text-black border-yellow-600 focus:ring-yellow-600 placeholder:text-yellow-900/60'
        : 'bg-white text-gray-900 border-slate-200 focus:ring-indigo-400/50 focus:border-indigo-400';
  const classesTemaLeitura =
    tema === 'instrucao'
      ? 'bg-red-600 text-white border border-red-700 rounded px-1.5 py-1'
      : tema === 'conciliacao'
        ? 'bg-yellow-300 text-black border border-yellow-600 rounded px-1.5 py-1'
        : 'text-gray-800';

  if (readOnly) {
    return (
      <div className="min-w-0 w-full" onClick={(e) => e.stopPropagation()}>
        <div
          className={`${classesTemaLeitura} ${multiline ? 'text-sm whitespace-pre-wrap break-words' : 'text-sm truncate'} block w-full select-none ${alignClass} ${multiline ? 'min-h-[1.25rem]' : ''}`}
          style={multiline ? undefined : { minHeight: '18px' }}
          onDoubleClick={(e) => {
            e.stopPropagation();
            onDuploClique?.();
          }}
          title={original}
        >
          {original || '\u00A0'}
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-w-0 w-full"
      onClick={(e) => {
        e.stopPropagation();
      }}
    >
      {editando ? (
        multiline ? (
          <textarea
            ref={inputRef}
            value={valor}
            onChange={(e) => setValor(e.target.value.slice(0, maxLen))}
            onDoubleClick={(e) => e.stopPropagation()}
            onBlur={() => {
              if (cancelouRef.current) {
                cancelouRef.current = false;
                setEditando(false);
                return;
              }
              salvarSeMudou();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelouRef.current = true;
                setValor(original);
                setEditando(false);
              }
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                salvarSeMudou();
              }
            }}
            rows={3}
            className={`w-full px-1.5 py-1 text-base md:text-sm border rounded focus:outline-none focus:ring-1 resize-y min-h-[3rem] ${inputAlign} ${classesTemaInput}`}
          />
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={valor}
            onChange={(e) => setValor(e.target.value.slice(0, maxLen))}
            onDoubleClick={(e) => e.stopPropagation()}
            onBlur={() => {
              if (cancelouRef.current) {
                cancelouRef.current = false;
                setEditando(false);
                return;
              }
              salvarSeMudou();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                salvarSeMudou();
              }
              if (e.key === 'Escape') {
                e.preventDefault();
                cancelouRef.current = true;
                setValor(original);
                setEditando(false);
              }
            }}
            className={`w-full px-1.5 py-1 text-base md:text-sm border rounded focus:outline-none focus:ring-1 ${inputAlign} ${classesTemaInput}`}
            placeholder=""
            maxLength={maxLen}
          />
        )
      ) : (
        <div
          className={`${classesTemaLeitura} ${multiline ? 'text-sm whitespace-pre-wrap break-words' : 'text-sm truncate'} block w-full cursor-text select-none ${alignClass} ${multiline ? 'min-h-[1.25rem]' : ''}`}
          style={multiline ? undefined : { minHeight: '18px' }}
          onClick={(e) => {
            e.stopPropagation();
            if (onDuploClique && e.detail === 2) {
              e.preventDefault();
              setEditando(false);
              onDuploClique();
              return;
            }
            setEditando(true);
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          title={original}
        >
          {original || '\u00A0'}
        </div>
      )}
    </div>
  );
}

/** Status: apenas em branco ou "OK" (persistência normaliza outros valores). */
function StatusCurtoCell({ evento, onSalvar, readOnly = false }) {
  const valor = normalizarStatusCurtoAgenda(evento?.statusCurto);
  if (readOnly) {
    return (
      <div
        className="flex min-h-11 w-full max-w-[6rem] items-center justify-end pr-1 text-sm text-slate-700 md:w-[92px] md:min-h-0"
        onClick={(e) => e.stopPropagation()}
      >
        {valor === 'OK' ? 'OK' : '—'}
      </div>
    );
  }
  return (
    <div className="flex w-full max-w-[6rem] items-center justify-end pr-1 md:w-[92px]" onClick={(e) => e.stopPropagation()}>
      <select
        value={valor}
        onChange={(e) => onSalvar?.(e.target.value === 'OK' ? 'OK' : '')}
        onDoubleClick={(e) => e.stopPropagation()}
        title="Status: em branco ou OK"
        className="min-h-11 w-full min-w-0 max-w-[6rem] rounded-lg border border-slate-200 bg-white px-2 py-2 text-right text-base shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40 md:min-h-0 md:py-1 md:text-sm"
        aria-label="Status do compromisso"
      >
        <option value=""> </option>
        <option value="OK">OK</option>
      </select>
    </div>
  );
}

/** Mínimo de linhas no corpo do formulário (eventos + linha nova + linhas vazias de preenchimento). */
const MIN_LINHAS_FORMULARIO_AGENDA = 10;

/** Empty state quando a API da agenda respondeu sem eventos (evita tela “em branco” confundindo com erro). */
function AgendaPainelSemEventosApi({ nomeUsuario, dataFormatada }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center gap-3 rounded-xl border border-rose-900/30 bg-gradient-to-b from-rose-950 via-rose-900 to-rose-950 px-4 py-10 text-center shadow-inner ring-1 ring-rose-950/50"
    >
      <CalendarX2 className="h-12 w-12 shrink-0 text-rose-200/95" strokeWidth={1.75} aria-hidden />
      <p className="text-base font-semibold leading-snug text-rose-50">
        Sem eventos para <span className="text-white">{nomeUsuario}</span> em {dataFormatada}.
      </p>
      <p className="max-w-sm text-sm leading-relaxed text-rose-100/90">
        Troque o usuário ou a data para ver outros dias.
      </p>
    </div>
  );
}

function ColunaDia({
  dataLabel,
  eventos,
  onDuploCliqueEvento,
  dataBrStr,
  onSalvarCampos,
  usuarioAgendaId,
  onPersistenciaAlterada,
  somenteLeitura = false,
  mostrarColunaUsuario = false,
  resolverNomeUsuario = null,
  /** «esquerda» | «direita» — faixa de cor do cabeçalho da coluna */
  variantColuna = 'esquerda',
  /** Com API da agenda: exibe aviso amigável quando não há eventos para o usuário/data. */
  apiAgendaVazio = null,
  usarApiAgenda = false,
  onExcluirEvento = null,
}) {
  /** Última linha (novo compromisso): id criado até liberar após salvar hora/descrição. */
  const pendingNovaLinhaIdRef = useRef(null);
  const [novaLinhaBump, setNovaLinhaBump] = useState(0);

  useEffect(() => {
    pendingNovaLinhaIdRef.current = null;
    setNovaLinhaBump((n) => n + 1);
  }, [dataBrStr, usuarioAgendaId]);

  function solicitarExclusaoCompromisso(ev) {
    if (somenteLeitura || !onExcluirEvento || !eventoAgendaPodeExcluir(ev, usarApiAgenda)) return;
    const trecho = [String(ev.hora ?? '').trim(), String(ev.descricao ?? '').trim().slice(0, 200)]
      .filter(Boolean)
      .join(' — ');
    const msg = trecho
      ? `Eliminar este compromisso?\n\n${trecho}${trecho.length >= 200 ? '…' : ''}`
      : 'Eliminar este compromisso?';
    if (!window.confirm(msg)) return;
    onExcluirEvento(ev);
  }

  function salvarLinhaVazia(patch) {
    if (somenteLeitura) return;
    if (!dataBrStr) return;
    const uid = String(usuarioAgendaId ?? '');
    const pendingId = pendingNovaLinhaIdRef.current;
    if (pendingId) {
      onSalvarCampos?.({ id: pendingId, usuarioId: uid }, patch);
      const atualizaHoraOuDesc = patch.hora !== undefined || patch.descricao !== undefined;
      if (atualizaHoraOuDesc) {
        pendingNovaLinhaIdRef.current = null;
        setNovaLinhaBump((n) => n + 1);
      }
      return;
    }
    const r = criarNovoCompromissoAgendaPersistido({ dataBr: dataBrStr, usuarioId: uid, patch });
    if (r.ok && r.id) {
      pendingNovaLinhaIdRef.current = r.id;
      setNovaLinhaBump((n) => n + 1);
      onPersistenciaAlterada?.();
    }
  }

  const linhasBase = somenteLeitura ? eventos.length : eventos.length + 1;
  const linhasPreenchimento = Math.max(0, MIN_LINHAS_FORMULARIO_AGENDA - linhasBase);

  const headerGradient =
    variantColuna === 'direita'
      ? 'bg-gradient-to-r from-indigo-700 via-violet-700 to-purple-800'
      : 'bg-gradient-to-r from-sky-600 via-cyan-600 to-teal-600';

  return (
    <div className="flex w-full min-w-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-md ring-1 ring-slate-200/60 lg:min-h-0 lg:flex-1">
      <div
        className={`px-3 py-2.5 shrink-0 text-sm font-semibold text-white shadow-sm ring-1 ring-white/10 ${headerGradient}`}
      >
        {dataLabel}
      </div>
      <div className="overflow-x-hidden bg-gradient-to-b from-slate-50/40 to-white p-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
        {apiAgendaVazio ? (
          <div className="mb-3">
            <AgendaPainelSemEventosApi nomeUsuario={apiAgendaVazio.nomeUsuario} dataFormatada={apiAgendaVazio.dataFormatada} />
          </div>
        ) : null}
        <div className="space-y-3 pb-2 md:hidden">
          {eventos.map((ev) => (
            <div
              key={ev._chaveUnicaAgenda ?? ev.id}
              className={`relative rounded-xl border border-slate-200/90 bg-white p-3 pt-9 shadow-sm ring-1 ring-slate-100/80 ${
                ev.destaque ? 'bg-amber-50/90' : ''
              }`}
              onDoubleClick={() => onDuploCliqueEvento?.(ev)}
            >
              {!somenteLeitura && onExcluirEvento && eventoAgendaPodeExcluir(ev, usarApiAgenda) ? (
                <button
                  type="button"
                  className="absolute right-2 top-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-rose-200/90 bg-white text-rose-600 shadow-sm hover:bg-rose-50 hover:border-rose-300"
                  aria-label="Eliminar compromisso"
                  title="Eliminar compromisso"
                  onClick={(e) => {
                    e.stopPropagation();
                    solicitarExclusaoCompromisso(ev);
                  }}
                >
                  <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                </button>
              ) : null}
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 shrink-0 basis-[5.5rem]">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Hora</span>
                    <EditableTextCell
                      texto={ev.hora ?? ''}
                      align="left"
                      maxLen={12}
                      readOnly={somenteLeitura}
                      onDuploClique={() => onDuploCliqueEvento?.(ev)}
                      onSalvar={(novo) => {
                        if (!dataBrStr) return;
                        onSalvarCampos?.(ev, { hora: novo });
                      }}
                    />
                  </div>
                  {mostrarColunaUsuario ? (
                    <div className="min-w-0 flex-1">
                      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Quem</span>
                      <p className="text-sm text-slate-700" title={resolverNomeUsuario?.(ev) ?? ''}>
                        {resolverNomeUsuario?.(ev) ?? '—'}
                      </p>
                    </div>
                  ) : null}
                  <div className="ml-auto min-w-0 shrink-0">
                    <span className="mb-1 block text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Status</span>
                    <div className="flex justify-end">
                      <StatusCurtoCell
                        evento={ev}
                        readOnly={somenteLeitura}
                        onSalvar={(novo) => {
                          if (!dataBrStr) return;
                          onSalvarCampos?.(ev, { statusCurto: novo });
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Descrição</span>
                  <EditableTextCell
                    texto={ev.descricao ?? ''}
                    multiline
                    align="left"
                    maxLen={2000}
                    temaPorPalavraChave
                    readOnly={somenteLeitura}
                    onDuploClique={() => onDuploCliqueEvento?.(ev)}
                    onSalvar={(novo) => {
                      if (!dataBrStr) return;
                      onSalvarCampos?.(ev, { descricao: novo });
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
          {!somenteLeitura ? (
            <div
              id={`agenda-novo-foco-${dataBrStr}-${usuarioAgendaId}`}
              className="rounded-xl border border-emerald-300/80 bg-gradient-to-br from-emerald-50/90 to-teal-50/50 p-3 shadow-sm ring-1 ring-emerald-200/60"
            >
              <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-900">Novo compromisso</p>
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 shrink-0 basis-[5.5rem]">
                    <span className="mb-1 block text-xs font-semibold text-slate-600">Hora</span>
                    <EditableTextCell texto="" align="left" maxLen={12} onSalvar={(novo) => salvarLinhaVazia({ hora: novo })} />
                  </div>
                  <div className="ml-auto min-w-0 shrink-0">
                    <span className="mb-1 block text-right text-xs font-semibold text-slate-600">Status</span>
                    <div className="flex justify-end">
                      <StatusCurtoCell evento={{ statusCurto: '' }} onSalvar={(novo) => salvarLinhaVazia({ statusCurto: novo })} />
                    </div>
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="mb-1 block text-xs font-semibold text-slate-600">Descrição</span>
                  <EditableTextCell
                    texto=""
                    multiline
                    align="left"
                    maxLen={2000}
                    temaPorPalavraChave
                    onSalvar={(novo) => salvarLinhaVazia({ descricao: novo })}
                  />
                </div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="hidden md:block">
          <table className="w-full table-fixed border-collapse">
            <thead>
              <tr className="bg-gradient-to-r from-slate-800 via-indigo-900 to-violet-900 text-white [&_th]:border-b [&_th]:border-white/10">
                <th className="w-[96px] px-2 py-2 text-left text-xs font-semibold">Hora</th>
                {mostrarColunaUsuario ? (
                  <th className="w-[100px] px-2 py-2 text-left text-xs font-semibold">Quem</th>
                ) : null}
                <th className="px-2 py-2 text-left text-xs font-semibold">Descrição</th>
                <th className="w-[92px] px-1 py-2 text-right text-xs font-semibold">Status</th>
                {!somenteLeitura && onExcluirEvento ? (
                  <th className="w-10 px-0 py-2 text-center text-xs font-semibold">
                    <span className="sr-only">Eliminar</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {eventos.map((ev) => (
                <tr
                  key={ev._chaveUnicaAgenda ?? ev.id}
                  className={`min-h-[42px] overflow-hidden border-b border-slate-100 transition-colors hover:bg-indigo-50/40 ${
                    ev.destaque ? 'bg-amber-100/90' : ''
                  }`}
                  onDoubleClick={() => onDuploCliqueEvento?.(ev)}
                >
                  <td className="w-[96px] px-2 py-1.5 align-top text-sm">
                    <EditableTextCell
                      texto={ev.hora ?? ''}
                      align="left"
                      maxLen={12}
                      readOnly={somenteLeitura}
                      onDuploClique={() => onDuploCliqueEvento?.(ev)}
                      onSalvar={(novo) => {
                        if (!dataBrStr) return;
                        onSalvarCampos?.(ev, { hora: novo });
                      }}
                    />
                  </td>
                  {mostrarColunaUsuario ? (
                    <td className="w-[100px] px-2 py-1.5 align-top text-xs text-gray-600 truncate" title={resolverNomeUsuario?.(ev) ?? ''}>
                      {resolverNomeUsuario?.(ev) ?? '—'}
                    </td>
                  ) : null}
                  <td className="min-w-0 px-2 py-1.5 align-top text-sm">
                    <EditableTextCell
                      texto={ev.descricao ?? ''}
                      multiline
                      align="left"
                      maxLen={2000}
                      temaPorPalavraChave
                      readOnly={somenteLeitura}
                      onDuploClique={() => onDuploCliqueEvento?.(ev)}
                      onSalvar={(novo) => {
                        if (!dataBrStr) return;
                        onSalvarCampos?.(ev, { descricao: novo });
                      }}
                    />
                  </td>
                  <td className="w-[92px] px-0 py-1.5 align-top text-right">
                    <StatusCurtoCell
                      evento={ev}
                      readOnly={somenteLeitura}
                      onSalvar={(novo) => {
                        if (!dataBrStr) return;
                        onSalvarCampos?.(ev, { statusCurto: novo });
                      }}
                    />
                  </td>
                  {!somenteLeitura && onExcluirEvento ? (
                    <td className="w-10 px-0 py-1 align-top text-center">
                      {eventoAgendaPodeExcluir(ev, usarApiAgenda) ? (
                        <button
                          type="button"
                          className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200/90 bg-white text-rose-600 hover:bg-rose-50"
                          aria-label="Eliminar compromisso"
                          title="Eliminar compromisso"
                          onClick={(e) => {
                            e.stopPropagation();
                            solicitarExclusaoCompromisso(ev);
                          }}
                        >
                          <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                        </button>
                      ) : (
                        <span className="inline-block w-8" aria-hidden />
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
              {Array.from({ length: linhasPreenchimento }, (_, i) => (
                <tr
                  key={`agenda-linha-vazia-${dataBrStr}-${usuarioAgendaId}-${i}`}
                  className="min-h-[42px] overflow-hidden border-b border-slate-100"
                  aria-hidden
                >
                  <td className="w-[96px] px-2 py-1.5 align-top text-sm text-slate-200 select-none">&nbsp;</td>
                  {mostrarColunaUsuario ? (
                    <td className="w-[100px] px-2 py-1.5 align-top text-sm text-slate-200 select-none">&nbsp;</td>
                  ) : null}
                  <td className="min-w-0 px-2 py-1.5 align-top text-sm text-slate-200 select-none">&nbsp;</td>
                  <td className="w-[92px] px-0 py-1.5 align-top text-right">&nbsp;</td>
                  {!somenteLeitura && onExcluirEvento ? <td className="w-10 px-0 py-1.5 align-top" aria-hidden /> : null}
                </tr>
              ))}
              {!somenteLeitura ? (
                <tr
                  key={`linha-nova-${novaLinhaBump}`}
                  className="min-h-[42px] overflow-hidden border-b border-emerald-100 bg-gradient-to-r from-emerald-50/60 to-teal-50/40"
                >
                  <td className="w-[96px] px-2 py-1.5 align-top text-sm">
                    <EditableTextCell texto="" align="left" maxLen={12} onSalvar={(novo) => salvarLinhaVazia({ hora: novo })} />
                  </td>
                  {mostrarColunaUsuario ? <td className="w-[100px] px-2 py-1.5 align-top text-sm" /> : null}
                  <td className="min-w-0 px-2 py-1.5 align-top text-sm">
                    <EditableTextCell
                      texto=""
                      multiline
                      align="left"
                      maxLen={2000}
                      temaPorPalavraChave
                      onSalvar={(novo) => salvarLinhaVazia({ descricao: novo })}
                    />
                  </td>
                  <td className="w-[92px] px-0 py-1.5 align-top text-right">
                    <StatusCurtoCell evento={{ statusCurto: '' }} onSalvar={(novo) => salvarLinhaVazia({ statusCurto: novo })} />
                  </td>
                  {onExcluirEvento ? <td className="w-10 px-0 py-1.5 align-top" aria-hidden /> : null}
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PainelCalendario({
  mesAtual,
  anoAtual,
  setMesAtual,
  setAnoAtual,
  diaSelecionado,
  setDiaSelecionado,
  usuarioSelecionado,
  setUsuarioSelecionado,
  nomeGrupo = 'painel',
  usuariosSistema,
  onAbrirUsuariosSistema,
  /** Classes extra no container do painel (ex.: `hidden lg:flex` no painel espelho em mobile). */
  panelClassName = '',
}) {
  const n = new Date();
  const hojeReal = { dd: n.getDate(), mm: n.getMonth() + 1, yyyy: n.getFullYear() };
  const maxDiaNoMes = new Date(anoAtual, mesAtual, 0).getDate();
  const dias = Array.from({ length: maxDiaNoMes }, (_, i) => i + 1);
  const primeiroDiaSemana = new Date(anoAtual, mesAtual - 1, 1).getDay();
  const nomeMesAtual = MESES[mesAtual - 1] ?? '';
  const dataSelecionadaStr = dataStr(diaSelecionado, mesAtual, anoAtual);

  const [textoDataCompleta, setTextoDataCompleta] = useState(dataSelecionadaStr);

  useEffect(() => {
    setTextoDataCompleta(dataSelecionadaStr);
  }, [dataSelecionadaStr]);

  useEffect(() => {
    const max = new Date(anoAtual, mesAtual, 0).getDate();
    if (diaSelecionado > max) setDiaSelecionado(max);
  }, [mesAtual, anoAtual, diaSelecionado, setDiaSelecionado]);

  function parseDataCompleta(str) {
    const s = String(str ?? '').trim();
    const resolved = resolverAliasHojeEmTexto(str, 'br');
    const toParse = resolved ?? s;
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(toParse);
    if (!m) return null;
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null;
    if (mm < 1 || mm > 12) return null;
    const maxDia = new Date(yyyy, mm, 0).getDate();
    if (dd < 1 || dd > maxDia) return null;
    return { dd, mm, yyyy };
  }

  function formatDataCompleta({ dd, mm, yyyy }) {
    return `${String(dd).padStart(2, '0')}/${String(mm).padStart(2, '0')}/${yyyy}`;
  }

  function aplicarTextoData() {
    const parsed = parseDataCompleta(textoDataCompleta);
    if (!parsed) {
      // Mantém o valor sincronizado com o que já está sendo exibido.
      setTextoDataCompleta(dataSelecionadaStr);
      return;
    }
    const normalizada = formatDataCompleta(parsed);
    setTextoDataCompleta(normalizada);
    setAnoAtual(parsed.yyyy);
    setMesAtual(parsed.mm);
    setDiaSelecionado(parsed.dd);
  }

  function irParaDataDeHoje() {
    const agora = new Date();
    setAnoAtual(agora.getFullYear());
    setMesAtual(agora.getMonth() + 1);
    setDiaSelecionado(agora.getDate());
  }

  return (
    <aside
      className={`flex shrink-0 flex-col gap-3 overflow-y-auto rounded-2xl border border-violet-200/70 bg-gradient-to-b from-violet-50/90 via-white to-indigo-50/50 p-3 shadow-md ring-1 ring-violet-500/10 w-full lg:w-56 ${panelClassName}`.trim()}
    >
      <div className="border border-violet-200/60 rounded-xl overflow-hidden bg-white shadow-sm ring-1 ring-violet-100/80">
        <div className="px-2 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-center">
          <span className="text-xs font-bold uppercase tracking-wide text-white/95">Mês</span>
        </div>
        <div className="p-2.5">
        <div className="flex items-center justify-between mb-2">
          <button
            type="button"
            onClick={() => {
              if (mesAtual <= 1) { setMesAtual(12); setAnoAtual((a) => a - 1); }
              else setMesAtual((m) => m - 1);
            }}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 p-1.5 text-violet-800 transition-colors hover:bg-violet-100 md:min-h-0 md:min-w-0"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          <span className="text-sm font-semibold capitalize text-slate-800">
            {nomeMesAtual} {anoAtual}
          </span>
          <button
            type="button"
            onClick={() => {
              if (mesAtual >= 12) { setMesAtual(1); setAnoAtual((a) => a + 1); }
              else setMesAtual((m) => m + 1);
            }}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-violet-200 bg-violet-50 p-1.5 text-violet-800 transition-colors hover:bg-violet-100 md:min-h-0 md:min-w-0"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-0.5 text-xs">
          {agendaCalendarioMarco2026.diasSemana.map((d) => (
            <div key={d} className="text-center font-semibold text-violet-700/80 py-0.5">
              {d}
            </div>
          ))}
          {Array.from({ length: primeiroDiaSemana }).map((_, i) => (
            <div key={`v-${i}`} />
          ))}
          {dias.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDiaSelecionado(d)}
              className={`min-h-9 rounded-md py-1 text-xs font-medium transition-colors md:min-h-0 ${
                d === diaSelecionado
                  ? 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-md ring-1 ring-indigo-400/50'
                  : mesAtual === hojeReal.mm && anoAtual === hojeReal.yyyy && d === hojeReal.dd
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'hover:bg-violet-100 text-slate-800'
              }`}
            >
              {String(d).padStart(2, '0')}
            </button>
          ))}
        </div>
        <p
          className="text-[11px] text-indigo-600 mt-2 cursor-pointer select-none font-medium hover:text-indigo-800 hover:underline"
          title="Duplo clique para ir à data de hoje no calendário"
          onDoubleClick={(e) => {
            e.preventDefault();
            irParaDataDeHoje();
          }}
        >
          Hoje: {dataStr(hojeReal.dd, hojeReal.mm, hojeReal.yyyy)}
        </p>
        </div>
      </div>

      <div className="border border-cyan-200/70 rounded-xl overflow-hidden bg-white shadow-sm ring-1 ring-cyan-100/60">
        <div className="px-2.5 py-1.5 bg-gradient-to-r from-cyan-600 to-teal-600">
          <div className="text-xs font-bold uppercase tracking-wide text-white">Data completa</div>
        </div>
        <div className="p-2.5">
        <input
          type="text"
          inputMode="numeric"
          value={textoDataCompleta}
          onChange={(e) => {
            const v = e.target.value;
            setTextoDataCompleta(resolverAliasHojeEmTexto(v, 'br') ?? v);
          }}
          onBlur={aplicarTextoData}
          onKeyDown={(e) => {
            if (e.key === 'Enter') aplicarTextoData();
          }}
          placeholder="dd/mm/aaaa ou hj"
          className="w-full min-h-11 rounded-lg border border-slate-200 px-3 py-2 text-base shadow-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-400/40 md:min-h-0 md:text-sm"
        />
        </div>
      </div>

      <div className="rounded-xl border border-indigo-200/70 bg-white/90 p-2.5 shadow-sm ring-1 ring-indigo-100/60">
        <div className="text-sm font-semibold text-indigo-950 mb-0.5">Usuário</div>
        <p className="text-[11px] text-slate-600 mb-2 leading-snug">
          Agenda por pessoa — mesmos cadastros ativos da tela <strong className="font-medium text-indigo-800">Usuários</strong>.
        </p>
        <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
          {usuariosSistema.map((u) => (
            <label key={u.id} className="flex items-center gap-2 text-sm cursor-pointer text-slate-800 hover:text-indigo-900">
              <input
                type="radio"
                name={`usuario-${nomeGrupo}`}
                value={u.id}
                checked={usuarioSelecionado === u.id}
                onChange={() => setUsuarioSelecionado(u.id)}
                className="text-indigo-600 accent-indigo-600"
              />
              {getNomeExibicaoUsuario(u)}
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 mt-auto pt-1">
        <button
          type="button"
          onClick={() => onAbrirUsuariosSistema?.()}
          className="min-h-11 rounded-lg border border-indigo-300 bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-md transition-colors hover:from-indigo-700 hover:to-violet-700"
          title="Cadastro de pessoas da agenda (mesma lista da tela Usuários)"
        >
          Usuários
        </button>
      </div>
    </aside>
  );
}

function initialCalendarioAgendaDuasColunas() {
  const esq = new Date();
  const dir = new Date(esq);
  dir.setDate(dir.getDate() + 1);
  return {
    diaE: esq.getDate(),
    mesE: esq.getMonth() + 1,
    anoE: esq.getFullYear(),
    diaD: dir.getDate(),
    mesD: dir.getMonth() + 1,
    anoD: dir.getFullYear(),
  };
}

const __calInicialAgenda = initialCalendarioAgendaDuasColunas();

/** Com agenda na API, o id tem de ser numérico (sessão JWT); evita primeiro render vazio com legado "itamar". */
function initialUsuarioIdAgenda() {
  if (typeof window === 'undefined') return 'itamar';
  if (!featureFlags.useApiAgenda) return 'itamar';
  const api = getApiUsuarioSessao();
  return api?.id ? String(api.id) : 'itamar';
}

/**
 * @param {{ focoDataBr?: string|null, focoRevision?: number, modoFlutuante?: boolean }} [props]
 * `focoDataBr` — dd/mm/aaaa (ex.: modal em Processos); tem prioridade sobre `location.state.agendaData`.
 */
export function Agenda({ focoDataBr = null, focoRevision = 0, modoFlutuante = false } = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const [usuarioEsquerda, setUsuarioEsquerda] = useState(initialUsuarioIdAgenda);
  const [usuarioDireita, setUsuarioDireita] = useState(initialUsuarioIdAgenda);
  const [mesEsquerda, setMesEsquerda] = useState(__calInicialAgenda.mesE);
  const [anoEsquerda, setAnoEsquerda] = useState(__calInicialAgenda.anoE);
  const [diaEsquerda, setDiaEsquerda] = useState(__calInicialAgenda.diaE);
  const [mesDireita, setMesDireita] = useState(__calInicialAgenda.mesD);
  const [anoDireita, setAnoDireita] = useState(__calInicialAgenda.anoD);
  const [diaDireita, setDiaDireita] = useState(__calInicialAgenda.diaD);
  const [eventoModal, setEventoModal] = useState(null);
  const [modalAgendaMensal, setModalAgendaMensal] = useState(false);
  const [agendaStatusNonce, setAgendaStatusNonce] = useState(0);
  const [usuariosAtivos, setUsuariosAtivosState] = useState(() => getUsuariosAtivos());
  const [eventosApiEsquerda, setEventosApiEsquerda] = useState([]);
  const [eventosApiDireita, setEventosApiDireita] = useState([]);
  /** Evita flash de empty state antes do 1.º GET da API concluir. */
  const [apiAgendaEsquerdaHydrated, setApiAgendaEsquerdaHydrated] = useState(false);
  const [apiAgendaDireitaHydrated, setApiAgendaDireitaHydrated] = useState(false);
  const [relatorioAgendaMensal, setRelatorioAgendaMensal] = useState(() =>
    featureFlags.useApiAgenda
      ? { ano: 0, mes: 0, usuarioId: '', todosUsuarios: false, diasComEventos: [] }
      : listarTodosCompromissosAgendaMes({
          ano: anoEsquerda,
          mes: mesEsquerda,
          usuarioId: usuarioEsquerda,
        })
  );

  const resolverNomeUsuarioAgenda = useCallback(
    (ev) => {
      if (ev?.usuarioNome && String(ev.usuarioNome).trim()) return String(ev.usuarioNome).trim();
      const u = (usuariosAtivos || []).find((x) => String(x.id) === String(ev?.usuarioId));
      return u ? getNomeExibicaoUsuario(u) : String(ev?.usuarioId ?? '').trim() || '—';
    },
    [usuariosAtivos]
  );

  /** Lista de pessoas = mesma da tela Usuários (localStorage); sincroniza ao salvar ou ao voltar à Agenda. */
  useEffect(() => {
    if (featureFlags.useApiUsuarios) {
      let cancelado = false;
      (async () => {
        try {
          const lista = await listarUsuarios();
          if (!cancelado) {
            const ativos = (lista || []).filter((u) => u.ativo !== false);
            setUsuariosAtivosState(ativos);
            if (ativos[0]?.id && !usuarioEsquerda) setUsuarioEsquerda(String(ativos[0].id));
            if (ativos[0]?.id && !usuarioDireita) setUsuarioDireita(String(ativos[0].id));
          }
        } catch {
          /* fallback local */
        }
      })();
      return () => {
        cancelado = true;
      };
    }
    const sync = () => setUsuariosAtivosState(getUsuariosAtivos());
    const bumpAgenda = () => setAgendaStatusNonce((n) => n + 1);
    sync();
    window.addEventListener('vilareal:usuarios-agenda-atualizados', sync);
    window.addEventListener('vilareal:agenda-persistencia-atualizada', bumpAgenda);
    return () => {
      window.removeEventListener('vilareal:usuarios-agenda-atualizados', sync);
      window.removeEventListener('vilareal:agenda-persistencia-atualizada', bumpAgenda);
    };
  }, []);

  useEffect(() => {
    if (location.pathname === '/agenda') {
      setUsuariosAtivosState(getUsuariosAtivos());
    }
  }, [location.pathname]);

  useEffect(() => {
    // Caso o usuário exclua o utilizador selecionado, ou ID legado "itamar" com API (precisa do id numérico).
    const ids = new Set((usuariosAtivos || []).map((u) => String(u.id)));
    function pickUsuarioAgendaValido() {
      if (!Array.isArray(usuariosAtivos) || usuariosAtivos.length === 0) return 'itamar';
      const api = getApiUsuarioSessao();
      if (api?.id && ids.has(String(api.id))) return String(api.id);
      const itamarU = usuariosAtivos.find((u) => String(u.login ?? '').toLowerCase() === 'itamar');
      if (itamarU) return String(itamarU.id);
      return String(usuariosAtivos[0].id);
    }
    const fallbackId = pickUsuarioAgendaValido();

    if (!ids.has(String(usuarioEsquerda))) setUsuarioEsquerda(fallbackId);
    if (!ids.has(String(usuarioDireita))) setUsuarioDireita(fallbackId);
  }, [usuariosAtivos, usuarioEsquerda, usuarioDireita]);

  function persistirUsuariosAtivos(next) {
    const r = setUsuariosAtivos(next);
    if (!r.ok) {
      window.alert(r.error || 'Não foi possível salvar a lista de usuários.');
      return false;
    }
    setUsuariosAtivosState(getUsuariosAtivos());
    return true;
  }

  /** Duplo clique: prioriza vínculo explícito (processoRef / cliente×proc); senão tenta CNJ no texto. */
  function aoDuploCliqueCompromisso(ev) {
    const chave = extrairChaveProcessoEventoAgenda(ev);
    if (chave) {
      navigate('/processos', { state: buildRouterStateChaveClienteProcesso(chave.codCliente, chave.proc) });
      return;
    }
    const texto = `${ev.descricao ?? ''}\n${ev.titulo ?? ''}\n${ev.hora ?? ''}`;
    const found = buscarProcessoUnicoNaBasePorTextoAgenda(texto);
    if (found) {
      navigate('/processos', { state: buildRouterStateChaveClienteProcesso(found.codCliente, found.proc) });
      return;
    }
    setEventoModal(ev);
  }

  useEffect(() => {
    // Mantém o 1o usuário base ativo (no print ele aparece sem botões).
    const basePrimeiro = Array.isArray(agendaUsuarios) && agendaUsuarios[0] ? agendaUsuarios[0] : null;
    if (!basePrimeiro) return;
    const ids = new Set((usuariosAtivos || []).map((u) => u.id));
    if (ids.has(basePrimeiro.id)) return;
    persistirUsuariosAtivos([...(usuariosAtivos || []), criarUsuarioRegistroMinimo(basePrimeiro)]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const agendaDataDoRouter =
    location.state && typeof location.state === 'object' ? location.state.agendaData : null;
  const dataBrParaPainel =
    focoDataBr != null && String(focoDataBr).trim() !== ''
      ? String(focoDataBr).trim()
      : agendaDataDoRouter;

  // Data via props (modal Processos) ou navegação (Processos → /agenda com state).
  useEffect(() => {
    if (!dataBrParaPainel) return;
    const parsed = parseDataBrCompleta(dataBrParaPainel);
    if (!parsed) return;

    setDiaEsquerda(parsed.dd);
    setMesEsquerda(parsed.mm);
    setAnoEsquerda(parsed.yyyy);

    const dt = new Date(parsed.yyyy, parsed.mm - 1, parsed.dd);
    dt.setDate(dt.getDate() + 1);
    setDiaDireita(dt.getDate());
    setMesDireita(dt.getMonth() + 1);
    setAnoDireita(dt.getFullYear());
  }, [dataBrParaPainel, focoRevision, location.key, location.state]);

  const dataEsquerdaStr = dataStr(diaEsquerda, mesEsquerda, anoEsquerda);
  const dataDireitaStr = dataStr(diaDireita, mesDireita, anoDireita);

  // Recalcula ao mudar `agendaStatusNonce` (salvando statusCurto no localStorage).
  const eventosPersistidosEsquerda = getEventosAgendaPersistidosPorData(dataEsquerdaStr);
  const eventosPersistidosDireita = getEventosAgendaPersistidosPorData(dataDireitaStr);

  useEffect(() => {
    if (!featureFlags.useApiAgenda) return;
    let cancelado = false;
    (async () => {
      console.debug('[Agenda] GET eventos', { lado: 'esquerda', data: dataEsquerdaStr, usuarioId: usuarioEsquerda });
      try {
        const data = await listarEventosPorDataUsuario(dataEsquerdaStr, usuarioEsquerda);
        const arr = Array.isArray(data) ? data : [];
        console.debug('[Agenda] <- eventos', { lado: 'esquerda', count: arr.length });
        if (!cancelado) {
          setEventosApiEsquerda(arr);
          setApiAgendaEsquerdaHydrated(true);
        }
      } catch {
        console.debug('[Agenda] <- eventos', { lado: 'esquerda', count: 0 });
        if (!cancelado) {
          setEventosApiEsquerda([]);
          setApiAgendaEsquerdaHydrated(true);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [dataEsquerdaStr, usuarioEsquerda, agendaStatusNonce]);

  useEffect(() => {
    if (!featureFlags.useApiAgenda) return;
    let cancelado = false;
    (async () => {
      console.debug('[Agenda] GET eventos', { lado: 'direita', data: dataDireitaStr, usuarioId: usuarioDireita });
      try {
        const data = await listarEventosPorDataUsuario(dataDireitaStr, usuarioDireita);
        const arr = Array.isArray(data) ? data : [];
        console.debug('[Agenda] <- eventos', { lado: 'direita', count: arr.length });
        if (!cancelado) {
          setEventosApiDireita(arr);
          setApiAgendaDireitaHydrated(true);
        }
      } catch {
        console.debug('[Agenda] <- eventos', { lado: 'direita', count: 0 });
        if (!cancelado) {
          setEventosApiDireita([]);
          setApiAgendaDireitaHydrated(true);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [dataDireitaStr, usuarioDireita, agendaStatusNonce]);

  const eventosEsquerda = useMemo(
    () => {
      const base = dataEsquerdaStr === agendaDataEsquerda ? agendaEventosTerça : [];
      const persistedBase = featureFlags.useApiAgenda ? eventosApiEsquerda : eventosPersistidosEsquerda;
      const persisted = (Array.isArray(persistedBase) ? persistedBase : []).filter((ev) => {
        if (!ev) return false;
        if (ev.usuarioId == null || String(ev.usuarioId) === '') return true;
        return String(ev.usuarioId) === String(usuarioEsquerda);
      });

      const merged = new Map();
      for (const ev of base) merged.set(String(ev.id), { ...ev, statusCurto: normalizarStatusCurtoAgenda(ev.statusCurto) });
      for (const ev of persisted) {
        const key = String(ev.id);
        const prev = merged.get(key) || {};
        merged.set(key, {
          ...prev,
          ...ev,
          _chaveUnicaAgenda: key,
          statusCurto: normalizarStatusCurtoAgenda(ev.statusCurto ?? prev.statusCurto ?? ''),
        });
      }
      return ordenarListaEventosAgenda(Array.from(merged.values()));
    },
    [dataEsquerdaStr, eventosPersistidosEsquerda, eventosApiEsquerda, usuarioEsquerda, agendaStatusNonce]
  );
  const eventosDireita = useMemo(
    () => {
      const base = dataDireitaStr === agendaDataDireita ? agendaEventosQuarta : [];
      const persistedBase = featureFlags.useApiAgenda ? eventosApiDireita : eventosPersistidosDireita;
      const persisted = (Array.isArray(persistedBase) ? persistedBase : []).filter((ev) => {
        if (!ev) return false;
        if (ev.usuarioId == null || String(ev.usuarioId) === '') return true;
        return String(ev.usuarioId) === String(usuarioDireita);
      });

      const merged = new Map();
      for (const ev of base) merged.set(String(ev.id), { ...ev, statusCurto: normalizarStatusCurtoAgenda(ev.statusCurto) });
      for (const ev of persisted) {
        const key = String(ev.id);
        const prev = merged.get(key) || {};
        merged.set(key, {
          ...prev,
          ...ev,
          _chaveUnicaAgenda: key,
          statusCurto: normalizarStatusCurtoAgenda(ev.statusCurto ?? prev.statusCurto ?? ''),
        });
      }
      return ordenarListaEventosAgenda(Array.from(merged.values()));
    },
    [dataDireitaStr, eventosPersistidosDireita, eventosApiDireita, usuarioDireita, agendaStatusNonce]
  );

  useEffect(() => {
    if (!featureFlags.useApiAgenda) {
      setRelatorioAgendaMensal(
        listarTodosCompromissosAgendaMes({
          ano: anoEsquerda,
          mes: mesEsquerda,
          usuarioId: usuarioEsquerda,
        })
      );
      return;
    }
    let cancelado = false;
    (async () => {
      try {
        const r = await listarAgendaMensal(anoEsquerda, mesEsquerda, usuarioEsquerda);
        if (!cancelado && r) {
          setRelatorioAgendaMensal(r);
        }
      } catch {
        if (!cancelado) {
          setRelatorioAgendaMensal({
            ano: anoEsquerda,
            mes: mesEsquerda,
            usuarioId: usuarioEsquerda,
            todosUsuarios: false,
            diasComEventos: [],
          });
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [anoEsquerda, mesEsquerda, usuarioEsquerda, agendaStatusNonce]);

  const nomeUsuarioAgenda = useMemo(() => {
    const u = (usuariosAtivos || []).find((x) => String(x.id) === String(usuarioEsquerda));
    return u ? getNomeExibicaoUsuario(u) : usuarioEsquerda ?? '—';
  }, [usuariosAtivos, usuarioEsquerda]);

  const nomeUsuarioAgendaDireita = useMemo(() => {
    const u = (usuariosAtivos || []).find((x) => String(x.id) === String(usuarioDireita));
    return u ? getNomeExibicaoUsuario(u) : usuarioDireita ?? '—';
  }, [usuariosAtivos, usuarioDireita]);

  const apiAgendaVazioEsquerda = useMemo(() => {
    if (!featureFlags.useApiAgenda || !apiAgendaEsquerdaHydrated) return null;
    if (eventosApiEsquerda.length !== 0 || eventosEsquerda.length !== 0) return null;
    return {
      nomeUsuario: nomeUsuarioAgenda,
      dataFormatada: rotuloDataComDiaSemana(dataEsquerdaStr),
    };
  }, [
    apiAgendaEsquerdaHydrated,
    dataEsquerdaStr,
    eventosApiEsquerda.length,
    eventosEsquerda.length,
    nomeUsuarioAgenda,
  ]);

  const apiAgendaVazioDireita = useMemo(() => {
    if (!featureFlags.useApiAgenda || !apiAgendaDireitaHydrated) return null;
    if (eventosApiDireita.length !== 0 || eventosDireita.length !== 0) return null;
    return {
      nomeUsuario: nomeUsuarioAgendaDireita,
      dataFormatada: rotuloDataComDiaSemana(dataDireitaStr),
    };
  }, [
    apiAgendaDireitaHydrated,
    dataDireitaStr,
    eventosApiDireita.length,
    eventosDireita.length,
    nomeUsuarioAgendaDireita,
  ]);

  const tituloMesRelatorio = `${MESES[mesEsquerda - 1] ?? ''} de ${anoEsquerda}`;
  const totalCompromissosMensal = useMemo(
    () => (relatorioAgendaMensal.diasComEventos || []).reduce((acc, d) => acc + d.eventos.length, 0),
    [relatorioAgendaMensal]
  );

  const rootAgendaClass = modoFlutuante
    ? 'relative flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d]'
    : 'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d]';
  const innerAgendaClass = modoFlutuante
    ? 'mx-auto flex w-full max-w-none flex-1 min-h-0 flex-col gap-2 overflow-y-auto overflow-x-hidden p-2 pb-2 sm:p-2 md:pb-2 lg:flex-row lg:gap-2 lg:overflow-hidden lg:pb-2'
    : 'mx-auto flex w-full max-w-[1800px] flex-1 min-h-0 flex-col gap-4 overflow-y-auto overflow-x-hidden p-2 pb-28 sm:p-3 md:pb-24 lg:flex-row lg:gap-3 lg:overflow-hidden lg:pb-4';

  return (
    <div className={rootAgendaClass}>
      <div className={innerAgendaClass}>
      {/* Painel esquerdo: calendário (em mobile fica no topo; em lg à esquerda). */}
      <PainelCalendario
        mesAtual={mesEsquerda}
        anoAtual={anoEsquerda}
        setMesAtual={setMesEsquerda}
        setAnoAtual={setAnoEsquerda}
        diaSelecionado={diaEsquerda}
        setDiaSelecionado={setDiaEsquerda}
        usuarioSelecionado={usuarioEsquerda}
        setUsuarioSelecionado={setUsuarioEsquerda}
        nomeGrupo="esquerda"
        usuariosSistema={usuariosAtivos}
        onAbrirUsuariosSistema={() => navigate('/usuarios')}
      />

      {/* Área central: em mobile lista empilhada por dia; em lg duas colunas lado a lado. */}
      <div className="flex w-full min-w-0 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-md ring-1 ring-indigo-500/5 backdrop-blur-sm lg:min-h-0 lg:flex-1">
        <div className="flex shrink-0 flex-col gap-2 border-b border-slate-200/80 bg-white/90 px-3 py-2.5 shadow-sm rounded-t-2xl sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-md ring-1 ring-sky-400/40 md:h-9 md:w-9">
              <CalendarDays className="h-5 w-5" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="bg-gradient-to-r from-slate-900 via-indigo-900 to-sky-800 bg-clip-text text-lg font-bold text-transparent dark:from-slate-100 dark:via-indigo-200 dark:to-sky-200 md:text-xl">
                Agenda
              </h1>
              <p className="truncate text-xs text-slate-500">Compromissos por dia — duplo toque para detalhe ou processo</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalAgendaMensal(true)}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-400/60 bg-gradient-to-r from-emerald-500 to-teal-600 px-3 py-2 text-sm font-semibold text-white shadow-md hover:from-emerald-600 hover:to-teal-700 sm:w-auto sm:shrink-0"
            title="Relatório de todos os compromissos do mês (usuário do calendário esquerdo)"
          >
            <CalendarDays className="h-4 w-4 opacity-95" aria-hidden />
            Agenda mensal
          </button>
        </div>
        <div className="flex w-full min-h-0 flex-col gap-4 bg-gradient-to-b from-slate-50/50 to-transparent p-2 lg:flex-1 lg:flex-row lg:gap-2 lg:overflow-hidden">
          <ColunaDia
            variantColuna="esquerda"
            dataLabel={`${dataEsquerdaStr} — Compromissos do dia`}
            eventos={eventosEsquerda}
            onDuploCliqueEvento={aoDuploCliqueCompromisso}
            dataBrStr={dataEsquerdaStr}
            usuarioAgendaId={usuarioEsquerda}
            somenteLeitura={false}
            mostrarColunaUsuario={false}
            resolverNomeUsuario={resolverNomeUsuarioAgenda}
            apiAgendaVazio={apiAgendaVazioEsquerda}
            usarApiAgenda={featureFlags.useApiAgenda}
            onPersistenciaAlterada={async () => {
              if (featureFlags.useApiAgenda) {
                await criarEvento(dataEsquerdaStr, usuarioEsquerda, {});
              }
              setAgendaStatusNonce((n) => n + 1);
            }}
            onSalvarCampos={(ev, patch) => {
              void (async () => {
                await salvarCamposEvento(dataEsquerdaStr, { ...ev, usuarioId: ev.usuarioId ?? usuarioEsquerda }, patch);
                setAgendaStatusNonce((n) => n + 1);
              })();
            }}
            onExcluirEvento={(ev) => {
              void (async () => {
                const r = await excluirEvento(dataEsquerdaStr, { ...ev, usuarioId: ev.usuarioId ?? usuarioEsquerda });
                if (r && r.ok === false && r.reason === 'nao-encontrado') {
                  window.alert('Não foi possível eliminar este compromisso (pode ser um registo só de demonstração).');
                  return;
                }
                setAgendaStatusNonce((n) => n + 1);
              })();
            }}
          />
          <ColunaDia
            variantColuna="direita"
            dataLabel={`${dataDireitaStr} — Próximo dia`}
            eventos={eventosDireita}
            onDuploCliqueEvento={aoDuploCliqueCompromisso}
            dataBrStr={dataDireitaStr}
            usuarioAgendaId={usuarioDireita}
            somenteLeitura={false}
            mostrarColunaUsuario={false}
            resolverNomeUsuario={resolverNomeUsuarioAgenda}
            apiAgendaVazio={apiAgendaVazioDireita}
            usarApiAgenda={featureFlags.useApiAgenda}
            onPersistenciaAlterada={async () => {
              if (featureFlags.useApiAgenda) {
                await criarEvento(dataDireitaStr, usuarioDireita, {});
              }
              setAgendaStatusNonce((n) => n + 1);
            }}
            onSalvarCampos={(ev, patch) => {
              void (async () => {
                await salvarCamposEvento(dataDireitaStr, { ...ev, usuarioId: ev.usuarioId ?? usuarioDireita }, patch);
                setAgendaStatusNonce((n) => n + 1);
              })();
            }}
            onExcluirEvento={(ev) => {
              void (async () => {
                const r = await excluirEvento(dataDireitaStr, { ...ev, usuarioId: ev.usuarioId ?? usuarioDireita });
                if (r && r.ok === false && r.reason === 'nao-encontrado') {
                  window.alert('Não foi possível eliminar este compromisso (pode ser um registo só de demonstração).');
                  return;
                }
                setAgendaStatusNonce((n) => n + 1);
              })();
            }}
          />
        </div>
      </div>

      {/* Painel direito: só em lg (em mobile o 2.º dia aparece empilhado na área central). */}
      <PainelCalendario
        mesAtual={mesDireita}
        anoAtual={anoDireita}
        setMesAtual={setMesDireita}
        setAnoAtual={setAnoDireita}
        diaSelecionado={diaDireita}
        setDiaSelecionado={setDiaDireita}
        usuarioSelecionado={usuarioDireita}
        setUsuarioSelecionado={setUsuarioDireita}
        nomeGrupo="direita"
        usuariosSistema={usuariosAtivos}
        onAbrirUsuariosSistema={() => navigate('/usuarios')}
        panelClassName="hidden lg:flex"
      />
      </div>

      <button
        type="button"
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom,0px))] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg ring-2 ring-white/50 active:scale-[0.97] lg:hidden"
        aria-label="Ir para novo compromisso do dia principal"
        onClick={() =>
          document
            .getElementById(`agenda-novo-foco-${dataEsquerdaStr}-${usuarioEsquerda}`)
            ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
      >
        <Plus className="h-7 w-7" strokeWidth={2.25} aria-hidden />
      </button>

      {modalAgendaMensal && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/45 p-0 backdrop-blur-[2px] md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="agenda-mensal-titulo"
          onClick={() => setModalAgendaMensal(false)}
        >
          <div
            className="flex h-full w-full max-w-none flex-col overflow-hidden border-0 border-slate-200/90 bg-white shadow-2xl ring-1 ring-indigo-500/10 md:h-auto md:max-h-[90vh] md:max-w-4xl md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-3 py-3 text-white shadow-md md:px-4">
              <div className="min-w-0">
                <h2 id="agenda-mensal-titulo" className="text-base font-bold tracking-tight">
                  Agenda completa — {tituloMesRelatorio}
                </h2>
                <p className="text-sm text-emerald-50/95 mt-0.5">
                  Usuário: <span className="font-semibold text-white">{nomeUsuarioAgenda}</span>
                  {' · '}
                  {(relatorioAgendaMensal.diasComEventos || []).length} dia(s) com compromisso
                  {' · '}
                  {totalCompromissosMensal} compromisso(s)
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white hover:bg-white/20 md:hidden"
                  aria-label="Voltar"
                  onClick={() => setModalAgendaMensal(false)}
                >
                  <ChevronLeft className="h-6 w-6" aria-hidden />
                </button>
                <button
                  type="button"
                  className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/20 bg-white/15 text-white hover:bg-white/25"
                  aria-label="Fechar"
                  onClick={() => setModalAgendaMensal(false)}
                >
                  <X className="h-5 w-5" aria-hidden />
                </button>
              </div>
            </div>
            <div className="px-4 py-3 overflow-y-auto flex-1 min-h-0 bg-gradient-to-b from-slate-50/40 to-white">
              {(relatorioAgendaMensal.diasComEventos || []).length === 0 ? (
                <p className="text-sm text-slate-600 py-6 text-center">
                  Nenhum compromisso neste mês para este usuário.
                </p>
              ) : (
                <div className="space-y-5">
                  {(relatorioAgendaMensal.diasComEventos || []).map(({ dataBr, eventos }) => (
                    <section key={dataBr} className="border border-slate-200/90 rounded-xl overflow-hidden shadow-sm ring-1 ring-slate-100">
                      <div className="px-3 py-2.5 bg-gradient-to-r from-indigo-800 via-slate-800 to-violet-900 text-sm font-semibold text-white">
                        {rotuloDataComDiaSemana(dataBr)}
                        <span className="font-normal text-indigo-100 ml-2">
                          ({eventos.length} {eventos.length === 1 ? 'compromisso' : 'compromissos'})
                        </span>
                      </div>
                      <div className="overflow-x-auto bg-white">
                        <table className="w-full text-sm border-collapse min-w-[520px]">
                          <thead>
                            <tr className="bg-gradient-to-r from-slate-100 to-indigo-50/80 border-b border-slate-200">
                              <th className="text-left px-3 py-2 font-semibold text-slate-800 w-[88px]">Hora</th>
                              {relatorioAgendaMensal.todosUsuarios ? (
                                <th className="text-left px-3 py-2 font-semibold text-slate-800 w-[120px]">Quem</th>
                              ) : null}
                              <th className="text-left px-3 py-2 font-semibold text-slate-800">Descrição</th>
                              <th className="text-right px-3 py-2 font-semibold text-slate-800 w-[72px]">Status</th>
                              <th className="w-10 px-1 py-2 text-center font-semibold text-slate-800">
                                <span className="sr-only">Eliminar</span>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {eventos.map((ev) => (
                              <tr key={`${dataBr}-${ev.id}`} className="border-b border-slate-100 last:border-0 hover:bg-indigo-50/30 transition-colors">
                                <td className="px-3 py-2 align-top text-slate-800 whitespace-nowrap">
                                  {ev.hora ? ev.hora : '—'}
                                </td>
                                {relatorioAgendaMensal.todosUsuarios ? (
                                  <td className="px-3 py-2 align-top text-slate-700 text-xs truncate max-w-[120px]">
                                    {String(ev.usuarioNome ?? '').trim()
                                      ? String(ev.usuarioNome).trim()
                                      : resolverNomeUsuarioAgenda(ev)}
                                  </td>
                                ) : null}
                                <td className="px-3 py-2 align-top text-slate-800 whitespace-pre-wrap break-words">
                                  {ev.descricao ? ev.descricao : '—'}
                                </td>
                                <td className="px-3 py-2 align-top text-right text-slate-800">
                                  {normalizarStatusCurtoAgenda(ev.statusCurto) === 'OK' ? 'OK' : '—'}
                                </td>
                                <td className="px-1 py-1.5 align-top text-center">
                                  {eventoAgendaPodeExcluir(ev, featureFlags.useApiAgenda) ? (
                                    <button
                                      type="button"
                                      className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200/90 bg-white text-rose-600 hover:bg-rose-50"
                                      aria-label="Eliminar compromisso"
                                      title="Eliminar compromisso"
                                      onClick={() => {
                                        void (async () => {
                                          const trecho = [String(ev.hora ?? '').trim(), String(ev.descricao ?? '').trim().slice(0, 200)]
                                            .filter(Boolean)
                                            .join(' — ');
                                          const msg = trecho
                                            ? `Eliminar este compromisso?\n\n${trecho}${trecho.length >= 200 ? '…' : ''}`
                                            : 'Eliminar este compromisso?';
                                          if (!window.confirm(msg)) return;
                                          const uid =
                                            String(ev.usuarioId ?? '').trim() ||
                                            String(usuarioEsquerda ?? '').trim();
                                          const r = await excluirEvento(dataBr, { ...ev, usuarioId: uid });
                                          if (r && r.ok === false && r.reason === 'nao-encontrado') {
                                            window.alert(
                                              'Não foi possível eliminar este compromisso (pode ser um registo só de demonstração).'
                                            );
                                            return;
                                          }
                                          setAgendaStatusNonce((n) => n + 1);
                                        })();
                                      }}
                                    >
                                      <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                                    </button>
                                  ) : (
                                    <span className="inline-block w-8" aria-hidden />
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>
            <div className="flex shrink-0 justify-end border-t border-slate-200/80 bg-white px-3 py-3 md:px-4">
              <button
                type="button"
                className="min-h-11 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:from-indigo-700 hover:to-violet-700 md:w-auto"
                onClick={() => setModalAgendaMensal(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {eventoModal && (
        <div
          className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/45 p-0 backdrop-blur-[2px] md:items-center md:p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setEventoModal(null)}
        >
          <div
            className="flex h-full w-full max-w-none flex-col overflow-hidden border-0 border-slate-200/90 bg-white shadow-2xl ring-1 ring-sky-500/10 md:h-auto md:max-w-lg md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-center justify-between gap-2 bg-gradient-to-r from-sky-600 to-indigo-600 px-3 py-3 text-white shadow-md md:px-4">
              <button
                type="button"
                className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white hover:bg-white/20 md:hidden"
                aria-label="Voltar"
                onClick={() => setEventoModal(null)}
              >
                <ChevronLeft className="h-6 w-6" aria-hidden />
              </button>
              <h2 className="min-w-0 flex-1 text-sm font-bold">Texto completo do compromisso</h2>
              <button
                type="button"
                className="rounded-lg border border-white/20 bg-white/15 px-3 py-2 text-xs font-semibold text-white hover:bg-white/25 min-h-11 md:min-h-0"
                aria-label="Fechar"
                onClick={() => setEventoModal(null)}
              >
                OK
              </button>
            </div>
            <div className="px-4 py-4 overflow-y-auto bg-gradient-to-b from-slate-50/50 to-white">
              <div className="space-y-2">
                {eventoModal.hora ? (
                  <div className="text-sm text-slate-700">
                    <span className="font-medium">Hora:</span> {eventoModal.hora}
                  </div>
                ) : null}
                {eventoModal.descricao ? (
                  <div className={classesTemaDescricaoModal(eventoModal.descricao)}>{eventoModal.descricao}</div>
                ) : null}
                {eventoModal.status ? (
                  <div className="text-sm text-slate-700">
                    <span className="font-medium">Status:</span> {eventoModal.status}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col gap-2 border-t border-slate-200/80 bg-white px-3 py-3 sm:flex-row sm:flex-wrap sm:justify-end md:px-4">
              {(() => {
                const ch = extrairChaveProcessoEventoAgenda(eventoModal);
                if (!ch) return null;
                return (
                  <button
                    type="button"
                    className="min-h-11 w-full rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md hover:from-indigo-700 hover:to-violet-700 sm:w-auto"
                    onClick={() => {
                      setEventoModal(null);
                      navigate('/processos', { state: buildRouterStateChaveClienteProcesso(ch.codCliente, ch.proc) });
                    }}
                  >
                    Abrir processo
                  </button>
                );
              })()}
              <button
                type="button"
                className="min-h-11 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 shadow-sm hover:bg-slate-50 sm:w-auto"
                onClick={() => setEventoModal(null)}
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { CircleAlert, Gavel, Pin, Scale, X } from 'lucide-react';
import { normalizarStatusCurtoAgenda } from '../data/agendaPersistenciaData.js';

/** Remove acentos e minúsculas para busca insensível a maiúsculas/acentos. */
export function normalizarParaBuscaPalavraChave(str) {
  return String(str ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase();
}

/** Tipo visual do compromisso (cards coloridos). Instrução tem prioridade sobre os demais. */
export function tipoCompromissoAgenda(texto) {
  const n = normalizarParaBuscaPalavraChave(texto);
  if (n.includes('instrucao')) return 'instrucao';
  if (n.includes('sessao de julgamento')) return 'julgamento';
  if (n.includes('conciliacao')) return 'conciliacao';
  return 'comum';
}

function temaPorTextoCompromisso(texto) {
  const t = tipoCompromissoAgenda(texto);
  if (t === 'instrucao') return 'instrucao';
  if (t === 'conciliacao' || t === 'julgamento') return 'conciliacao';
  return null;
}

export const ESTILO_TIPO_COMPROMISSO = {
  instrucao: {
    card: 'bg-red-50 border-l-4 border-l-red-500 border-red-100/80 hover:border-red-200',
    badge: 'bg-red-500 text-white',
    rotulo: 'INSTRUÇÃO',
    Icon: CircleAlert,
    iconClass: 'text-red-600',
  },
  conciliacao: {
    card: 'bg-amber-50 border-l-4 border-l-amber-500 border-amber-100/80 hover:border-amber-200',
    badge: 'bg-amber-500 text-white',
    rotulo: 'CONCILIAÇÃO',
    Icon: Scale,
    iconClass: 'text-amber-600',
  },
  julgamento: {
    card: 'bg-purple-50 border-l-4 border-l-purple-500 border-purple-100/80 hover:border-purple-200',
    badge: 'bg-purple-500 text-white',
    rotulo: 'JULGAMENTO',
    Icon: Gavel,
    iconClass: 'text-purple-600',
  },
  comum: {
    card: 'bg-white border-l-4 border-l-gray-300 border-slate-200/90 hover:border-slate-300',
    badge: '',
    rotulo: '',
    Icon: Pin,
    iconClass: 'text-gray-400',
  },
};

export function urgenciaDiaAgenda(eventos) {
  if (!eventos?.length) return null;
  let result = 'comum';
  for (const ev of eventos) {
    const t = tipoCompromissoAgenda(ev?.descricao);
    if (t === 'instrucao') return 'instrucao';
    if (t === 'conciliacao') result = 'conciliacao';
    else if (t === 'julgamento' && result !== 'conciliacao') result = 'julgamento';
  }
  return result;
}

export const DOT_CALENDARIO_CLASSE = {
  instrucao: 'bg-red-500',
  conciliacao: 'bg-amber-500',
  julgamento: 'bg-purple-500',
  comum: 'bg-blue-500',
};

export function parseCorpoCompromisso(descricao) {
  const raw = String(descricao ?? '').trim();
  if (!raw) return { partes: '', autosLocal: '' };
  const linhas = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  if (linhas.length >= 2) {
    return { partes: linhas[0], autosLocal: linhas.slice(1).join(' · ') };
  }
  const mAutos = raw.match(/^(.*?)(?:\s*[-–—]\s*|\s+)(autos\s*n[º°.]?\s*.+)$/i);
  if (mAutos) {
    return { partes: mAutos[1].trim(), autosLocal: mAutos[2].trim() };
  }
  return { partes: raw, autosLocal: '' };
}

export function corChipUsuarioAgenda(u) {
  const login = String(u?.login ?? '').toLowerCase();
  const id = String(u?.id ?? '').toLowerCase();
  if (login.includes('ana') || id.includes('ana')) {
    return {
      dot: 'bg-blue-500',
      chip: 'border-blue-200 text-blue-900 hover:bg-blue-50',
      chipAtivo: 'bg-blue-600 text-white border-blue-600 shadow-sm',
    };
  }
  if (login.includes('karla') || id.includes('karla')) {
    return {
      dot: 'bg-pink-500',
      chip: 'border-pink-200 text-pink-900 hover:bg-pink-50',
      chipAtivo: 'bg-pink-600 text-white border-pink-600 shadow-sm',
    };
  }
  if (login.includes('itamar') || id.includes('itamar')) {
    return {
      dot: 'bg-emerald-500',
      chip: 'border-emerald-200 text-emerald-900 hover:bg-emerald-50',
      chipAtivo: 'bg-emerald-600 text-white border-emerald-600 shadow-sm',
    };
  }
  return {
    dot: 'bg-violet-500',
    chip: 'border-violet-200 text-violet-900 hover:bg-violet-50',
    chipAtivo: 'bg-violet-600 text-white border-violet-600 shadow-sm',
  };
}

/** Badge de status com mini-menu (persistência: vazio = pendente, OK = concluído). */
export function StatusBadgeAgenda({ evento, onSalvar, readOnly = false, onStatusAlterado = null }) {
  const valor = normalizarStatusCurtoAgenda(evento?.statusCurto);
  const [aberto, setAberto] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!aberto) return undefined;
    const fechar = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAberto(false);
    };
    document.addEventListener('mousedown', fechar);
    return () => document.removeEventListener('mousedown', fechar);
  }, [aberto]);

  const badge =
    valor === 'OK' ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700 transition-opacity duration-300">
        ✓ OK
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
        Pendente
      </span>
    );

  if (readOnly) {
    return (
      <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
        {badge}
      </div>
    );
  }

  return (
    <div className="relative shrink-0" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="rounded-full transition-transform hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
        aria-expanded={aberto}
        aria-haspopup="listbox"
        onClick={() => setAberto((v) => !v)}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        {badge}
      </button>
      {aberto ? (
        <div
          role="listbox"
          className="absolute right-0 top-full z-20 mt-1 min-w-[9rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
        >
          <button
            type="button"
            role="option"
            className="block w-full px-3 py-2 text-left text-xs text-gray-600 hover:bg-slate-50"
            onClick={() => {
              onSalvar?.('');
              onStatusAlterado?.('Pendente');
              setAberto(false);
            }}
          >
            Pendente
          </button>
          <button
            type="button"
            role="option"
            className="block w-full px-3 py-2 text-left text-xs text-green-700 hover:bg-green-50"
            onClick={() => {
              onSalvar?.('OK');
              onStatusAlterado?.('OK');
              setAberto(false);
            }}
          >
            ✓ OK
          </button>
          </div>
      ) : null}
    </div>
  );
}

/** Campo de texto clicável para editar (hora ou descrição). */
export function EditableTextCell({
  texto,
  onSalvar,
  multiline = false,
  align = 'left',
  maxLen = 2000,
  temaPorPalavraChave = false,
  onDuploClique = null,
  readOnly = false,
  /** Abre já em modo edição (linha «Novo compromisso»). */
  iniciarEmEdicao = false,
  /** Chamado uma vez após foco automático (ex.: Tab na hora → descrição do card criado). */
  onEdicaoIniciada = null,
  classNameLeitura = '',
  classNameInput = '',
}) {
  const original = String(texto ?? '');
  const [editando, setEditando] = useState(iniciarEmEdicao);
  const [valor, setValor] = useState(original);
  const inputRef = useRef(null);
  const cancelouRef = useRef(false);
  const focoInicialAplicadoRef = useRef(false);

  useEffect(() => {
    if (!editando) setValor(original);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [original]);

  useEffect(() => {
    if (!iniciarEmEdicao) {
      focoInicialAplicadoRef.current = false;
      return;
    }
    setEditando(true);
  }, [iniciarEmEdicao]);

  useEffect(() => {
    if (!editando) return;
    const el = inputRef.current;
    if (!el) return;
    try {
      el.focus();
      if (!multiline) el.select?.();
      if (iniciarEmEdicao && !focoInicialAplicadoRef.current) {
        focoInicialAplicadoRef.current = true;
        onEdicaoIniciada?.();
      }
    } catch {
      // ignore
    }
  }, [editando, multiline, iniciarEmEdicao, onEdicaoIniciada]);

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
        : '';

  const baseLeitura = classNameLeitura || classesTemaLeitura || 'text-gray-800';
  const baseInput = classNameInput || classesTemaInput;

  if (readOnly) {
    return (
      <div className="min-w-0 w-full" onClick={(e) => e.stopPropagation()}>
        <div
          className={`${baseLeitura} ${multiline ? 'text-sm whitespace-pre-wrap break-words' : 'text-sm truncate'} block w-full select-none ${alignClass} ${multiline ? 'min-h-[1.25rem]' : ''}`}
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
    <div className="min-w-0 w-full" onClick={(e) => e.stopPropagation()}>
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
            className={`w-full rounded border px-1.5 py-1 text-sm focus:outline-none focus:ring-1 resize-y min-h-[3rem] ${inputAlign} ${baseInput}`}
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
            className={`w-full rounded border px-1.5 py-1 text-sm focus:outline-none focus:ring-1 ${inputAlign} ${baseInput}`}
            maxLength={maxLen}
          />
        )
      ) : (
        <div
          className={`${baseLeitura} ${multiline ? 'text-sm whitespace-pre-wrap break-words' : 'text-sm truncate'} block w-full cursor-text select-none ${alignClass} ${multiline ? 'min-h-[1.25rem]' : ''}`}
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

export function CompromissoCard({
  ev,
  somenteLeitura,
  onDuploCliqueEvento,
  dataBrStr,
  onSalvarCampos,
  onExcluirEvento,
  usarApiAgenda,
  eventoAgendaPodeExcluir,
  onSolicitarExclusao,
  onStatusAlterado,
  mostrarColunaUsuario = false,
  resolverNomeUsuario = null,
  focarDescricao = false,
  onFocoDescricaoAplicado = null,
}) {
  const cardRef = useRef(null);
  const tipo = tipoCompromissoAgenda(ev?.descricao);
  const estilo = ESTILO_TIPO_COMPROMISSO[tipo] ?? ESTILO_TIPO_COMPROMISSO.comum;
  const { partes, autosLocal } = parseCorpoCompromisso(ev?.descricao);
  const concluido = normalizarStatusCurtoAgenda(ev?.statusCurto) === 'OK';
  const Icon = estilo.Icon;
  const podeExcluir = !somenteLeitura && onExcluirEvento && eventoAgendaPodeExcluir(ev, usarApiAgenda);

  useEffect(() => {
    if (!focarDescricao) return;
    cardRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focarDescricao]);

  return (
    <article
      ref={cardRef}
      className={`group relative rounded-xl border p-3 shadow-sm transition-all duration-300 hover:shadow-md ${estilo.card} ${
        concluido ? 'opacity-60' : ''
      }`}
      onDoubleClick={() => onDuploCliqueEvento?.(ev)}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 pt-0.5">
          <EditableTextCell
            texto={ev.hora ?? ''}
            align="left"
            maxLen={12}
            readOnly={somenteLeitura}
            classNameLeitura="text-sm font-mono font-bold text-gray-500 bg-transparent border-0 p-0"
            onDuploClique={() => onDuploCliqueEvento?.(ev)}
            onSalvar={(novo) => {
              if (!dataBrStr) return;
              onSalvarCampos?.(ev, { hora: novo });
            }}
          />
        </div>

        <div className="min-w-0 flex-1">
          {estilo.rotulo ? (
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide ${estilo.badge}`}
              >
                <Icon className={`h-3.5 w-3.5 ${estilo.iconClass}`} aria-hidden />
                {estilo.rotulo}
              </span>
            </div>
          ) : (
            <Icon className={`mb-1 h-4 w-4 ${estilo.iconClass}`} aria-hidden />
          )}

          <div className="min-w-0">
            {somenteLeitura ? (
              <>
                <p className="text-base font-medium text-gray-800 whitespace-pre-wrap break-words">{partes || '\u00A0'}</p>
                {autosLocal ? <p className="mt-0.5 text-sm text-gray-500">{autosLocal}</p> : null}
              </>
            ) : (
              <EditableTextCell
                texto={ev.descricao ?? ''}
                multiline
                align="left"
                maxLen={2000}
                temaPorPalavraChave
                readOnly={somenteLeitura}
                iniciarEmEdicao={focarDescricao}
                onEdicaoIniciada={onFocoDescricaoAplicado}
                classNameLeitura="text-base font-medium text-gray-800 bg-transparent border-0 p-0 whitespace-pre-wrap break-words"
                onDuploClique={() => onDuploCliqueEvento?.(ev)}
                onSalvar={(novo) => {
                  if (!dataBrStr) return;
                  onSalvarCampos?.(ev, { descricao: novo });
                }}
              />
            )}
          </div>

          {mostrarColunaUsuario ? (
            <p className="mt-1 text-xs text-slate-500">{resolverNomeUsuario?.(ev) ?? '—'}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <StatusBadgeAgenda
            evento={ev}
            readOnly={somenteLeitura}
            onStatusAlterado={onStatusAlterado}
            onSalvar={(novo) => {
              if (!dataBrStr) return;
              onSalvarCampos?.(ev, { statusCurto: novo });
            }}
          />
          {podeExcluir ? (
            <button
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 opacity-40 transition-all hover:bg-white/80 hover:text-rose-600 hover:opacity-100 group-hover:opacity-70"
              aria-label="Eliminar compromisso"
              title="Eliminar compromisso"
              onClick={(e) => {
                e.stopPropagation();
                onSolicitarExclusao(ev);
              }}
            >
              <X className="h-4 w-4" strokeWidth={2} aria-hidden />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function NovoCompromissoCard({ idFoco, salvarLinhaVazia, suprimirAutoFocoHora = false }) {
  const [hora, setHora] = useState('');
  const [descricao, setDescricao] = useState('');
  const horaInputRef = useRef(null);
  const horaEnviadaRef = useRef('');
  const descricaoEnviadaRef = useRef('');
  const pedirFocoDescricaoRef = useRef(false);

  useEffect(() => {
    if (suprimirAutoFocoHora) return undefined;
    const id = requestAnimationFrame(() => horaInputRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [suprimirAutoFocoHora]);

  const tema = temaPorTextoCompromisso(descricao);
  const classesDescricao =
    tema === 'instrucao'
      ? 'bg-red-600 text-white border-red-700 focus:ring-red-400 placeholder:text-red-200'
      : tema === 'conciliacao'
        ? 'bg-yellow-300 text-black border-yellow-600 focus:ring-yellow-600 placeholder:text-yellow-900/60'
        : 'bg-white text-gray-900 border-slate-300 focus:ring-indigo-400/50 focus:border-indigo-400';

  async function gravarHora() {
    const focarDescricao = pedirFocoDescricaoRef.current;
    pedirFocoDescricaoRef.current = false;
    const v = String(hora ?? '').trim();
    if (v === horaEnviadaRef.current) return;
    horaEnviadaRef.current = v;
    if (v) await salvarLinhaVazia({ hora: v }, { focarDescricao });
  }

  async function gravarDescricao() {
    const v = String(descricao ?? '').trim();
    if (v === descricaoEnviadaRef.current) return;
    descricaoEnviadaRef.current = v;
    if (v) await salvarLinhaVazia({ descricao: v });
  }

  return (
    <article
      id={idFoco}
      className="rounded-xl border border-dashed border-emerald-300/90 bg-gradient-to-br from-emerald-50/80 to-white p-3 shadow-sm ring-1 ring-emerald-100/80"
    >
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-emerald-800">Novo compromisso</p>
      <div className="flex items-start gap-3">
        <div className="w-[4.5rem] shrink-0">
          <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor={`${idFoco}-hora`}>
            Hora
          </label>
          <input
            id={`${idFoco}-hora`}
            ref={horaInputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={hora}
            maxLength={12}
            placeholder="14:30"
            onChange={(e) => setHora(e.target.value)}
            onBlur={() => void gravarHora()}
            onKeyDown={(e) => {
              if (e.key === 'Tab' && !e.shiftKey && String(hora ?? '').trim()) {
                pedirFocoDescricaoRef.current = true;
                e.preventDefault();
                void gravarHora();
                return;
              }
              if (e.key === 'Enter') {
                e.preventDefault();
                void gravarHora();
              }
            }}
            className="w-full rounded border border-slate-300 bg-white px-1.5 py-1.5 text-sm font-mono font-bold text-gray-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400/50"
          />
        </div>
        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-semibold text-slate-500" htmlFor={`${idFoco}-desc`}>
            Descrição
          </label>
          <textarea
            id={`${idFoco}-desc`}
            value={descricao}
            rows={3}
            maxLength={2000}
            placeholder="Descreva o compromisso…"
            onChange={(e) => setDescricao(e.target.value)}
            onBlur={() => void gravarDescricao()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                void gravarDescricao();
              }
            }}
            className={`w-full resize-y rounded border px-2 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-1 min-h-[3rem] ${classesDescricao}`}
          />
        </div>
        <div className="shrink-0 pt-5">
          <StatusBadgeAgenda evento={{ statusCurto: '' }} onSalvar={(novo) => void salvarLinhaVazia({ statusCurto: novo })} />
        </div>
      </div>
    </article>
  );
}

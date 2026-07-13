import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  CircleOff,
  Link2,
  Loader2,
  MoreVertical,
  RotateCcw,
} from 'lucide-react';
import { entradaEmailEfetivaIso } from '../../data/publicacoesEmailOrdenacao.js';
import { resolverSugestaoVinculoLinha } from '../../data/publicacoesVinculoProcessos.js';

const FUSO_ENTRADA_EMAIL = 'America/Sao_Paulo';

export const GRID_COLS_PUBLICACOES_EMAIL =
  'grid-cols-[104px_96px_minmax(0,1fr)_96px_76px_92px]';

const STATUS_TRATAMENTO_LABEL = {
  PENDENTE: 'Não',
  VINCULADA: 'Não',
  TRATADA: 'Sim',
  IGNORADA: 'Ignorada',
};

export function statusTratamentoLinha(row) {
  if (row?._statusTratamento) return row._statusTratamento;
  if (row?.statusVinculo === 'ignorada') return 'IGNORADA';
  if (row?.statusVinculo === 'vinculado') return 'VINCULADA';
  return 'PENDENTE';
}

function badgeStatusTratamentoClass(status) {
  switch (status) {
    case 'TRATADA':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';
    case 'IGNORADA':
      return 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400';
    default:
      return 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
  }
}

export function BadgeStatusTratamento({ row }) {
  const status = statusTratamentoLinha(row);
  const label = STATUS_TRATAMENTO_LABEL[status] || status;
  const title =
    status === 'TRATADA'
      ? 'Tratada — revisada e concluída na fila'
      : status === 'IGNORADA'
        ? 'Ignorada — sem providência'
        : status === 'VINCULADA'
          ? 'Vinculada, mas ainda não marcada como tratada'
          : 'Pendente de tratamento';
  return (
    <span
      title={title}
      className={`inline-flex max-w-full truncate rounded px-2 py-0.5 text-[10px] font-semibold ${badgeStatusTratamentoClass(status)}`}
    >
      {label}
    </span>
  );
}

export const TOOLTIP_ACOES_PUBLICACAO = {
  abrirProcesso: 'Abrir o cadastro do processo vinculado ou sugerido.',
  vincular:
    'Associar esta publicação a um processo do cadastro (escolher cliente e nº interno).',
  auto: 'Vincular automaticamente pelo CNJ ao processo já cadastrado no sistema.',
  tratar: 'Marcar como tratada — publicação revisada e concluída na sua fila.',
  ignorar: 'Marcar como ignorada — sem providência (aviso duplicado, irrelevante, etc.).',
};

export function fmtDataBr(isoDate) {
  if (!isoDate) return '—';
  const s = String(isoDate);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-');
    return `${d}/${m}/${y}`;
  }
  return s;
}

export function fmtRecebidoCurto(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `recebido ${dd}/${mm} ${hh}:${min}`;
  } catch {
    return null;
  }
}

/** Data/hora de entrada do email na caixa Gmail (fuso Brasília, como no Gmail). */
export function fmtEntradaEmailPrincipal(iso) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const hora = d.toLocaleTimeString('pt-BR', {
      timeZone: FUSO_ENTRADA_EMAIL,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const data = d.toLocaleDateString('pt-BR', {
      timeZone: FUSO_ENTRADA_EMAIL,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
    return { hora, data, completo: `${data} ${hora}` };
  } catch {
    return null;
  }
}

export function cnjLinha(row) {
  return row.numeroProcessoEncontrado || row.numero_processo_cnj || row.processoCnjNormalizado || '—';
}

export function truncarTexto(texto, max = 120) {
  const t = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (!t) return '—';
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

export function formatarCnjComProc(row, indiceCnj, sugestoesApi) {
  const cnj = cnjLinha(row);
  const sug = resolverSugestaoVinculoLinha(row, indiceCnj, sugestoesApi);
  const proc = row?.procInterno ?? sug?.procInterno;
  if (cnj === '—') return '—';
  if (proc != null && String(proc).trim() !== '') return `${cnj} · nº ${proc}`;
  return cnj;
}

export function BadgeStatusVinculo({ row }) {
  const vinculado = row?.statusVinculo === 'vinculado';
  const cls = vinculado
    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
    : 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100';
  return (
    <span className={`inline-flex max-w-full truncate rounded px-2 py-0.5 text-[10px] font-semibold ${cls}`}>
      {vinculado ? 'Vinculado' : 'Pendente'}
    </span>
  );
}

function calcularPosicaoMenuFlutuante(anchorEl, menuEl) {
  const gap = 4;
  const pad = 8;
  const r = anchorEl.getBoundingClientRect();
  const menuW = menuEl?.offsetWidth ?? 208;
  const menuH = menuEl?.offsetHeight ?? 200;
  const espacoAbaixo = window.innerHeight - r.bottom - pad;
  const espacoAcima = r.top - pad;
  const abrirAcima = espacoAbaixo < menuH + gap && espacoAcima > espacoAbaixo;

  let top = abrirAcima ? r.top - gap - menuH : r.bottom + gap;
  let left = r.right - menuW;
  left = Math.max(pad, Math.min(left, window.innerWidth - menuW - pad));
  top = Math.max(pad, Math.min(top, window.innerHeight - menuH - pad));
  return { top, left };
}

function MenuAcoesPublicacaoEmail({
  aberto,
  onFechar,
  menuId,
  onVincular,
  onAuto,
  onTratar,
  onIgnorar,
  anchorRef,
}) {
  const menuRef = useRef(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const atualizarPosicao = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor || typeof window === 'undefined') return;
    setPos(calcularPosicaoMenuFlutuante(anchor, menuRef.current));
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!aberto) return;
    atualizarPosicao();
  }, [aberto, atualizarPosicao]);

  useEffect(() => {
    if (!aberto) return undefined;
    const onDocMouseDown = (e) => {
      if (menuRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onFechar();
    };
    const onDocKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onFechar();
        anchorRef.current?.focus();
        return;
      }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
      const items = menuRef.current?.querySelectorAll('[role="menuitem"]');
      if (!items?.length) return;
      e.preventDefault();
      const list = Array.from(items);
      const idx = list.indexOf(document.activeElement);
      if (e.key === 'Home') {
        list[0]?.focus();
        return;
      }
      if (e.key === 'End') {
        list[list.length - 1]?.focus();
        return;
      }
      const next =
        e.key === 'ArrowDown'
          ? list[(idx < 0 ? 0 : idx + 1) % list.length]
          : list[(idx <= 0 ? list.length : idx) - 1];
      next?.focus();
    };
    const onReflow = () => atualizarPosicao();
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onDocKeyDown);
    window.addEventListener('scroll', onReflow, true);
    window.addEventListener('resize', onReflow);
    const t = requestAnimationFrame(() => {
      atualizarPosicao();
      menuRef.current?.querySelector('[role="menuitem"]')?.focus();
    });
    return () => {
      cancelAnimationFrame(t);
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onDocKeyDown);
      window.removeEventListener('scroll', onReflow, true);
      window.removeEventListener('resize', onReflow);
    };
  }, [aberto, onFechar, anchorRef, atualizarPosicao]);

  if (!aberto || typeof document === 'undefined') return null;

  const itemClass =
    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-100 focus:bg-slate-100 focus:outline-none dark:text-slate-200 dark:hover:bg-white/10 dark:focus:bg-white/10';

  const run = (fn) => () => {
    fn?.();
    onFechar();
  };

  return createPortal(
    <div
      ref={menuRef}
      id={menuId}
      role="menu"
      aria-orientation="vertical"
      style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
      className="w-52 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[#141922]"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Vínculo</p>
      <button type="button" role="menuitem" className={itemClass} onClick={run(onVincular)}>
        <Link2 className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
        Vincular manualmente
      </button>
      <button type="button" role="menuitem" className={itemClass} onClick={run(onAuto)}>
        <RotateCcw className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
        Vincular automático
      </button>
      <p className="mt-1 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Triagem</p>
      <button type="button" role="menuitem" className={itemClass} onClick={run(onTratar)}>
        <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
        Tratar / concluir
      </button>
      <button type="button" role="menuitem" className={itemClass} onClick={run(onIgnorar)}>
        <CircleOff className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
        Ignorar
      </button>
    </div>,
    document.body
  );
}

export function AcoesLinhaCompacta({
  onAbrirProcesso,
  podeAbrirProcesso = false,
  onVincular,
  onAuto,
  onTratar,
  onIgnorar,
  menuAriaLabel = 'Mais ações',
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const menuBtnRef = useRef(null);
  const menuId = useId();

  const fecharMenu = useCallback(() => setMenuAberto(false), []);

  return (
    <div className="relative flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      {onAbrirProcesso ? (
        <button
          type="button"
          title={TOOLTIP_ACOES_PUBLICACAO.abrirProcesso}
          onClick={onAbrirProcesso}
          disabled={!podeAbrirProcesso}
          className="inline-flex h-7 items-center rounded-md bg-sky-600 px-2 text-[11px] font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-white/10 dark:disabled:text-slate-500"
        >
          Abrir
        </button>
      ) : null}
      <button
        ref={menuBtnRef}
        type="button"
        aria-label={menuAriaLabel}
        aria-haspopup="menu"
        aria-expanded={menuAberto}
        aria-controls={menuAberto ? menuId : undefined}
        title="Mais ações"
        onClick={() => setMenuAberto((v) => !v)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-500/40 dark:border-white/15 dark:text-slate-300 dark:hover:bg-white/10"
      >
        <MoreVertical className="h-4 w-4" aria-hidden />
      </button>
      <MenuAcoesPublicacaoEmail
        aberto={menuAberto}
        onFechar={fecharMenu}
        menuId={menuId}
        anchorRef={menuBtnRef}
        onVincular={onVincular}
        onAuto={onAuto}
        onTratar={onTratar}
        onIgnorar={onIgnorar}
      />
    </div>
  );
}

export function CelulaDataCompacta({ row, onAbrirDetalhe }) {
  const entrada = fmtEntradaEmailPrincipal(entradaEmailEfetivaIso(row));
  const movimento = fmtDataBr(row.dataPublicacao);
  return (
    <button
      type="button"
      role="cell"
      className="min-w-0 cursor-pointer text-left"
      onClick={onAbrirDetalhe}
      title={entrada ? `Email recebido: ${entrada.completo}` : 'Ver detalhes'}
    >
      {entrada ? (
        <>
          <div className="truncate text-xs font-semibold tabular-nums text-slate-900 dark:text-slate-100">
            {entrada.hora}
          </div>
          <div className="truncate text-[10px] tabular-nums text-slate-600 dark:text-slate-400">
            {entrada.data}
          </div>
        </>
      ) : (
        <div className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">
          {movimento}
        </div>
      )}
      {entrada && movimento && movimento !== '—' ? (
        <div className="truncate text-[10px] text-slate-500 dark:text-slate-400">mov. {movimento}</div>
      ) : entrada ? null : (
        <div className="text-[10px] text-slate-400">—</div>
      )}
    </button>
  );
}

export function CelulaStatusCompacta({ row, carregandoSugestoes }) {
  return (
    <div role="cell" className="min-w-0">
      {carregandoSugestoes && row.statusVinculo !== 'vinculado' ? (
        <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          …
        </span>
      ) : (
        <BadgeStatusVinculo row={row} />
      )}
    </div>
  );
}

export function CelulaTratadoCompacta({ row }) {
  return (
    <div role="cell" className="min-w-0">
      <BadgeStatusTratamento row={row} />
    </div>
  );
}

export function destaqueLinhaNaoVinculada(row) {
  return row.statusVinculo === 'nao_vinculado' || row.statusVinculo === 'sem_cnj'
    ? 'border-l-2 border-l-amber-400/80'
    : '';
}

export function shellTabelaCompacta({ ariaLabel, cabecalho, children }) {
  return (
    <div
      className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#141922] md:block"
      role="table"
      aria-label={ariaLabel}
    >
      {cabecalho}
      <div role="rowgroup">{children}</div>
    </div>
  );
}

import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

/**
 * Cabeçalho da coluna dinâmica (ex.: Último Andamento): título variável + ordenação + dropdown estilo planilha.
 * Menu em portal + position fixed para não ser cortado pelo overflow da tabela.
 */
export function RelatorioUltimoAndamentoHeader({
  minWStyle,
  larguraUniforme,
  colunasAtivasLength,
  options,
  selectedFieldKey,
  onSelectField,
  onSort,
  ordenarAtivo,
  ordemAsc,
  modoAlteracao = false,
  /** Id único por coluna (evita colisão de portais / clique fora). */
  menuInstanceId = 'ultimo-andamento',
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const wrapRef = useRef(null);
  const menuPortalRef = useRef(null);
  const [menuRect, setMenuRect] = useState({ top: 0, left: 0, width: 260 });

  const menuRootId = `relatorio-col-titulo-menu-${menuInstanceId}`;

  const tituloAtual =
    options.find((o) => o.fieldKey === selectedFieldKey)?.label ?? selectedFieldKey ?? 'Coluna';

  const clsModoEdicao = modoAlteracao ? 'text-red-200' : 'text-white';

  const atualizarPosicaoMenu = () => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuRect({
      top: r.bottom + 4,
      left: r.left,
      width: Math.min(280, Math.max(r.width, 200)),
    });
  };

  useLayoutEffect(() => {
    if (!menuAberto) return;
    atualizarPosicaoMenu();
  }, [menuAberto]);

  useEffect(() => {
    if (!menuAberto) return;

    /**
     * Clique na barra de rolagem nativa (WebKit/macOS): `target` costuma ser <html> ou outro nó
     * que não passa em `contains`. `composedPath` / `elementsFromPoint` + margem à direita cobrem o caso.
     */
    function eventoDentroDoMenuDropdown(e) {
      const portal = menuPortalRef.current;
      if (!portal) return false;
      const t = e.target;
      if (t instanceof Node && portal.contains(t)) return true;
      try {
        const path = typeof e.composedPath === 'function' ? e.composedPath() : [];
        if (path.includes(portal)) return true;
      } catch {
        /* ignore */
      }
      const r = portal.getBoundingClientRect();
      const { clientX: x, clientY: y } = e;
      const margemDir = 28;
      const margem = 4;
      if (
        x >= r.left - margem &&
        x <= r.right + margemDir &&
        y >= r.top - margem &&
        y <= r.bottom + margem
      ) {
        return true;
      }
      try {
        const stack = document.elementsFromPoint(x, y);
        if (stack.some((el) => el === portal || (el instanceof Node && portal.contains(el)))) return true;
      } catch {
        /* ignore */
      }
      return false;
    }

    function fecharSeCliqueFora(e) {
      if (e.button != null && e.button !== 0) return;
      const wrap = wrapRef.current;
      const tgt = e.target;
      if (wrap && tgt instanceof Node && wrap.contains(tgt)) return;
      if (eventoDentroDoMenuDropdown(e)) return;
      setMenuAberto(false);
    }

    document.addEventListener('mousedown', fecharSeCliqueFora, false);
    return () => document.removeEventListener('mousedown', fecharSeCliqueFora, false);
  }, [menuAberto]);

  const thStyle = larguraUniforme
    ? { width: `${100 / colunasAtivasLength}%`, minWidth: 0 }
    : minWStyle;

  const maxMenuHeightPx =
    typeof window !== 'undefined'
      ? Math.max(120, Math.min(224, window.innerHeight - menuRect.top - 8))
      : 224;

  const menuPortal =
    menuAberto &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        ref={menuPortalRef}
        id={menuRootId}
        className="rounded-md border border-slate-200 bg-white text-slate-800 shadow-xl py-1 text-xs font-normal [touch-action:pan-y]"
        style={{
          position: 'fixed',
          top: menuRect.top,
          left: menuRect.left,
          width: menuRect.width,
          maxHeight: maxMenuHeightPx,
          overflowY: 'auto',
          scrollbarGutter: 'stable',
          overscrollBehavior: 'contain',
          WebkitOverflowScrolling: 'touch',
          zIndex: 9999,
        }}
        role="listbox"
        onWheel={(e) => {
          e.stopPropagation();
        }}
      >
        {options.map((opt) => {
          const ativo = opt.fieldKey === selectedFieldKey;
          return (
            <button
              key={opt.fieldKey}
              type="button"
              role="option"
              aria-selected={ativo}
              onClick={() => {
                onSelectField(opt.fieldKey);
                setMenuAberto(false);
              }}
              className={`w-full text-left px-3 py-2 hover:bg-teal-50 border-l-2 ${
                ativo ? 'border-teal-600 bg-teal-50 font-medium text-teal-900' : 'border-transparent'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>,
      document.body
    );

  return (
    <>
      <th
        ref={wrapRef}
        className={`text-left px-2 py-2 font-semibold border-b border-r border-teal-600 last:border-r-0 align-top bg-teal-700 select-none ${clsModoEdicao}`}
        style={thStyle}
      >
        <div className="flex items-start gap-1 min-w-0">
          <button
            type="button"
            onClick={onSort}
            className={`flex-1 min-w-0 flex items-center gap-1 text-left rounded px-0.5 py-0.5 hover:bg-teal-600/80 transition-colors ${clsModoEdicao}`}
            title="Ordenar por esta coluna"
          >
            <span className="truncate font-semibold leading-tight">{tituloAtual}</span>
            <ChevronDown
              className={`w-4 h-4 shrink-0 opacity-90 transition-transform ${
                ordenarAtivo && !ordemAsc ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuAberto((v) => !v);
            }}
            className={`shrink-0 p-1 rounded border shadow-sm ${
              modoAlteracao
                ? 'border-red-300/80 bg-red-900/30 hover:bg-red-800/50 text-red-100'
                : 'border-teal-500/80 bg-teal-800/40 hover:bg-teal-600 text-white'
            }`}
            title="Escolher campo exibido nesta coluna"
            aria-expanded={menuAberto}
            aria-haspopup="listbox"
          >
            <ChevronDown className="w-4 h-4" aria-hidden />
          </button>
        </div>
      </th>
      {menuPortal}
    </>
  );
}

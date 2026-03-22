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
}) {
  const [menuAberto, setMenuAberto] = useState(false);
  const wrapRef = useRef(null);
  const [menuRect, setMenuRect] = useState({ top: 0, left: 0, width: 260 });

  const tituloAtual = options.find((o) => o.fieldKey === selectedFieldKey)?.label ?? 'Último Andamento';

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
    function handleMouseDown(e) {
      if (!menuAberto) return;
      const wrap = wrapRef.current;
      const portal = document.getElementById('relatorio-ultimo-andamento-menu-root');
      if (wrap && wrap.contains(e.target)) return;
      if (portal && portal.contains(e.target)) return;
      setMenuAberto(false);
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [menuAberto]);

  useEffect(() => {
    if (!menuAberto) return;
    function onScroll() {
      setMenuAberto(false);
    }
    window.addEventListener('scroll', onScroll, true);
    return () => window.removeEventListener('scroll', onScroll, true);
  }, [menuAberto]);

  const thStyle = larguraUniforme
    ? { width: `${100 / colunasAtivasLength}%`, minWidth: 0 }
    : minWStyle;

  const menuPortal =
    menuAberto &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        id="relatorio-ultimo-andamento-menu-root"
        className="rounded-md border border-slate-200 bg-white text-slate-800 shadow-xl max-h-56 overflow-y-auto py-1 text-xs font-normal"
        style={{
          position: 'fixed',
          top: menuRect.top,
          left: menuRect.left,
          width: menuRect.width,
          zIndex: 9999,
        }}
        role="listbox"
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

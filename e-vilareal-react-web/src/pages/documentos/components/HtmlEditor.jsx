import { useEffect, useRef } from 'react';
import { Bold, Highlighter, IndentIncrease, Underline } from 'lucide-react';

const editorSurfaceClass =
  'html-editor-surface prose prose-sm max-w-none min-h-[88px] rounded-b-lg border border-t-0 border-slate-300/90 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:prose-invert dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-200 [&_mark]:bg-yellow-200 [&_p.citacao]:ml-8 [&_p.citacao]:border-l-2 [&_p.citacao]:border-slate-300 [&_p.citacao]:pl-3';

const toolbarClass =
  'flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-slate-300/90 bg-slate-50 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800/80';

const toolbarBtnClass =
  'inline-flex items-center justify-center rounded-md p-1.5 text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100';

function ToolbarButton({ title, onAction, children }) {
  return (
    <button
      type="button"
      className={toolbarBtnClass}
      title={title}
      aria-label={title}
      onMouseDown={(e) => {
        e.preventDefault();
        onAction();
      }}
    >
      {children}
    </button>
  );
}

/** Aplica formatação inline/bloco em contentEditable e devolve HTML atualizado. */
export function aplicarFormatoHtmlEditor(editor, formato) {
  if (!editor) return editor?.innerHTML || '';

  editor.focus();
  const selecao = window.getSelection();
  if (!selecao || selecao.rangeCount === 0) {
    return editor.innerHTML;
  }

  const texto = selecao.toString();

  switch (formato) {
    case 'negrito':
      document.execCommand('bold', false, null);
      break;
    case 'sublinhado':
      document.execCommand('underline', false, null);
      break;
    case 'destacado':
      document.execCommand(
        'insertHTML',
        false,
        `<mark>${texto || 'texto destacado'}</mark>`,
      );
      break;
    case 'citacao':
      document.execCommand(
        'insertHTML',
        false,
        `<p class="citacao">${texto || 'Texto da citação'}</p>`,
      );
      break;
    default:
      break;
  }

  return editor.innerHTML;
}

export function HtmlEditor({
  value,
  onChange,
  ariaLabel,
  minHeight = '120px',
}) {
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = value || '';
    if (el.innerHTML !== html) {
      el.innerHTML = html;
    }
  }, [value]);

  const aplicar = (formato) => {
    const html = aplicarFormatoHtmlEditor(ref.current, formato);
    onChange?.(html);
  };

  return (
    <div>
      <div className={toolbarClass}>
        <ToolbarButton title="Negrito" onAction={() => aplicar('negrito')}>
          <Bold className="h-4 w-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton title="Sublinhar" onAction={() => aplicar('sublinhado')}>
          <Underline className="h-4 w-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton title="Destacar" onAction={() => aplicar('destacado')}>
          <Highlighter className="h-4 w-4" aria-hidden />
        </ToolbarButton>
        <ToolbarButton title="Recuar como citação" onAction={() => aplicar('citacao')}>
          <IndentIncrease className="h-4 w-4" aria-hidden />
        </ToolbarButton>
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange?.(e.currentTarget.innerHTML)}
        className={editorSurfaceClass}
        style={{ minHeight }}
      />
    </div>
  );
}

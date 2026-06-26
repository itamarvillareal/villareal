import { useEffect, useRef } from 'react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  Bold,
  Highlighter,
  IndentIncrease,
  Italic,
  Underline,
} from 'lucide-react';

const editorSurfaceBaseClass =
  'html-editor-surface prose prose-sm max-w-none rounded-b-lg border border-t-0 border-slate-300/90 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 dark:prose-invert dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-200 [&_mark]:bg-yellow-200 [&_p.citacao]:ml-8 [&_p.citacao]:border-l-2 [&_p.citacao]:border-slate-300 [&_p.citacao]:pl-3';

const toolbarClass =
  'flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-slate-300/90 bg-slate-50 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800/80';

const toolbarBtnClass =
  'inline-flex items-center justify-center rounded-md p-1.5 text-slate-600 transition hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-slate-100';

const toolbarSelectClass =
  'h-8 max-w-[9.5rem] rounded-md border border-slate-300/90 bg-white px-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200';

const toolbarDividerClass = 'mx-0.5 h-6 w-px bg-slate-300 dark:bg-slate-600';

export const FONTES_EDITOR = [
  { label: 'Arial', value: 'Arial, sans-serif' },
  { label: 'Arial Unicode MS', value: '"Arial Unicode MS", Arial, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Calibri', value: 'Calibri, sans-serif' },
];

export const TAMANHOS_FONTE_EDITOR = [
  { label: '10 pt', value: '10pt' },
  { label: '11 pt', value: '11pt' },
  { label: '12 pt', value: '12pt' },
  { label: '13 pt', value: '13pt' },
  { label: '14 pt', value: '14pt' },
  { label: '16 pt', value: '16pt' },
];

function ToolbarButton({ title, onAction, active, children }) {
  return (
    <button
      type="button"
      className={`${toolbarBtnClass}${active ? ' bg-white text-cyan-700 ring-1 ring-cyan-500/40 dark:bg-slate-700 dark:text-cyan-300' : ''}`}
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

function blocoDaSelecao(editor) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  let node = sel.anchorNode;
  if (!node) return null;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  if (!node || !editor.contains(node)) return null;
  return node.closest?.('p, div, li, h1, h2, h3, h4') || node;
}

function mesclarEstiloInline(elemento, novosEstilos) {
  const atual = elemento.getAttribute('style') || '';
  const mapa = {};
  atual.split(';').forEach((parte) => {
    const [chave, val] = parte.split(':').map((s) => s?.trim());
    if (chave && val) mapa[chave.toLowerCase()] = val;
  });
  novosEstilos.split(';').forEach((parte) => {
    const [chave, val] = parte.split(':').map((s) => s?.trim());
    if (chave && val) mapa[chave.toLowerCase()] = val;
  });
  const merged = Object.entries(mapa)
    .map(([k, v]) => `${k}: ${v}`)
    .join('; ');
  if (merged) elemento.setAttribute('style', merged);
}

function envolverSelecaoComEstilo(editor, css) {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !editor) return;
  const range = sel.getRangeAt(0);
  if (range.collapsed) return;

  const span = document.createElement('span');
  span.setAttribute('style', css);
  try {
    range.surroundContents(span);
  } catch {
    const texto = range.toString();
    if (!texto) return;
    document.execCommand(
      'insertHTML',
      false,
      `<span style="${css}">${texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`,
    );
  }
}

function aplicarRecuoParagrafo(editor, recuo = '2cm') {
  const bloco = blocoDaSelecao(editor);
  if (!bloco) return;
  mesclarEstiloInline(bloco, `text-indent: ${recuo}; text-align: justify;`);
}

/** Aplica formatação inline/bloco em contentEditable e devolve HTML atualizado. */
export function aplicarFormatoHtmlEditor(editor, formato, valor) {
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
    case 'italico':
      document.execCommand('italic', false, null);
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
    case 'corFundo':
      if (valor) {
        document.execCommand('styleWithCSS', false, true);
        document.execCommand('hiliteColor', false, valor);
      }
      break;
    case 'centralizar':
      document.execCommand('justifyCenter', false, null);
      break;
    case 'justificar':
      document.execCommand('justifyFull', false, null);
      break;
    case 'esquerda':
      document.execCommand('justifyLeft', false, null);
      break;
    case 'recuar':
      aplicarRecuoParagrafo(editor, valor || '2cm');
      break;
    case 'citacao':
      document.execCommand(
        'insertHTML',
        false,
        `<p class="citacao">${texto || 'Texto da citação'}</p>`,
      );
      break;
    case 'fonte':
      if (valor) envolverSelecaoComEstilo(editor, `font-family: ${valor}`);
      break;
    case 'tamanho':
      if (valor) envolverSelecaoComEstilo(editor, `font-size: ${valor}`);
      break;
    default:
      break;
  }

  return editor.innerHTML;
}

function ToolbarCompleto({ onAction }) {
  return (
    <>
      <ToolbarButton title="Alinhar à esquerda" onAction={() => onAction('esquerda')}>
        <AlignLeft className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton title="Centralizar" onAction={() => onAction('centralizar')}>
        <AlignCenter className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton title="Justificar" onAction={() => onAction('justificar')}>
        <AlignJustify className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton title="Recuar parágrafo (2 cm)" onAction={() => onAction('recuar', '2cm')}>
        <IndentIncrease className="h-4 w-4" aria-hidden />
      </ToolbarButton>

      <span className={toolbarDividerClass} aria-hidden />

      <label className="sr-only" htmlFor="html-editor-fonte">
        Fonte
      </label>
      <select
        id="html-editor-fonte"
        className={toolbarSelectClass}
        defaultValue=""
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const v = e.target.value;
          if (v) onAction('fonte', v);
          e.target.value = '';
        }}
      >
        <option value="">Fonte…</option>
        {FONTES_EDITOR.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <label className="sr-only" htmlFor="html-editor-tamanho">
        Tamanho
      </label>
      <select
        id="html-editor-tamanho"
        className={toolbarSelectClass}
        defaultValue=""
        onMouseDown={(e) => e.stopPropagation()}
        onChange={(e) => {
          const v = e.target.value;
          if (v) onAction('tamanho', v);
          e.target.value = '';
        }}
      >
        <option value="">Tamanho…</option>
        {TAMANHOS_FONTE_EDITOR.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>

      <span className={toolbarDividerClass} aria-hidden />

      <ToolbarButton title="Negrito" onAction={() => onAction('negrito')}>
        <Bold className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton title="Itálico" onAction={() => onAction('italico')}>
        <Italic className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton title="Sublinhar" onAction={() => onAction('sublinhado')}>
        <Underline className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton title="Destacar (marca-texto)" onAction={() => onAction('destacado')}>
        <Highlighter className="h-4 w-4" aria-hidden />
      </ToolbarButton>

      <label
        className={`${toolbarBtnClass} relative cursor-pointer`}
        title="Cor de fundo"
        aria-label="Cor de fundo"
      >
        <span className="text-xs font-bold leading-none">A</span>
        <span
          className="absolute bottom-1 left-1/2 h-0.5 w-3 -translate-x-1/2 rounded bg-yellow-300"
          aria-hidden
        />
        <input
          type="color"
          className="absolute inset-0 cursor-pointer opacity-0"
          defaultValue="#fef08a"
          onMouseDown={(e) => e.preventDefault()}
          onChange={(e) => onAction('corFundo', e.target.value)}
        />
      </label>
    </>
  );
}

function ToolbarCompacto({ onAction }) {
  return (
    <>
      <ToolbarButton title="Negrito" onAction={() => onAction('negrito')}>
        <Bold className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton title="Itálico" onAction={() => onAction('italico')}>
        <Italic className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton title="Sublinhar" onAction={() => onAction('sublinhado')}>
        <Underline className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton title="Destacar" onAction={() => onAction('destacado')}>
        <Highlighter className="h-4 w-4" aria-hidden />
      </ToolbarButton>
      <ToolbarButton title="Recuar como citação" onAction={() => onAction('citacao')}>
        <IndentIncrease className="h-4 w-4" aria-hidden />
      </ToolbarButton>
    </>
  );
}

export function HtmlEditor({
  value,
  onChange,
  ariaLabel,
  minHeight = '120px',
  surfaceClassName,
  toolbar = 'compacto',
}) {
  const ref = useRef(null);
  const surfaceClass = surfaceClassName || editorSurfaceBaseClass;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const html = value || '';
    if (el.innerHTML !== html) {
      el.innerHTML = html;
    }
  }, [value]);

  const aplicar = (formato, valor) => {
    const html = aplicarFormatoHtmlEditor(ref.current, formato, valor);
    onChange?.(html);
  };

  return (
    <div>
      <div className={toolbarClass} role="toolbar" aria-label="Formatação de texto">
        {toolbar === 'completo' ? (
          <ToolbarCompleto onAction={aplicar} />
        ) : (
          <ToolbarCompacto onAction={aplicar} />
        )}
      </div>
      <div
        ref={ref}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        contentEditable
        suppressContentEditableWarning
        onInput={(e) => onChange?.(e.currentTarget.innerHTML)}
        className={surfaceClass}
        style={{ minHeight }}
      />
    </div>
  );
}

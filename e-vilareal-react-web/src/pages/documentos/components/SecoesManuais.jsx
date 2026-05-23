import { Plus, Trash2 } from 'lucide-react';
import { Field } from '../../../components/ui/Field.jsx';
import { PedidosEspecificos } from './PedidosEspecificos.jsx';
import { btnGhost, fieldErrorClass, inputClass, textareaClass } from '../documentosStyles.js';

export function SecoesManuais({ values, onChange, errors = {} }) {
  const secoes = values.secoes?.length
    ? values.secoes
    : [{ titulo: 'DOS FATOS', conteudo: '' }, { titulo: 'DO DIREITO', conteudo: '' }];

  const atualizarSecao = (index, patch) => {
    const next = secoes.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChange({ secoes: next });
  };

  const adicionarSecao = () => {
    onChange({ secoes: [...secoes, { titulo: '', conteudo: '' }] });
  };

  const removerSecao = (index) => {
    if (secoes.length <= 1) return;
    onChange({ secoes: secoes.filter((_, i) => i !== index) });
  };

  return (
    <div className="grid gap-6">
      <Field label="Preâmbulo (qualificação das partes) *">
        <textarea
          className={`${textareaClass} min-h-[140px] font-mono text-xs`}
          value={values.preambulo}
          onChange={(e) => onChange({ preambulo: e.target.value })}
          placeholder="HTML: &lt;strong&gt;FULANO&lt;/strong&gt;, brasileiro…"
        />
        {errors.preambulo && <p className={fieldErrorClass}>{errors.preambulo}</p>}
      </Field>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Seções *</h3>
          <button type="button" className={btnGhost} onClick={adicionarSecao}>
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Adicionar seção
          </button>
        </div>
        {errors.secoes && <p className={`${fieldErrorClass} mb-2`}>{errors.secoes}</p>}
        <div className="space-y-4">
          {secoes.map((secao, index) => (
            <div
              key={index}
              className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-700 dark:bg-slate-900/30"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <Field label="Título" className="flex-1">
                  <input
                    className={inputClass}
                    value={secao.titulo}
                    onChange={(e) => atualizarSecao(index, { titulo: e.target.value })}
                    placeholder="DOS FATOS"
                  />
                </Field>
                <button
                  type="button"
                  className={`${btnGhost} mt-6 text-red-600`}
                  onClick={() => removerSecao(index)}
                  disabled={secoes.length <= 1}
                  title="Remover seção"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <Field label="Conteúdo (HTML)">
                <textarea
                  className={`${textareaClass} min-h-[120px] font-mono text-xs`}
                  value={secao.conteudo}
                  onChange={(e) => atualizarSecao(index, { conteudo: e.target.value })}
                  placeholder="&lt;p&gt;Parágrafo…&lt;/p&gt;"
                />
              </Field>
            </div>
          ))}
        </div>
      </div>

      <PedidosEspecificos
        pedidos={values.pedidos}
        onChange={(pedidos) => onChange({ pedidos })}
        label="Pedidos *"
      />
      {errors.pedidos && <p className={fieldErrorClass}>{errors.pedidos}</p>}
    </div>
  );
}

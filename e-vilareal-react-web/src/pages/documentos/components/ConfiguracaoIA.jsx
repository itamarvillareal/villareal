import { Field } from '../../../components/ui/Field.jsx';
import { PedidosEspecificos } from './PedidosEspecificos.jsx';
import { textareaClass } from '../documentosStyles.js';

export function ConfiguracaoIA({ values, onChange }) {
  return (
    <div className="grid gap-4">
      <Field label="Fundamentação adicional">
        <textarea
          className={textareaClass}
          value={values.fundamentacaoAdicional}
          onChange={(e) => onChange({ fundamentacaoAdicional: e.target.value })}
          placeholder="Teses jurídicas específicas que a IA deve considerar…"
        />
      </Field>

      <Field label="Modelo base">
        <textarea
          className={`${textareaClass} min-h-[120px]`}
          value={values.modeloBase}
          onChange={(e) => onChange({ modeloBase: e.target.value })}
          placeholder="Texto de referência de outra petição (estrutura e estilo)…"
        />
      </Field>

      <Field label="Instruções adicionais">
        <textarea
          className={textareaClass}
          value={values.instrucoesAdicionais}
          onChange={(e) => onChange({ instrucoesAdicionais: e.target.value })}
          placeholder="Qualquer orientação extra para a IA…"
        />
      </Field>

      <PedidosEspecificos
        pedidos={values.pedidosEspecificos}
        onChange={(pedidosEspecificos) => onChange({ pedidosEspecificos })}
      />
    </div>
  );
}

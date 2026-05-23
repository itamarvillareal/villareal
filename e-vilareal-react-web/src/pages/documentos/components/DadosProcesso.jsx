import { Field } from '../../../components/ui/Field.jsx';
import { ENDERECAMENTOS } from '../constants.js';
import { fieldErrorClass, inputClass } from '../documentosStyles.js';

export function DadosProcesso({ values, onChange, errors = {} }) {
  const usarOutro = values.enderecamentoSelect === '__outro__';

  return (
    <div className="grid gap-4">
      <Field label="Endereçamento *">
        <select
          className={inputClass}
          value={values.enderecamentoSelect}
          onChange={(e) => onChange({ enderecamentoSelect: e.target.value })}
        >
          <option value="">Selecione o juízo…</option>
          {ENDERECAMENTOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
          <option value="__outro__">Outro (digitar)</option>
        </select>
        {errors.enderecamento && <p className={fieldErrorClass}>{errors.enderecamento}</p>}
      </Field>

      {usarOutro && (
        <Field label="Endereçamento (texto livre) *">
          <input
            className={inputClass}
            value={values.enderecamentoOutro}
            onChange={(e) => onChange({ enderecamentoOutro: e.target.value })}
            placeholder="MERITÍSSIMO JUÍZO…"
          />
        </Field>
      )}

      <Field label="Número do processo (opcional)">
        <input
          className={inputClass}
          value={values.numeroProcesso}
          onChange={(e) => onChange({ numeroProcesso: e.target.value })}
          placeholder="Deixe vazio para petição inicial"
        />
      </Field>
    </div>
  );
}

export function resolveEnderecamento(values) {
  if (values.enderecamentoSelect === '__outro__') {
    return (values.enderecamentoOutro || '').trim();
  }
  return (values.enderecamentoSelect || '').trim();
}

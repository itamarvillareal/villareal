import { Plus, Trash2 } from 'lucide-react';
import { Field } from '../../../components/ui/Field.jsx';
import { btnGhost, inputClass } from '../documentosStyles.js';

export function PedidosEspecificos({ pedidos, onChange, label = 'Pedidos específicos (opcional)' }) {
  const lista = pedidos?.length ? pedidos : [''];

  const atualizar = (index, valor) => {
    const next = [...lista];
    next[index] = valor;
    onChange(next);
  };

  const adicionar = () => onChange([...lista, '']);

  const remover = (index) => {
    if (lista.length <= 1) {
      onChange(['']);
      return;
    }
    onChange(lista.filter((_, i) => i !== index));
  };

  return (
    <Field label={label}>
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        Se vazio, a IA define os pedidos automaticamente.
      </p>
      <div className="space-y-2">
        {lista.map((pedido, index) => (
          <div key={index} className="flex gap-2">
            <input
              className={inputClass}
              value={pedido}
              onChange={(e) => atualizar(index, e.target.value)}
              placeholder={`Pedido ${index + 1}`}
            />
            <button
              type="button"
              className={`${btnGhost} shrink-0 text-red-600`}
              onClick={() => remover(index)}
              title="Remover pedido"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ))}
        <button type="button" className={btnGhost} onClick={adicionar}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Adicionar pedido
        </button>
      </div>
    </Field>
  );
}

export function pedidosPreenchidos(pedidos) {
  return (pedidos || [])
    .map((p) => String(p ?? '').trim().replace(/^[a-z]\)\s*/i, ''))
    .filter(Boolean);
}

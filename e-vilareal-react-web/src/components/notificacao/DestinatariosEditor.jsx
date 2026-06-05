import { Plus, Trash2 } from 'lucide-react';
import { formatPhoneDisplay } from '../../utils/whatsappFormat.js';
import { processosBtnGhost, processosInputDenseClass } from '../processos/ProcessosAdminLayout.jsx';

const LISTA =
  'rounded-lg border border-slate-200 dark:border-white/10 bg-white/80 dark:bg-[#0d1018]/60 p-3 space-y-2';

/**
 * Editor de listas WhatsApp e e-mail.
 * @param {{
 *   value: { whatsapp: string[], email: string[] },
 *   onChange?: (next: { whatsapp: string[], email: string[] }) => void,
 *   readOnly?: boolean,
 * }} props
 */
export function DestinatariosEditor({ value, onChange, readOnly = false }) {
  const whatsapp = Array.isArray(value?.whatsapp) ? value.whatsapp : [];
  const email = Array.isArray(value?.email) ? value.email : [];
  const ro = Boolean(readOnly);

  function emit(nextWa, nextEm) {
    onChange?.({ whatsapp: nextWa, email: nextEm });
  }

  function atualizarLista(canal, index, texto) {
    if (ro) return;
    const lista = canal === 'whatsapp' ? [...whatsapp] : [...email];
    lista[index] = texto;
    if (canal === 'whatsapp') emit(lista, email);
    else emit(whatsapp, lista);
  }

  function remover(canal, index) {
    if (ro) return;
    if (canal === 'whatsapp') {
      emit(
        whatsapp.filter((_, i) => i !== index),
        email,
      );
    } else {
      emit(
        whatsapp,
        email.filter((_, i) => i !== index),
      );
    }
  }

  function adicionar(canal) {
    if (ro) return;
    if (canal === 'whatsapp') emit([...whatsapp, ''], email);
    else emit(whatsapp, [...email, '']);
  }

  function renderLista(titulo, canal, itens, placeholder) {
    return (
      <div className={LISTA}>
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-200">{titulo}</h4>
          {!ro ? (
            <button
              type="button"
              className={processosBtnGhost}
              onClick={() => adicionar(canal)}
            >
              <Plus className="w-3.5 h-3.5" aria-hidden />
              Adicionar
            </button>
          ) : null}
        </div>
        {itens.length === 0 ? (
          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">Nenhum cadastrado.</p>
        ) : (
          <ul className="space-y-2">
            {itens.map((item, index) => (
              <li key={`${canal}-${index}`} className="flex gap-2 items-center">
                {ro ? (
                  <span className="flex-1 text-sm text-slate-800 dark:text-slate-100 py-2 px-2.5 rounded-lg bg-slate-50 dark:bg-white/5 font-mono break-all">
                    {canal === 'whatsapp'
                      ? formatPhoneDisplay(String(item).replace(/\D/g, '')) || item
                      : item}
                  </span>
                ) : (
                  <input
                    type={canal === 'email' ? 'email' : 'tel'}
                    className={`${processosInputDenseClass} flex-1 font-mono text-xs`}
                    placeholder={placeholder}
                    value={item}
                    onChange={(e) => atualizarLista(canal, index, e.target.value)}
                    autoComplete="off"
                  />
                )}
                {!ro ? (
                  <button
                    type="button"
                    className={processosBtnGhost}
                    title="Remover"
                    onClick={() => remover(canal, index)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" aria-hidden />
                    <span className="sr-only">Remover</span>
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {renderLista('WhatsApp', 'whatsapp', whatsapp, '+55 62 99999-9999')}
      {renderLista('E-mail', 'email', email, 'nome@escritorio.com.br')}
    </div>
  );
}

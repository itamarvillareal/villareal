import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  MODULOS_PERMISSAO,
  getPermissoesUsuario,
  savePermissoesUsuario,
} from '../data/usuarioPermissoesStorage.js';

/**
 * @param {{ open: boolean, usuario: { id: string, nome: string } | null, onClose: () => void }} props
 */
export function ModalPermissoesUsuario({ open, usuario, onClose }) {
  const [checks, setChecks] = useState(() =>
    Object.fromEntries(MODULOS_PERMISSAO.map((m) => [m.id, true]))
  );

  useEffect(() => {
    if (!open || !usuario?.id) return;
    setChecks(getPermissoesUsuario(usuario.id));
  }, [open, usuario?.id]);

  if (!open || !usuario) return null;

  function toggle(id) {
    setChecks((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function salvar() {
    const algum = MODULOS_PERMISSAO.some((m) => checks[m.id]);
    if (!algum) {
      window.alert('Marque pelo menos um módulo de acesso.');
      return;
    }
    savePermissoesUsuario(usuario.id, checks);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="perm-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 shrink-0">
          <h2 id="perm-modal-title" className="text-base font-semibold text-slate-800">
            Permissões — {usuario.nome}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="px-4 pt-3 text-xs text-slate-600">
          Defina quais áreas do sistema este usuário pode acessar com o perfil selecionado na barra lateral. O perfil
          ativo determina o menu e as telas liberadas.
        </p>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {MODULOS_PERMISSAO.map((m) => (
            <label
              key={m.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 cursor-pointer hover:bg-slate-100"
            >
              <input
                type="checkbox"
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                checked={!!checks[m.id]}
                onChange={() => toggle(m.id)}
              />
              <span className="text-sm text-slate-800">{m.label}</span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={salvar}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

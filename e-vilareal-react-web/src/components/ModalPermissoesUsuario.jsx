import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  MODULOS_PERMISSAO,
} from '../data/usuarioPermissoesStorage.js';
import {
  carregarPermissoesUsuario,
  salvarPermissoesUsuarioApi,
} from '../repositories/perfisPermissoesRepository.js';

/**
 * @param {{ open: boolean, usuario: { id: string, nome: string } | null, onClose: () => void }} props
 */
export function ModalPermissoesUsuario({ open, usuario, onClose }) {
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [checks, setChecks] = useState(() =>
    Object.fromEntries(MODULOS_PERMISSAO.map((m) => [m.id, true]))
  );

  useEffect(() => {
    if (!open || !usuario?.id) return;
    let cancelado = false;
    setCarregando(true);
    setErro('');
    (async () => {
      try {
        const data = await carregarPermissoesUsuario(usuario.id);
        if (!cancelado) setChecks(data);
      } catch (e) {
        if (!cancelado) setErro(e?.message || 'Erro ao carregar permissões.');
      } finally {
        if (!cancelado) setCarregando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [open, usuario?.id]);

  if (!open || !usuario) return null;

  function toggle(id) {
    setChecks((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  async function salvar() {
    const algum = MODULOS_PERMISSAO.some((m) => checks[m.id]);
    if (!algum) {
      window.alert('Marque pelo menos um módulo de acesso.');
      return;
    }
    try {
      await salvarPermissoesUsuarioApi(usuario.id, checks);
      onClose();
    } catch (e) {
      setErro(e?.message || 'Erro ao salvar permissões.');
    }
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
          {carregando ? <p className="text-xs text-slate-500">Carregando permissões...</p> : null}
          {erro ? <p className="text-xs text-red-700">{erro}</p> : null}
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
            onClick={() => void salvar()}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

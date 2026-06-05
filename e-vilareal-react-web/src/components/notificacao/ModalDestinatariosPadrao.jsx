import { useEffect, useState } from 'react';
import { Bell, Loader2, X } from 'lucide-react';
import {
  copiarDestinatariosCanais,
  destinatariosVazio,
  normalizarDestinatariosParaSalvar,
  validarDestinatariosAntesSalvar,
} from '../../domain/destinatariosNotificacao.js';
import {
  getDestinatariosPadrao,
  putDestinatariosPadrao,
} from '../../repositories/notificacaoRepository.js';
import {
  processosBtnIndigo,
  processosBtnSecondary,
} from '../processos/ProcessosAdminLayout.jsx';
import { DestinatariosEditor } from './DestinatariosEditor.jsx';

/**
 * Modal de destinatários padrão global (consultas periódicas).
 * @param {{ open: boolean, onClose?: () => void, onSaved?: () => void }} props
 */
export function ModalDestinatariosPadrao({ open, onClose, onSaved }) {
  const [valor, setValor] = useState(destinatariosVazio);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    setErro('');
    setCarregando(true);
    void getDestinatariosPadrao()
      .then((dto) => {
        if (!cancelado) setValor(copiarDestinatariosCanais(dto));
      })
      .catch((e) => {
        if (!cancelado) {
          setErro(e?.message || 'Falha ao carregar destinatários padrão.');
          setValor(destinatariosVazio());
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [open]);

  async function salvar() {
    const { ok, erros } = validarDestinatariosAntesSalvar(valor);
    if (!ok) {
      setErro(erros.join(' '));
      return;
    }
    setSalvando(true);
    setErro('');
    try {
      const body = normalizarDestinatariosParaSalvar(valor);
      const salvo = await putDestinatariosPadrao(body);
      setValor(copiarDestinatariosCanais(salvo));
      onSaved?.();
      onClose?.();
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar destinatários padrão.');
    } finally {
      setSalvando(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-destinatarios-padrao-titulo"
    >
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#141c2c] shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-100 dark:border-white/10 bg-white dark:bg-[#141c2c] px-4 py-3">
          <h2
            id="modal-destinatarios-padrao-titulo"
            className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-100"
          >
            <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" aria-hidden />
            Destinatários padrão
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Números e e-mails usados nas notificações de novidade do monitor PROJUDI, quando o processo não
            tiver override.
          </p>

          {erro ? (
            <p className="text-xs text-red-700 dark:text-red-300 rounded border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/30 px-2 py-1.5">
              {erro}
            </p>
          ) : null}

          {carregando ? (
            <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 py-6 justify-center">
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden />
              Carregando…
            </p>
          ) : (
            <DestinatariosEditor value={valor} onChange={setValor} readOnly={false} />
          )}

          <div className="flex flex-wrap justify-end gap-2 pt-2 border-t border-slate-100 dark:border-white/10">
            <button type="button" className={processosBtnSecondary} onClick={onClose} disabled={salvando}>
              Cancelar
            </button>
            <button
              type="button"
              className={processosBtnIndigo}
              disabled={carregando || salvando}
              onClick={() => void salvar()}
            >
              {salvando ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              ) : null}
              Salvar padrão
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

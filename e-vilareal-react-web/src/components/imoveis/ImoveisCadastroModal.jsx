import { useEffect } from 'react';
import { X } from 'lucide-react';
import { Imoveis } from '../Imoveis.jsx';
import { imoveisBtnIconGhost } from './ImoveisAdminLayout.jsx';

/**
 * Formulário flutuante com o mesmo cadastro da tela Imóveis.
 */
export function ImoveisCadastroModal({ open, imovelId, onClose, onCadastroSalvo }) {
  useEffect(() => {
    if (!open) return undefined;
    function onKeyDown(e) {
      if (e.key === 'Escape') onClose?.();
    }
    document.addEventListener('keydown', onKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || imovelId == null) return null;

  const id = Number(imovelId);
  if (!Number.isFinite(id) || id <= 0) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center p-3 sm:p-5 bg-black/50 backdrop-blur-sm"
      onClick={() => onClose?.()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-cadastro-imovel-titulo"
        className="relative w-full max-w-[1600px] max-h-[min(94vh,100%)] flex flex-col rounded-2xl border border-slate-200/90 dark:border-white/10 bg-slate-100 dark:bg-[#0c1017] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-200/80 dark:border-white/[0.08] bg-white/95 dark:bg-[#141c2c] shrink-0">
          <div className="min-w-0">
            <h2 id="modal-cadastro-imovel-titulo" className="text-base font-semibold text-slate-900 dark:text-white">
              Cadastro do imóvel #{id}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Mesma tela de Imóveis — duplo clique na linha do relatório para editar sem sair da página.
            </p>
          </div>
          <button type="button" onClick={() => onClose?.()} className={imoveisBtnIconGhost} aria-label="Fechar cadastro">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <Imoveis modoModal imovelIdInicial={id} onFecharModal={onClose} onCadastroSalvo={onCadastroSalvo} />
        </div>
      </div>
    </div>
  );
}

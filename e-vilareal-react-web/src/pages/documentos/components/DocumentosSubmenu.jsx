import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ClipboardCheck } from 'lucide-react';
import { useUsuarioPerfil } from '../../../hooks/useUsuarioPerfil.js';
import { ModalConferenciaContratosHonorarios } from '../../../components/contratos/ModalConferenciaContratosHonorarios.jsx';

export function subNavClassDocumentos(isActive) {
  const base =
    'inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition-colors border';
  if (isActive) {
    return (
      base +
      ' border-cyan-500 dark:border-cyan-400 bg-cyan-50 dark:bg-cyan-500/15 text-cyan-800 dark:text-cyan-100 shadow-sm'
    );
  }
  return (
    base +
    ' border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
  );
}

export function DocumentosSubmenu() {
  const { isAdmin } = useUsuarioPerfil();
  const [conferenciaAberta, setConferenciaAberta] = useState(false);

  return (
    <>
      <nav aria-label="Submenu Documentos" className="mb-4 flex flex-wrap gap-2">
        <NavLink to="/documentos/gerar" end className={({ isActive }) => subNavClassDocumentos(isActive)}>
          Gerar documento
        </NavLink>
        {isAdmin ? (
          <NavLink to="/documentos/modelos" className={({ isActive }) => subNavClassDocumentos(isActive)}>
            Modelos de petição
          </NavLink>
        ) : null}
        <button
          type="button"
          onClick={() => setConferenciaAberta(true)}
          className={subNavClassDocumentos(false) + ' cursor-pointer'}
        >
          <ClipboardCheck className="mr-1.5 inline h-4 w-4" aria-hidden />
          Conferir importações
        </button>
      </nav>
      <ModalConferenciaContratosHonorarios
        open={conferenciaAberta}
        onClose={() => setConferenciaAberta(false)}
      />
    </>
  );
}

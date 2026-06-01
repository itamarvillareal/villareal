import { isAssistenteIaUsuario } from '../../data/usuarioDisplayHelpers.js';

/** Selo discreto para autoria de assistente de IA. */
export function SeloAssistenteIa({ className = '' }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide text-violet-800 bg-violet-100 ring-1 ring-violet-200/80 ${className}`}
      title="Assistente de IA"
    >
      IA
    </span>
  );
}

/**
 * Nome de autor com selo IA quando aplicável.
 * @param {{ rotulo?: string, usuario?: object|null, isAssistenteIa?: boolean, className?: string }} props
 */
export function AutorUsuarioExibicao({ rotulo = '—', usuario = null, isAssistenteIa, className = '' }) {
  const ia = isAssistenteIa ?? isAssistenteIaUsuario(usuario);
  return (
    <span className={`inline-flex items-center gap-1 min-w-0 ${className}`}>
      <span className="truncate">{rotulo || '—'}</span>
      {ia ? <SeloAssistenteIa /> : null}
    </span>
  );
}

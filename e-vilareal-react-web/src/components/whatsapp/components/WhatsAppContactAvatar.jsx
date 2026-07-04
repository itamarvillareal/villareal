import { formatPhoneDisplay, normalizePhoneForApi } from '../../../utils/whatsappFormat.js';
import { iniciaisContato } from '../../../utils/iniciais.js';
import { corAvatarPorChave } from '../../../utils/avatarColor.js';

const SIZE_CLASS = {
  sm: 'w-8 h-8 text-xs',
  md: 'w-10 h-10 text-sm',
};

function rotuloAcessivel(nome, telefone) {
  const nomeLimpo = String(nome ?? '').trim();
  if (nomeLimpo) return nomeLimpo;
  return formatPhoneDisplay(telefone) || 'Contato';
}

/**
 * Avatar circular com iniciais (estilo Gmail). Cor determinística por telefone.
 *
 * @param {{ nome?: string|null, telefone?: string|null, size?: 'sm'|'md', className?: string }} props
 */
export function WhatsAppContactAvatar({ nome, telefone, size = 'md', className = '' }) {
  const chaveTelefone = normalizePhoneForApi(telefone) || String(telefone ?? '').trim();
  const label = rotuloAcessivel(nome, telefone);
  const iniciais = iniciaisContato(nome, telefone);
  const cor = corAvatarPorChave(chaveTelefone);
  const sizeClass = SIZE_CLASS[size] ?? SIZE_CLASS.md;

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold shrink-0 select-none ${sizeClass} ${cor} ${className}`.trim()}
      title={label}
      aria-label={`Avatar de ${label}`}
    >
      {iniciais}
    </div>
  );
}

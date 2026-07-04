import { useEffect, useState } from 'react';
import { formatPhoneDisplay, normalizePhoneForApi } from '../../../utils/whatsappFormat.js';
import { iniciaisContato } from '../../../utils/iniciais.js';
import { corAvatarPorChave } from '../../../utils/avatarColor.js';
import { useWhatsAppContactPhotoUrl } from '../hooks/useWhatsAppContactPhotoUrl.js';

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
 * Avatar circular: foto manual via proxy autenticado, ou iniciais (estilo Gmail).
 *
 * @param {{ nome?: string|null, telefone?: string|null, contactPhotoUrl?: string|null, size?: 'sm'|'md', className?: string }} props
 */
export function WhatsAppContactAvatar({
  nome,
  telefone,
  contactPhotoUrl = null,
  size = 'md',
  className = '',
}) {
  const chaveTelefone = normalizePhoneForApi(telefone) || String(telefone ?? '').trim();
  const label = rotuloAcessivel(nome, telefone);
  const iniciais = iniciaisContato(nome, telefone);
  const cor = corAvatarPorChave(chaveTelefone);
  const sizeClass = SIZE_CLASS[size] ?? SIZE_CLASS.md;
  const proxyUrl = String(contactPhotoUrl ?? '').trim() || null;
  const { url: photoBlobUrl, loading: photoLoading } = useWhatsAppContactPhotoUrl(telefone, proxyUrl);
  const [photoFailed, setPhotoFailed] = useState(false);

  useEffect(() => {
    setPhotoFailed(false);
  }, [proxyUrl, chaveTelefone]);

  const showPhoto = Boolean(proxyUrl && photoBlobUrl && !photoFailed && !photoLoading);

  if (showPhoto) {
    return (
      <img
        src={photoBlobUrl}
        alt=""
        title={label}
        aria-label={`Avatar de ${label}`}
        className={`rounded-full object-cover shrink-0 select-none ${sizeClass} ${className}`.trim()}
        onError={() => setPhotoFailed(true)}
      />
    );
  }

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

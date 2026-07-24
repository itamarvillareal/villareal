import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Pencil } from 'lucide-react';
import {
  getLogoSistemaSrc,
  limparLogoSistemaCustomizada,
  lerArquivoLogoComoDataUrl,
  getLogoInstanciaDefault,
  LOGO_SISTEMA_EVENT,
  setLogoSistemaCustomizada,
  getLogoSistemaCustomizada,
} from '../../data/logoSistemaStorage.js';
import { isPortal1Instancia } from '../../config/instanciaPortal.js';

/**
 * Logo do menu lateral com botão de editar no canto (aparece no hover).
 */
export function SidebarLogo() {
  const [src, setSrc] = useState(() => getLogoSistemaSrc());
  const [temCustom, setTemCustom] = useState(() => Boolean(getLogoSistemaCustomizada()));
  const [erro, setErro] = useState('');
  const fileRef = useRef(null);

  useEffect(() => {
    const sync = () => {
      setSrc(getLogoSistemaSrc());
      setTemCustom(Boolean(getLogoSistemaCustomizada()));
    };
    window.addEventListener(LOGO_SISTEMA_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(LOGO_SISTEMA_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  async function onArquivo(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setErro('');
    try {
      const dataUrl = await lerArquivoLogoComoDataUrl(file);
      setLogoSistemaCustomizada(dataUrl);
    } catch (err) {
      setErro(err?.message || 'Não foi possível atualizar a logo.');
    }
  }

  function onEditar(e) {
    e.preventDefault();
    e.stopPropagation();
    setErro('');
    fileRef.current?.click();
  }

  function onRestaurar(e) {
    e.preventDefault();
    e.stopPropagation();
    setErro('');
    limparLogoSistemaCustomizada();
  }

  const instanciaPortal1 = isPortal1Instancia();
  const logoPadrao = getLogoInstanciaDefault();

  return (
    <div className="vl-sidebar-header shrink-0 border-b border-gray-300 bg-gray-100 px-2 py-1.5">
      <div className="relative">
        <Link
          to="/"
          className="block rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-100 dark:focus-visible:ring-offset-[#0f141c]"
          title="Ir para a agenda"
        >
          <img
            src={src}
            alt={instanciaPortal1 ? 'FFM Advogados & Associados' : 'Logo do sistema'}
            className={`mx-auto w-full object-contain object-center ${
              instanciaPortal1 ? 'max-h-[3.25rem]' : 'max-h-[2.85rem]'
            }`}
            width={200}
            height={88}
            decoding="async"
            onError={(ev) => {
              if (ev.currentTarget.src !== logoPadrao) {
                ev.currentTarget.src = logoPadrao;
              }
            }}
          />
        </Link>

        {!instanciaPortal1 ? (
          <>
        {/* Zona do canto superior direito: o lápis só aparece ao passar o mouse nessa área */}
        <div className="group/corner absolute right-0 top-0 z-10 flex h-8 w-8 items-start justify-end">
          <button
            type="button"
            onClick={onEditar}
            className="flex h-7 w-7 items-center justify-center rounded-full border border-gray-300 bg-white text-gray-700 opacity-0 shadow-sm transition-opacity hover:bg-cyan-50 hover:text-cyan-800 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 group-hover/corner:opacity-100 dark:border-white/20 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-cyan-950 dark:hover:text-cyan-200"
            title={temCustom ? 'Trocar imagem da logo' : 'Editar imagem da logo'}
            aria-label="Editar imagem da logo"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
          </button>
        </div>

        {temCustom ? (
          <div className="group/reset absolute bottom-0 left-0 z-10 flex h-7 w-14 items-end">
            <button
              type="button"
              onClick={onRestaurar}
              className="rounded-md border border-gray-300 bg-white/95 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 opacity-0 shadow-sm transition-opacity hover:bg-gray-50 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/60 group-hover/reset:opacity-100 dark:border-white/20 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Restaurar logo padrão"
            >
              Padrão
            </button>
          </div>
        ) : null}

        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
          className="hidden"
          onChange={(e) => void onArquivo(e)}
        />
          </>
        ) : null}
      </div>
      {erro ? (
        <p className="mt-1 px-0.5 text-[10px] leading-tight text-rose-600 dark:text-rose-400" role="alert">
          {erro}
        </p>
      ) : null}
    </div>
  );
}

/** Hook leve para sincronizar a logo em outros pontos (ex.: header mobile). */
export function useLogoSistemaSrc() {
  const [src, setSrc] = useState(() => getLogoSistemaSrc());
  useEffect(() => {
    const sync = () => setSrc(getLogoSistemaSrc());
    window.addEventListener(LOGO_SISTEMA_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(LOGO_SISTEMA_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return src;
}

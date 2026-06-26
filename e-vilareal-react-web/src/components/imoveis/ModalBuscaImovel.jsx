import { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape.js';
import { listarImoveisApi } from '../../repositories/imoveisRepository.js';
import { featureFlags } from '../../config/featureFlags.js';
import { imovelCorrespondeBusca } from './imovelBusca.js';
import { imoveisBtnIconGhost, imoveisInputClass } from './ImoveisAdminLayout.jsx';

function rotuloImovelLinha(im) {
  const cond = String(im?.condominio ?? '').trim() || '—';
  const un = String(im?.unidade ?? '').trim();
  return un ? `${cond} · ${un}` : cond;
}

/**
 * Modal para localizar imóvel no cadastro (condomínio, unidade, nº planilha).
 *
 * @param {{ open: boolean, onClose: () => void, onSelecionar: (imovel: object) => void }} props
 */
export function ModalBuscaImovel({ open, onClose, onSelecionar }) {
  const [lista, setLista] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [termo, setTermo] = useState('');
  const inputRef = useRef(null);

  useCloseOnEscape(open, onClose, { lockScroll: true });

  useEffect(() => {
    if (!open) return undefined;
    setTermo('');
    setErro('');
    if (!featureFlags.useApiImoveis) {
      setLista([]);
      setErro('API de imóveis desligada — não é possível listar o cadastro.');
      return undefined;
    }
    let cancelado = false;
    setCarregando(true);
    void listarImoveisApi()
      .then((arr) => {
        if (!cancelado) setLista(Array.isArray(arr) ? arr : []);
      })
      .catch((e) => {
        if (!cancelado) {
          setLista([]);
          setErro(e?.message || 'Falha ao carregar imóveis.');
        }
      })
      .finally(() => {
        if (!cancelado) setCarregando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [open]);

  const resultados = useMemo(() => {
    const q = termo.trim();
    const base = lista.filter((im) => {
      const np = Number(im?.numeroPlanilha);
      return Number.isFinite(np) && np >= 1;
    });
    if (!q) return base.slice(0, 80);
    return base.filter((im) => imovelCorrespondeBusca(im, q)).slice(0, 80);
  }, [lista, termo]);

  if (!open) return null;

  function selecionar(im) {
    onSelecionar?.(im);
  }

  return (
    <div
      className="fixed inset-0 z-[220] flex items-start justify-center p-3 sm:p-6 bg-black/50 backdrop-blur-sm"
      onClick={() => onClose?.()}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-busca-imovel-titulo"
        className="relative flex w-full max-w-2xl max-h-[min(88vh,720px)] flex-col rounded-2xl border border-slate-200/90 bg-white shadow-2xl dark:border-white/10 dark:bg-[#141c2c] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 px-4 py-3 dark:border-white/[0.08] shrink-0">
          <div className="min-w-0">
            <h2 id="modal-busca-imovel-titulo" className="text-base font-semibold text-slate-900 dark:text-white">
              Buscar imóvel no cadastro
            </h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Pesquise por condomínio, unidade ou nº da planilha (col. A). Clique na linha para vincular ao processo.
            </p>
          </div>
          <button type="button" onClick={() => onClose?.()} className={imoveisBtnIconGhost} aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-100 dark:border-white/[0.06] shrink-0">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              ref={inputRef}
              type="search"
              value={termo}
              onChange={(e) => setTermo(e.target.value)}
              placeholder="Ex.: Veredas 1101, nome do condomínio ou 1803"
              autoComplete="off"
              className={`${imoveisInputClass} pl-9`}
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-2 py-2">
          {carregando ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-slate-600 dark:text-slate-400">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              Carregando cadastro de imóveis…
            </div>
          ) : erro ? (
            <p className="px-2 py-8 text-center text-sm text-red-700 dark:text-red-300">{erro}</p>
          ) : resultados.length === 0 ? (
            <p className="px-2 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              {termo.trim() ? 'Nenhum imóvel encontrado para esta busca.' : 'Nenhum imóvel com nº da planilha no cadastro.'}
            </p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/[0.06]" role="listbox" aria-label="Resultados">
              {resultados.map((im) => (
                <li key={im.id ?? im.numeroPlanilha} role="presentation">
                  <button
                    type="button"
                    role="option"
                    className="flex w-full flex-col items-start gap-0.5 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-sky-50 dark:hover:bg-white/[0.06] focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                    onClick={() => selecionar(im)}
                  >
                    <span className="font-medium text-slate-900 dark:text-slate-50">{rotuloImovelLinha(im)}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Nº planilha <strong className="font-semibold text-sky-800 dark:text-sky-300">{im.numeroPlanilha}</strong>
                      {im.enderecoCompleto ? ` · ${String(im.enderecoCompleto).trim()}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!carregando && !erro && termo.trim() && resultados.length >= 80 ? (
            <p className="px-3 py-2 text-center text-[11px] text-slate-500">Mostrando os primeiros 80 resultados — refine a busca.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

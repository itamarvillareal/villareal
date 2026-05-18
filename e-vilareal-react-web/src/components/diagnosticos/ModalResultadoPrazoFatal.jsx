import { useEffect, useMemo, useState } from 'react';
import { Copy, Search, X } from 'lucide-react';

function normalizarBusca(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Formata CNJ de 20 dígitos para exibição; mantém valor já formatado. */
export function formatarNumeroCnjExibicao(num) {
  const s = String(num ?? '').trim();
  if (!s) return '';
  if (/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(s)) return s;
  const d = s.replace(/\D/g, '');
  if (d.length !== 20) return s;
  return `${d.slice(0, 7)}-${d.slice(7, 9)}.${d.slice(9, 13)}.${d.slice(13, 14)}.${d.slice(14, 16)}.${d.slice(16, 20)}`;
}

function textoPartes(item) {
  const autor = String(item.parteCliente || item.cliente || 'CLIENTE').trim();
  const reu = String(item.parteOposta || 'PARTE OPOSTA').trim();
  return `${autor} x ${reu}`;
}

function itemCorrespondeBusca(item, termoNorm) {
  if (!termoNorm) return true;
  const cnj = formatarNumeroCnjExibicao(item.numeroProcessoNovo);
  const hay = normalizarBusca(
    [
      item.codCliente,
      item.proc,
      item.cliente,
      item.parteCliente,
      item.parteOposta,
      item.numeroProcessoNovo,
      cnj,
      item.prazoFatal,
    ].join(' '),
  );
  const digitsHay = hay.replace(/\D/g, '');
  const digitsTerm = termoNorm.replace(/\D/g, '');
  if (digitsTerm.length >= 4 && digitsHay.includes(digitsTerm)) return true;
  return hay.includes(termoNorm);
}

function montarTextoListaCopiavel(itens) {
  return itens
    .map((item, idx) => {
      const cnj = formatarNumeroCnjExibicao(item.numeroProcessoNovo) || 'sem nº';
      return [
        `${String(idx + 1).padStart(3, '0')}`,
        `Cod. ${item.codCliente}`,
        `Proc. ${String(item.proc).padStart(2, '0')}`,
        textoPartes(item),
        cnj,
        `Prazo fatal: ${item.prazoFatal ?? '—'}`,
      ].join(' | ');
    })
    .join('\n');
}

function PrazoFatalCard({ item, indice, onDoubleClick }) {
  const cnj = formatarNumeroCnjExibicao(item.numeroProcessoNovo);
  const cnjLabel = cnj || 'Sem número CNJ';

  return (
    <article
      role="button"
      tabIndex={0}
      onDoubleClick={onDoubleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') onDoubleClick();
      }}
      className="group rounded-xl border border-slate-200/90 bg-white shadow-sm border-l-4 border-l-orange-500 hover:border-orange-300 hover:shadow-md hover:bg-orange-50/30 transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 focus-visible:ring-offset-2"
      title="Duplo clique: abrir em Processos"
    >
      <div className="px-4 py-3.5 space-y-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-slate-700">
            #{String(indice + 1).padStart(3, '0')}
          </span>
          <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-medium text-indigo-800 ring-1 ring-indigo-100">
            Cod. {item.codCliente}
          </span>
          <span className="inline-flex items-center rounded-md bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800 ring-1 ring-violet-100">
            Proc. {String(item.proc).padStart(2, '0')}
          </span>
        </div>

        <p className="text-base font-medium text-slate-900 leading-snug">{textoPartes(item)}</p>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
          <span className="font-mono text-slate-600 tracking-tight" title="Número CNJ">
            {cnjLabel}
          </span>
          <span
            className="inline-flex items-center rounded-md bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-900 ring-1 ring-orange-200"
            title="Prazo fatal"
          >
            Prazo fatal: {item.prazoFatal ?? '—'}
          </span>
        </div>
      </div>
    </article>
  );
}

export function ModalResultadoPrazoFatal({ open, onClose, dataPrazoFatal, itens, onOpenProcesso }) {
  const [busca, setBusca] = useState('');
  const [copiado, setCopiado] = useState(false);

  useEffect(() => {
    if (open) {
      setBusca('');
      setCopiado(false);
    }
  }, [open]);

  const termoNorm = useMemo(() => normalizarBusca(busca), [busca]);

  const itensFiltrados = useMemo(
    () => (itens ?? []).filter((item) => itemCorrespondeBusca(item, termoNorm)),
    [itens, termoNorm],
  );

  const copiarLista = async () => {
    const texto = montarTextoListaCopiavel(itensFiltrados);
    if (!texto) return;
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* silencioso */
    }
  };

  if (!open) return null;

  const total = (itens ?? []).length;
  const visiveis = itensFiltrados.length;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-prazo-fatal-titulo"
    >
      <div className="w-full max-w-3xl max-h-[70vh] flex flex-col bg-white border border-slate-200/90 shadow-2xl rounded-2xl overflow-hidden ring-1 ring-indigo-500/10">
        <header className="shrink-0 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 pr-2">
              <h2 id="modal-prazo-fatal-titulo" className="text-base sm:text-lg font-semibold text-white leading-tight">
                Processos com Prazo Fatal em {dataPrazoFatal}
              </h2>
              <p className="mt-1 text-sm text-white/85">
                <span className="inline-flex items-center rounded-full bg-white/20 px-2.5 py-0.5 font-semibold tabular-nums">
                  {total} {total === 1 ? 'processo' : 'processos'}
                </span>
                {termoNorm && visiveis !== total ? (
                  <span className="ml-2 text-white/75">· {visiveis} na busca</span>
                ) : null}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 p-2 rounded-lg text-white/90 hover:bg-white/15 transition-colors"
              aria-label="Fechar"
            >
              <X className="w-5 h-5" strokeWidth={2.25} />
            </button>
          </div>

          <label className="mt-3 flex items-center gap-2 rounded-lg bg-white/15 px-3 py-2 ring-1 ring-white/20 focus-within:ring-2 focus-within:ring-white/40">
            <Search className="w-4 h-4 text-white/70 shrink-0" aria-hidden />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar por parte, cliente, código ou número CNJ…"
              className="flex-1 min-w-0 bg-transparent border-0 text-sm text-white placeholder:text-white/60 focus:outline-none"
              aria-label="Filtrar processos"
            />
          </label>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 py-3 bg-slate-50/80">
          {total === 0 ? (
            <p className="text-sm text-slate-600 text-center py-8">Nenhum processo com prazo fatal para a data informada.</p>
          ) : visiveis === 0 ? (
            <p className="text-sm text-slate-600 text-center py-8">Nenhum processo corresponde ao filtro digitado.</p>
          ) : (
            <ul className="space-y-3">
              {itensFiltrados.map((item, idx) => (
                <li
                  key={`${item.codCliente}-${item.proc}-${idx}`}
                  className={idx % 2 === 1 ? '[&_article]:bg-slate-50/90' : ''}
                >
                  <PrazoFatalCard
                    item={item}
                    indice={idx}
                    onDoubleClick={() => onOpenProcesso?.(item)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-slate-200/80 bg-white">
          <p className="text-xs text-slate-500 hidden sm:block">Duplo clique no card abre o processo</p>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => void copiarLista()}
              disabled={visiveis === 0}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              <Copy className="w-4 h-4" aria-hidden />
              {copiado ? 'Copiado!' : 'Copiar lista'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-sm font-semibold text-white shadow-md hover:from-indigo-500 hover:to-violet-500"
            >
              Fechar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

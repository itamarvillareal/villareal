import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, Star, X } from 'lucide-react';
import { padCliente } from '../../data/processosDadosRelatorio.js';
import { featureFlags } from '../../config/featureFlags.js';
import {
  definirVinculoPrincipalProcessoImovelApi,
  listarVinculosProcessoImovel,
} from '../../repositories/imoveisRepository.js';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape.js';
import { imoveisBtnPrimary, imoveisBtnSecondary, imoveisBtnIconGhost } from './ImoveisAdminLayout.jsx';

export function ModalVinculosProcessoImovel({
  open,
  onClose,
  numeroPlanilha,
  imovelIdApi,
  codigoCadastro,
  procCadastro,
  onAbrirProcesso,
  onPrincipalAlterado,
}) {
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [vinculos, setVinculos] = useState([]);

  useCloseOnEscape(open, onClose);

  useEffect(() => {
    if (!open) return undefined;
    let ativo = true;
    setCarregando(true);
    setErro('');
    void listarVinculosProcessoImovel({
      numeroPlanilha,
      imovelIdApi: imovelIdApi ?? undefined,
    })
      .then((r) => {
        if (!ativo) return;
        setVinculos(Array.isArray(r?.vinculos) ? r.vinculos : []);
      })
      .catch(() => {
        if (!ativo) return;
        setErro('Não foi possível carregar os vínculos com Processos.');
        setVinculos([]);
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [open, numeroPlanilha, imovelIdApi]);

  async function definirComoPrincipal(v) {
    if (!featureFlags.useApiImoveis || v.principal) return;
    setSalvando(true);
    setErro('');
    try {
      const r = await definirVinculoPrincipalProcessoImovelApi({
        numeroPlanilha,
        imovelIdApi: imovelIdApi ?? undefined,
        codigoCliente: v.codigoCliente,
        numeroInterno: v.numeroInterno,
      });
      setVinculos(Array.isArray(r?.vinculos) ? r.vinculos : []);
      onPrincipalAlterado?.();
    } catch (e) {
      setErro(e?.message || 'Não foi possível definir o vínculo principal.');
    } finally {
      setSalvando(false);
    }
  }

  if (!open) return null;

  const codCad = padCliente(codigoCadastro ?? '');
  const procCad = String(procCadastro ?? '').trim();
  const vinculoPrincipal = vinculos.find((x) => x.principal) || vinculos[vinculos.length - 1] || null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/45 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-labelledby="modal-vinculos-proc-title"
        aria-modal="true"
        className="relative w-full max-w-lg rounded-2xl border border-slate-200/90 dark:border-white/10 bg-white dark:bg-[#141c2c] shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200/80 dark:border-white/[0.08]">
          <div>
            <h2 id="modal-vinculos-proc-title" className="text-base font-semibold text-slate-900 dark:text-white">
              Processos do imóvel {numeroPlanilha}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Pares Código + Proc. com este nº no campo Imóvel (Processos). Escolha qual é o{' '}
              <strong>vínculo principal</strong> — ele alimenta a conta corrente e o relatório financeiro.
            </p>
          </div>
          <button type="button" onClick={onClose} className={imoveisBtnIconGhost} aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 py-4 max-h-[min(24rem,60vh)] overflow-y-auto">
          {carregando ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">Carregando vínculos…</p>
          ) : erro ? (
            <p className="text-sm text-red-600 dark:text-red-400">{erro}</p>
          ) : vinculos.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Nenhum processo vinculado a este imóvel no banco.
            </p>
          ) : (
            <ul className="space-y-2">
              {vinculos.map((v) => {
                const cod = padCliente(v.codigoCliente ?? '');
                const procN = Number(v.numeroInterno);
                const ehPrincipal = !!v.principal;
                const ehCadastroAtual =
                  (codCad && procCad && cod === codCad && String(procN) === procCad) || v.cadastroAtual;
                const destaque = ehPrincipal;
                return (
                  <li
                    key={`${cod}-${procN}-${v.processoId ?? v.imovelId ?? 'x'}`}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${
                      destaque
                        ? 'border-teal-400/60 bg-teal-50/80 dark:bg-teal-950/30 dark:border-teal-500/40'
                        : 'border-slate-200/80 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.03]'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 tabular-nums">
                        Cliente {cod} · Proc. {procN}
                      </p>
                      {ehPrincipal ? (
                        <p className="text-[11px] text-teal-700 dark:text-teal-300 mt-0.5 font-medium flex items-center gap-1">
                          <Star className="w-3 h-3 fill-current shrink-0" aria-hidden />
                          Principal · vínculo atual
                        </p>
                      ) : ehCadastroAtual ? (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Referência deste cadastro
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                      {!ehPrincipal && featureFlags.useApiImoveis ? (
                        <button
                          type="button"
                          disabled={salvando}
                          onClick={() => void definirComoPrincipal(v)}
                          className={`${imoveisBtnSecondary} text-xs py-1.5 px-2.5 inline-flex items-center gap-1`}
                        >
                          {salvando ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
                          ) : (
                            <Star className="w-3.5 h-3.5" aria-hidden />
                          )}
                          Definir principal
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={`${imoveisBtnSecondary} text-xs py-1.5 px-2.5`}
                        onClick={() => onAbrirProcesso(cod, procN)}
                      >
                        <ExternalLink className="w-3.5 h-3.5" aria-hidden />
                        Abrir
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-200/80 dark:border-white/[0.08]">
          <button type="button" onClick={onClose} className={imoveisBtnSecondary}>
            Fechar
          </button>
          {vinculoPrincipal ? (
            <button
              type="button"
              className={imoveisBtnPrimary}
              onClick={() => {
                onAbrirProcesso(padCliente(vinculoPrincipal.codigoCliente), Number(vinculoPrincipal.numeroInterno));
              }}
            >
              Abrir processo principal
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

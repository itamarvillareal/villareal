import { useState } from 'react';
import { FileText, Loader2, X } from 'lucide-react';
import {
  FORMA_ASSINATURA_LOCACAO_PADRAO,
  LOCAL_DATA_LOCACAO_PADRAO,
  VARIANTE_CONTRATO_LOCACAO_PADRAO,
  VARIANTES_CONTRATO_LOCACAO,
} from '../../data/locacaoContratoVariantes.js';
import {
  downloadPdfBlob,
  gerarContratoLocacao,
  nomeArquivoContratoPdf,
  previewConteudoContratoLocacao,
} from '../../repositories/documentosRepository.js';
import { resolverContratoLocacaoIdParaImovel } from '../../repositories/imoveisRepository.js';
import { FORMAS_ASSINATURA_CONTRATO } from '../../pages/documentos/contratoModelos.js';
import { mensagemErroAmigavel } from '../../utils/mensagemErroAmigavel.js';
import { parseValorMonetarioBr } from '../../utils/parseValorMonetarioBr.js';
import { normalizarFormaPagamentoAluguel } from '../../data/locacaoFormaPagamentoAluguel.js';
import { imoveisBtnPrimary, imoveisBtnSecondary, imoveisInputClass } from './ImoveisAdminLayout.jsx';
import { PreviewContratoLocacao } from './PreviewContratoLocacao.jsx';

function parseDiaVencimentoAluguel(valor) {
  const n = Number(String(valor ?? '').replace(/\D/g, ''));
  return Number.isFinite(n) && n >= 1 && n <= 31 ? n : undefined;
}

function hojeIso() {
  return new Date().toISOString().slice(0, 10);
}

function brDateToIsoOptional(br) {
  const s = String(br ?? '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return undefined;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/**
 * @param {{
 *   open: boolean,
 *   onClose: () => void,
 *   imovelIdApi?: number|null,
 *   contratoLocacaoId?: number|null,
 *   codigoCliente?: string,
 *   numeroInterno?: string|number,
 *   locadorNome?: string,
 *   locatarioNome?: string,
 *   inquilinosPessoaIds?: number[],
 *   dataInicioContrato?: string,
 *   dataFimContrato?: string,
 *   valorLocacao?: string|number,
 *   linkVistoria?: string,
 *   diaPagAluguel?: string,
 *   formaPagamentoAluguel?: string,
 *   dataPag1TxCond?: string,
 *   onAntesDeGerar?: () => void | Promise<void>,
 *   onErro?: (msg: string) => void,
 * }} props
 */
export function ModalGerarContratoLocacao({
  open,
  onClose,
  imovelIdApi,
  contratoLocacaoId,
  codigoCliente,
  numeroInterno,
  locadorNome,
  locatarioNome,
  inquilinosPessoaIds,
  dataInicioContrato,
  dataFimContrato,
  valorLocacao,
  linkVistoria,
  diaPagAluguel,
  formaPagamentoAluguel,
  dataPag1TxCond,
  onAntesDeGerar,
  onErro,
}) {
  const [variante, setVariante] = useState(VARIANTE_CONTRATO_LOCACAO_PADRAO);
  const [cidadeEstado, setCidadeEstado] = useState(LOCAL_DATA_LOCACAO_PADRAO);
  const [data, setData] = useState(hojeIso());
  const [formaAssinatura, setFormaAssinatura] = useState(FORMA_ASSINATURA_LOCACAO_PADRAO);
  const [loading, setLoading] = useState(false);
  const [gerandoFinal, setGerandoFinal] = useState(false);
  const [etapa, setEtapa] = useState('form');
  const [conteudoPreview, setConteudoPreview] = useState(null);
  const [contratoIdResolvido, setContratoIdResolvido] = useState(null);

  if (!open) return null;

  const contratoId = Number(contratoLocacaoId);
  const imovelApi = Number(imovelIdApi);
  const podeGerar =
    (Number.isFinite(contratoId) && contratoId > 0) ||
    (Number.isFinite(imovelApi) && imovelApi > 0);

  function montarPayload(contratoLocacaoIdEfetivo) {
    return {
      contratoLocacaoId: contratoLocacaoIdEfetivo,
      variante,
      cidadeEstado: cidadeEstado.trim() || LOCAL_DATA_LOCACAO_PADRAO,
      data,
      formaAssinatura,
      codigoCliente: codigoCliente != null ? String(codigoCliente).trim() : undefined,
      numeroInterno:
        numeroInterno != null && String(numeroInterno).trim() !== '' ? Number(numeroInterno) : undefined,
      inquilinosPessoaIds: Array.isArray(inquilinosPessoaIds) ? inquilinosPessoaIds : undefined,
      dataInicioContrato: brDateToIsoOptional(dataInicioContrato),
      dataFimContrato: brDateToIsoOptional(dataFimContrato),
      valorAluguelContrato: parseValorMonetarioBr(valorLocacao) ?? undefined,
      linkVistoria: String(linkVistoria ?? '').trim() || undefined,
      diaVencimentoAluguel: parseDiaVencimentoAluguel(diaPagAluguel),
      formaPagamentoAluguel: normalizarFormaPagamentoAluguel(formaPagamentoAluguel),
      dataPagamentoPrimeiraTaxaCondominial: brDateToIsoOptional(dataPag1TxCond),
    };
  }

  function fecharModal() {
    setEtapa('form');
    setConteudoPreview(null);
    setContratoIdResolvido(null);
    onClose();
  }

  async function resolverContratoId() {
    if (onAntesDeGerar) {
      await onAntesDeGerar();
    }
    const id = await resolverContratoLocacaoIdParaImovel(imovelIdApi, contratoLocacaoId);
    if (!id) {
      onErro?.('Salve o imóvel com locador, inquilino e dados do contrato antes de gerar o PDF.');
      return null;
    }
    return id;
  }

  async function handleRevisarClausulas() {
    if (!podeGerar && !imovelIdApi) {
      onErro?.('Salve o cadastro do imóvel na API antes de gerar o contrato (contrato de locação ainda não gravado).');
      return;
    }
    setLoading(true);
    try {
      const id = await resolverContratoId();
      if (!id) return;
      setContratoIdResolvido(id);
      const conteudo = await previewConteudoContratoLocacao(montarPayload(id));
      setConteudoPreview(conteudo);
      setEtapa('preview');
    } catch (e) {
      onErro?.(mensagemErroAmigavel(e, 'montar a revisão das cláusulas'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGerarFinal() {
    const id = contratoIdResolvido ?? (await resolverContratoId());
    if (!id || !conteudoPreview) return;
    setGerandoFinal(true);
    try {
      const blob = await gerarContratoLocacao({
        ...montarPayload(id),
        conteudoEditado: conteudoPreview,
      });
      const base = locatarioNome || locadorNome || 'locacao';
      downloadPdfBlob(blob, nomeArquivoContratoPdf(base, 'locacao'));
      fecharModal();
    } catch (e) {
      onErro?.(mensagemErroAmigavel(e, 'gerar o contrato de locação'));
    } finally {
      setGerandoFinal(false);
    }
  }

  return (
    <>
      {etapa === 'form' ? (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 shadow-xl">
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-600">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-5 h-5 text-teal-600 shrink-0" aria-hidden />
                <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100 truncate">Gerar contrato de locação</h2>
              </div>
              <button type="button" onClick={fecharModal} className="p-1 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 text-sm">
              {!podeGerar ? (
                <p className="text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-500/30 rounded-lg px-3 py-2">
                  Salve o imóvel na API com locador e inquilino cadastrados. O contrato de locação é criado automaticamente ao salvar.
                </p>
              ) : null}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-400">
                <p>
                  <span className="font-medium text-slate-700 dark:text-slate-300">Locador:</span>{' '}
                  {locadorNome?.trim() || '—'}
                </p>
                <p>
                  <span className="font-medium text-slate-700 dark:text-slate-300">Locatário:</span>{' '}
                  {locatarioNome?.trim() || '—'}
                </p>
              </div>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Modelo</span>
                <select value={variante} onChange={(e) => setVariante(e.target.value)} className={imoveisInputClass}>
                  {VARIANTES_CONTRATO_LOCACAO.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Local e data (cidade/UF)</span>
                <input
                  type="text"
                  value={cidadeEstado}
                  onChange={(e) => setCidadeEstado(e.target.value)}
                  className={imoveisInputClass}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Data do contrato</span>
                <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={imoveisInputClass} />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Forma de assinatura</span>
                <select value={formaAssinatura} onChange={(e) => setFormaAssinatura(e.target.value)} className={imoveisInputClass}>
                  {FORMAS_ASSINATURA_CONTRATO.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex flex-wrap justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-600">
              <button type="button" onClick={fecharModal} disabled={loading} className={imoveisBtnSecondary}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleRevisarClausulas()}
                disabled={loading || !podeGerar}
                className={imoveisBtnPrimary}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
                    Carregando…
                  </>
                ) : (
                  'Revisar cláusulas'
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <PreviewContratoLocacao
        open={etapa === 'preview'}
        conteudo={conteudoPreview}
        loading={loading}
        gerandoFinal={gerandoFinal}
        onConteudoChange={setConteudoPreview}
        onVoltar={() => setEtapa('form')}
        onGerarFinal={() => void handleGerarFinal()}
        onClose={fecharModal}
      />
    </>
  );
}

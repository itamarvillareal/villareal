import { useEffect, useRef, useState } from 'react';
import { AlignHorizontalJustifyCenter, Trash2, Wrench } from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import { readOfxFileAsText } from '../../../utils/ofx.js';
import { isInstituicaoExtratoOfxBloqueado } from '../../../utils/extratoPdfImport.js';
import { removerLancamentosFinanceiroApiEmLote } from '../../../repositories/financeiroRepository.js';
import { formatMoeda } from '../shared/financeiroFormat.js';
import { useFinanceiroToast } from '../shared/Toast.jsx';
import { dispatchRefreshPendentes } from '../hooks/useKeyboardShortcuts.js';
import {
  diagnosticarExtratoComOfx,
  executarAlinhamentoExtratoComOfx,
  prepararExclusaoReparoExtrato,
  prepararImportacaoReparoExtrato,
} from './extratoRepararDiagnostico.js';
import {
  extratoAlinhadoComOfx,
  extratoFielComOfx,
  alinhamentoSaldoCoerenteComOfx,
  saldoLedgerDesalinhadoComOfx,
} from './extratoRepararDiagnosticoCore.js';

function LinhaResumo({ label, value, destaque }) {
  return (
    <div className="flex justify-between gap-3 text-sm py-0.5">
      <span className="text-slate-600 dark:text-slate-400">{label}</span>
      <span
        className={`font-medium tabular-nums text-right ${
          destaque === 'neg'
            ? 'text-red-600 dark:text-red-400'
            : destaque === 'pos'
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-slate-900 dark:text-slate-100'
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function TabelaLancamentos({ titulo, linhas, tom }) {
  if (!linhas?.length) return null;
  const border =
    tom === 'faltam'
      ? 'border-amber-200 dark:border-amber-900'
      : 'border-red-200 dark:border-red-900';
  const head =
    tom === 'faltam'
      ? 'bg-amber-50 text-amber-950 dark:bg-amber-950/40 dark:text-amber-100'
      : 'bg-red-50 text-red-950 dark:bg-red-950/40 dark:text-red-100';

  return (
    <section className={`rounded-lg border ${border} overflow-hidden`}>
      <h3 className={`px-3 py-2 text-sm font-semibold ${head}`}>{titulo}</h3>
      <div className="max-h-56 overflow-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-white dark:bg-slate-900 text-slate-500">
            <tr>
              <th className="px-2 py-1.5 font-medium">Data</th>
              <th className="px-2 py-1.5 font-medium">Descrição</th>
              <th className="px-2 py-1.5 font-medium text-right">Valor</th>
              <th className="px-2 py-1.5 font-medium">Nº</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((t, i) => (
              <tr key={`${t.numero}-${t.data}-${i}`} className="border-t border-slate-100 dark:border-slate-800">
                <td className="px-2 py-1 tabular-nums whitespace-nowrap">{t.data}</td>
                <td className="px-2 py-1 max-w-[240px] truncate" title={t.descricao}>
                  {t.descricao}
                </td>
                <td
                  className={`px-2 py-1 text-right tabular-nums font-medium ${
                    Number(t.valor) < 0 ? 'text-red-600' : 'text-emerald-700'
                  }`}
                >
                  {formatMoeda(t.valor)}
                </td>
                <td className="px-2 py-1 font-mono truncate max-w-[100px]" title={String(t.numero ?? '')}>
                  {String(t.numero ?? '').slice(0, 12)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * @param {{
 *   bancoNome: string,
 *   numeroBanco: number,
 *   ofxText?: string,
 *   initialDiagnostico?: object|null,
 *   showFileInput?: boolean,
 *   disabled?: boolean,
 *   onDiagnosticoChange?: (diag: object|null) => void,
 *   onAlinhado?: (diag: object) => void,
 * }} props
 */
export function ExtratoRepararPanel({
  bancoNome,
  numeroBanco,
  ofxText: ofxTextProp = '',
  initialDiagnostico = null,
  showFileInput = true,
  disabled = false,
  onDiagnosticoChange,
  onAlinhado,
}) {
  const toast = useFinanceiroToast();
  const inputRef = useRef(null);
  const ofxTextRef = useRef(String(ofxTextProp ?? ''));
  const [arquivo, setArquivo] = useState(null);
  const [analisando, setAnalisando] = useState(false);
  const [resultado, setResultado] = useState(initialDiagnostico);
  const [erro, setErro] = useState('');
  const [confirmExcluir, setConfirmExcluir] = useState(false);
  const [confirmAlinhar, setConfirmAlinhar] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [alinhando, setAlinhando] = useState(false);

  useEffect(() => {
    ofxTextRef.current = String(ofxTextProp ?? '');
  }, [ofxTextProp]);

  useEffect(() => {
    setResultado(initialDiagnostico);
  }, [initialDiagnostico]);

  useEffect(() => {
    onDiagnosticoChange?.(resultado);
  }, [resultado, onDiagnosticoChange]);

  const busy = disabled || analisando || excluindo || alinhando;

  const analisarTexto = async (ofxText) => {
    if (!featureFlags.useApiFinanceiro) {
      toast.warn('Reparar extrato exige a API financeira ativa.');
      return null;
    }
    if (!String(ofxText ?? '').trim()) {
      setErro('Arquivo OFX vazio ou inválido.');
      return null;
    }
    if (isInstituicaoExtratoOfxBloqueado(bancoNome)) {
      setErro(`Para ${bancoNome}, o reparo por OFX não está disponível (use PDF).`);
      return null;
    }

    setAnalisando(true);
    setErro('');
    const ac = new AbortController();
    try {
      ofxTextRef.current = ofxText;
      const diag = await diagnosticarExtratoComOfx({
        ofxText,
        numeroBanco,
        signal: ac.signal,
      });
      setResultado(diag);
      setConfirmExcluir(false);
      setConfirmAlinhar(false);
      if (extratoAlinhadoComOfx(diag)) onAlinhado?.(diag);
      return diag;
    } catch (e) {
      if (e?.name !== 'AbortError') {
        const msg = e?.message || 'Falha ao analisar o OFX.';
        setErro(msg);
        toast.error(msg);
      }
      return null;
    } finally {
      setAnalisando(false);
    }
  };

  const analisarArquivo = async () => {
    if (!arquivo) {
      setErro('Selecione o arquivo OFX (período ou histórico completo).');
      return;
    }
    const ofxText = await readOfxFileAsText(arquivo);
    await analisarTexto(ofxText);
  };

  const exclusao = resultado ? prepararExclusaoReparoExtrato(resultado.sobramNoSistema) : null;
  const importacao = resultado
    ? prepararImportacaoReparoExtrato(resultado.faltamNoSistema, bancoNome, numeroBanco)
    : null;
  const podeAlinhar =
    alinhamentoSaldoCoerenteComOfx(resultado) &&
    ((exclusao?.apiIds?.length ?? 0) > 0 || (importacao?.linhas?.length ?? 0) > 0);
  const alinhamentoIncoerente =
    resultado &&
    !alinhamentoSaldoCoerenteComOfx(resultado) &&
    ((resultado.faltamNoSistema?.length ?? 0) > 0 || (resultado.sobramNoSistema?.length ?? 0) > 0);

  const excluirSobramNoSistema = async () => {
    if (!exclusao?.apiIds?.length) return;
    setExcluindo(true);
    setErro('');
    try {
      const { removidos, erros } = await removerLancamentosFinanceiroApiEmLote(exclusao.apiIds);
      if (erros?.length) {
        toast.warn(
          `${removidos.length} excluído(s); ${erros.length} falha(s). ${erros[0]?.message ?? ''}`,
        );
      } else {
        toast.success(`${removidos.length} lançamento(s) excluído(s).`);
      }
      dispatchRefreshPendentes();
      setConfirmExcluir(false);
      setConfirmAlinhar(false);
      if (ofxTextRef.current) {
        const diag = await diagnosticarExtratoComOfx({
          ofxText: ofxTextRef.current,
          numeroBanco,
        });
        setResultado(diag);
        if (extratoAlinhadoComOfx(diag)) onAlinhado?.(diag);
      }
    } catch (e) {
      const msg = e?.message || 'Falha ao excluir lançamentos.';
      setErro(msg);
      toast.error(msg);
    } finally {
      setExcluindo(false);
    }
  };

  const alinharSaldoComOfx = async () => {
    if (!ofxTextRef.current || !podeAlinhar) return;
    setAlinhando(true);
    setErro('');
    try {
      const r = await executarAlinhamentoExtratoComOfx({
        ofxText: ofxTextRef.current,
        numeroBanco,
        nomeBanco: bancoNome,
      });
      const { diagFinal, removidos, criados, errosExclusao, errosImportacao } = r;
      setResultado(diagFinal);
      setConfirmAlinhar(false);
      setConfirmExcluir(false);
      dispatchRefreshPendentes();
      const diff =
        diagFinal.meta?.saldoLedger != null && diagFinal.totais?.saldoSistema != null
          ? diagFinal.totais.saldoSistema - diagFinal.meta.saldoLedger
          : null;
      const partes = [`${removidos} excluído(s)`, `${criados} importado(s)`];
      if (diff != null && Math.abs(diff) < 0.01) {
        partes.push('saldo alinhado com o OFX');
      } else if (diff != null) {
        partes.push(`diferença residual ${formatMoeda(diff)}`);
      }
      if (errosExclusao.length || errosImportacao.length) {
        toast.warn(`${partes.join('; ')}. ${errosExclusao.length + errosImportacao.length} falha(s).`);
      } else {
        toast.success(partes.join('; ') + '.');
      }
      if (extratoAlinhadoComOfx(diagFinal)) onAlinhado?.(diagFinal);
    } catch (e) {
      const msg = e?.message || 'Falha ao alinhar extrato com o OFX.';
      setErro(msg);
      toast.error(msg);
    } finally {
      setAlinhando(false);
    }
  };

  const { meta, totais } = resultado ?? {};
  const txsAlinhadas = extratoAlinhadoComOfx(resultado);
  const fielComOfx = extratoFielComOfx(resultado);
  const saldoDesalinhadoComTxsOk =
    txsAlinhadas && saldoLedgerDesalinhadoComOfx(resultado);

  return (
    <div className="space-y-4">
      {showFileInput ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
            Arquivo OFX do período
          </label>
          <input
            ref={inputRef}
            type="file"
            accept=".ofx,.qfx,application/x-ofx,text/plain"
            disabled={busy}
            onChange={(e) => {
              setArquivo(e.target.files?.[0] ?? null);
              setResultado(null);
              setErro('');
              setConfirmExcluir(false);
              setConfirmAlinhar(false);
              ofxTextRef.current = '';
            }}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-slate-50 file:px-3 file:py-1.5 file:text-sm dark:file:border-slate-600 dark:file:bg-slate-800"
          />
          <button
            type="button"
            onClick={() => void analisarArquivo()}
            disabled={busy || !arquivo}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-amber-600 bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50"
          >
            <Wrench className="w-4 h-4" aria-hidden />
            {analisando ? 'Analisando…' : 'Analisar OFX'}
          </button>
        </div>
      ) : (
        <p className="text-sm text-slate-600 dark:text-slate-400 rounded-lg border border-amber-200 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/20 px-3 py-2">
          O arquivo enviado para importação difere do extrato gravado. Corrija abaixo antes de continuar.
        </p>
      )}

      {erro ? (
        <p className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
          {erro}
        </p>
      ) : null}

      {resultado ? (
        <>
          <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-3 py-3 space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">Resumo</p>
            {meta?.dataInicio && meta?.dataFim ? (
              <LinhaResumo
                label="Período do OFX"
                value={`${meta.dataInicio.split('-').reverse().join('/')} — ${meta.dataFim.split('-').reverse().join('/')}`}
              />
            ) : null}
            <LinhaResumo label="Lançamentos no OFX (arquivo)" value={String(totais.ofxArquivo)} />
                <LinhaResumo label="Lançamentos no sistema (conta)" value={String(totais.sistemaTotal)} />
                {totais.sistemaNoPeriodo != null ? (
                  <LinhaResumo
                    label="Lançamentos no sistema (período OFX)"
                    value={String(totais.sistemaNoPeriodo)}
                  />
                ) : null}
            <LinhaResumo
              label="Faltam no sistema"
              value={String(totais.faltamNoSistema)}
              destaque={totais.faltamNoSistema > 0 ? 'neg' : undefined}
            />
            {totais.faltamMesclagem != null && totais.faltamMesclagem !== totais.faltamNoSistema ? (
              <LinhaResumo label="Faltam se importar com corte" value={String(totais.faltamMesclagem)} />
            ) : null}
            <LinhaResumo
              label="Sobram no sistema"
              value={String(totais.sobramNoSistema)}
              destaque={totais.sobramNoSistema > 0 ? 'neg' : undefined}
            />
                {totais.existenteIgnoradosForaPeriodo > 0 ? (
                  <LinhaResumo
                    label="Ignorados (fora do período do arquivo)"
                    value={String(totais.existenteIgnoradosForaPeriodo)}
                  />
                ) : null}
                <LinhaResumo label="Soma movimento OFX (arquivo)" value={formatMoeda(totais.somaOfxArquivo)} />
                <LinhaResumo
                  label="Soma movimento sistema (período OFX)"
                  value={formatMoeda(totais.somaSistemaNoPeriodo ?? totais.somaSistemaTotal)}
                />
            {meta?.saldoLedger != null ? (
              <LinhaResumo label="Saldo final no OFX (LEDGERBAL)" value={formatMoeda(meta.saldoLedger)} />
            ) : null}
            {totais.saldoSistema != null ? (
              <LinhaResumo
                label="Saldo no sistema"
                value={formatMoeda(totais.saldoSistema)}
                destaque={Number(totais.saldoSistema) < 0 ? 'neg' : 'pos'}
              />
            ) : null}
            {totais.deltaSaldoEsperado != null && totais.deltaSaldoReparo != null ? (
              <>
                <LinhaResumo
                  label="Diferença de saldo (banco − sistema)"
                  value={formatMoeda(totais.deltaSaldoEsperado)}
                  destaque={Math.abs(totais.deltaSaldoEsperado) >= 0.01 ? 'neg' : undefined}
                />
                <LinhaResumo
                  label="Efeito do reparo (faltam − sobram)"
                  value={formatMoeda(totais.deltaSaldoReparo)}
                  destaque={
                    totais.alinhamentoSaldoCoerente === false ? 'neg' : undefined
                  }
                />
              </>
            ) : null}
            {totais.dataCorteBr ? (
              <LinhaResumo label="Data de corte (mesclagem)" value={totais.dataCorteBr} />
            ) : null}
          </div>

          <div className="rounded-lg border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-800 dark:text-blue-200 mb-2">
              Conclusão
            </p>
            <ul className="text-sm text-blue-950 dark:text-blue-100 space-y-1.5 list-disc pl-4">
              {resultado.conclusao.map((txt, i) => (
                <li key={i}>{txt.replace(/\*\*(.*?)\*\*/g, '$1')}</li>
              ))}
            </ul>
          </div>

          <TabelaLancamentos
            titulo={`Faltam no sistema (${resultado.faltamNoSistema.length}) — estão no OFX mas não foram gravados`}
            linhas={resultado.faltamNoSistema}
            tom="faltam"
          />
          <TabelaLancamentos
            titulo={`Sobram no sistema (${resultado.sobramNoSistema.length}) — gravados mas ausentes no OFX`}
            linhas={resultado.sobramNoSistema}
            tom="sobram"
          />

          {fielComOfx ? (
            <p className="text-sm text-emerald-800 dark:text-emerald-200 rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 px-3 py-2">
              Extrato fiel ao OFX (lançamentos e saldo). Pode continuar a importação.
            </p>
          ) : null}

          {saldoDesalinhadoComTxsOk ? (
            <p className="text-sm text-amber-900 dark:text-amber-100 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2">
              Os lançamentos de{' '}
              {meta?.dataInicio && meta?.dataFim
                ? `${meta.dataInicio.split('-').reverse().join('/')} a ${meta.dataFim.split('-').reverse().join('/')}`
                : 'junho'}{' '}
              coincidem com o OFX, mas o saldo ainda não bate (
              {totais?.saldoSistema != null && meta?.saldoLedger != null
                ? `sistema ${formatMoeda(totais.saldoSistema)} vs banco ${formatMoeda(meta.saldoLedger)}`
                : 'diferença no LEDGERBAL'}
              ).
              {(totais?.existenteIgnoradosForaPeriodo ?? 0) > 0
                ? ` Há ${totais.existenteIgnoradosForaPeriodo} lançamento(s) anteriores ao período deste arquivo — reparar só com OFX mensal não altera o saldo. Use o OFX histórico completo da conta Cora (desde 2020) e «Alinhar saldo com OFX», depois repita com o OFX de junho.`
                : ' Ajuste o saldo de abertura (botão «Saldo inicial») para fechar com o LEDGERBAL.'}
            </p>
          ) : null}

          {alinhamentoIncoerente ? (
            <p className="text-sm text-amber-900 dark:text-amber-100 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 px-3 py-2">
              O reparo proposto não fecha a diferença de saldo com o banco. Com histórico anterior ao
              período do OFX, use arquivo histórico completo ou ajuste o saldo de abertura — não use
              «Alinhar saldo com OFX». Pode usar <strong>Continuar importação</strong> para mesclar só
              lançamentos novos (com proteção de corte).
            </p>
          ) : null}

          {podeAlinhar ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30 px-3 py-3 space-y-2">
              <p className="text-sm font-medium text-emerald-900 dark:text-emerald-100">
                Alinhar saldo com OFX
              </p>
              <p className="text-sm text-emerald-800 dark:text-emerald-200">
                Exclui {exclusao?.apiIds?.length ?? 0} lançamento(s) que sobram
                {exclusao?.apiIds?.length ? ` (${formatMoeda(exclusao.soma)})` : ''}
                {importacao?.linhas?.length
                  ? ` e importa ${importacao.linhas.length} faltante(s) (${formatMoeda(importacao.soma)}), sem data de corte.`
                  : '.'}
              </p>
              {confirmAlinhar ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={alinhando}
                    onClick={() => setConfirmAlinhar(false)}
                    className="px-3 py-1.5 text-sm rounded-md border border-emerald-300 bg-white text-emerald-800 hover:bg-emerald-100 dark:bg-slate-900 dark:border-emerald-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={alinhando}
                    onClick={() => void alinharSaldoComOfx()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <AlignHorizontalJustifyCenter className="w-4 h-4" aria-hidden />
                    {alinhando ? 'Alinhando…' : 'Confirmar alinhamento'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setConfirmAlinhar(true);
                    setConfirmExcluir(false);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  <AlignHorizontalJustifyCenter className="w-4 h-4" aria-hidden />
                  Alinhar saldo com OFX
                </button>
              )}
            </div>
          ) : null}

          {exclusao?.apiIds?.length > 0 ? (
            <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-3 py-3 space-y-2">
              <p className="text-sm font-medium text-red-900 dark:text-red-100">Excluir só o que sobra</p>
              <p className="text-sm text-red-800 dark:text-red-200">
                Excluir {exclusao.apiIds.length} lançamento(s) que não constam no OFX (impacto:{' '}
                {formatMoeda(exclusao.soma)}).
              </p>
              {confirmExcluir ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    disabled={excluindo}
                    onClick={() => setConfirmExcluir(false)}
                    className="px-3 py-1.5 text-sm rounded-md border border-red-300 bg-white text-red-800 hover:bg-red-100 dark:bg-slate-900 dark:border-red-800"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={excluindo}
                    onClick={() => void excluirSobramNoSistema()}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" aria-hidden />
                    {excluindo ? 'Excluindo…' : `Confirmar exclusão de ${exclusao.apiIds.length}`}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirmExcluir(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-red-600 bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" aria-hidden />
                  Excluir lançamentos que não constam no OFX
                </button>
              )}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

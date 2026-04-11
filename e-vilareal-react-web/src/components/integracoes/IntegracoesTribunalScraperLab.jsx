import { useState } from 'react';
import { featureFlags } from '../../config/featureFlags.js';
import {
  consultarProcessoDatajud,
  cnjEhProcessoTjgo,
  DATAJUD_API_INDEX_TJGO,
  DATAJUD_URL_PARAMETRIZACAO,
  DATAJUD_WIKI_GLOSSARIO_URL,
  getDatajudRequestBase,
} from '../../data/datajudApiClient.js';
import { cnjParaNumeroUnicoVinteDigitos, parseSegmentosCnj } from '../../data/publicacoesCnjTribunal.js';
import { DataJudExploradorBusca } from './DataJudExploradorBusca.jsx';

/**
 * Integrações — API pública DataJud (CNJ): atalho por CNJ TJGO + laboratório com todas as formas de `_search`.
 *
 * Ative com `VITE_SHOW_TRIBUNAL_SCRAPER_LAB=true` (nome histórico da flag).
 */
export function IntegracoesTribunalScraperLab() {
  const [cnj, setCnj] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);

  const normalizarCnjDigitado = (raw) =>
    String(raw ?? '')
      .trim()
      .replace(/\u2212/g, '-')
      .toUpperCase();

  const consultar = async () => {
    setErro('');
    setResultado(null);
    const c = normalizarCnjDigitado(cnj);
    if (!c) {
      setErro('Informe o número do processo no padrão CNJ.');
      return;
    }
    if (!parseSegmentosCnj(c)) {
      setErro(
        'Formato CNJ inválido. Use: NNNNNNN-DD.AAAA.J.TR.OOOO (ex.: 0000000-00.2023.8.09.0001).',
      );
      return;
    }
    if (!cnjEhProcessoTjgo(c)) {
      setErro(
        'Este atalho está limitado ao **TJGO** (Tribunal de Justiça de Goiás). O CNJ deve conter o segmento **.8.09.** (justiça estadual, tribunal 09). Para outros tribunais e outras queries, use o laboratório abaixo.',
      );
      return;
    }

    setLoading(true);
    try {
      const r = await consultarProcessoDatajud(c);
      setResultado(r);
      if (!r.ok && r.motivo !== 'nao_encontrado') {
        setErro(r.mensagem || r.erro || `Consulta não concluída (${r.motivo ?? '?'})`);
      }
    } catch (e) {
      setErro(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  if (!featureFlags.showTribunalScraperLab) {
    return (
      <div className="p-6 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
        <p className="font-medium text-slate-800 dark:text-slate-200">Tela desligada</p>
        <p className="mt-2">
          Defina <code className="rounded bg-slate-100 px-1 dark:bg-white/10">VITE_SHOW_TRIBUNAL_SCRAPER_LAB=true</code>{' '}
          no <code className="rounded bg-slate-100 px-1 dark:bg-white/10">.env</code> e reinicie o Vite.
        </p>
      </div>
    );
  }

  const d = resultado?.dados;
  const base = getDatajudRequestBase();

  return (
    <div className="space-y-8 pb-10">
      <div className="max-w-6xl mx-auto px-4 md:px-6 pt-4 space-y-2">
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">DataJud (CNJ) — API pública</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Índice de exemplo TJGO: <code className="text-xs rounded bg-slate-100 px-1 dark:bg-white/10">{DATAJUD_API_INDEX_TJGO}</code>
          {' · '}
          Pedidos em dev: <code className="text-xs rounded bg-slate-100 px-1 dark:bg-white/10">{base}</code>
          {' · '}
          <a className="underline" href={DATAJUD_WIKI_GLOSSARIO_URL} target="_blank" rel="noreferrer">
            Glossário
          </a>
          {' · '}
          <a className="underline" href={DATAJUD_URL_PARAMETRIZACAO} target="_blank" rel="noreferrer">
            Parametrização / painel
          </a>
        </p>
        <p className="text-sm text-emerald-900 dark:text-emerald-200/90 rounded-md border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2">
          A secção principal desta página é o <strong>laboratório DSL</strong> (começa logo abaixo). No <strong>fim da página</strong> há um atalho com cache só para um CNJ do TJGO.
        </p>
      </div>

      <DataJudExploradorBusca />

      <section className="max-w-6xl mx-auto px-4 md:px-6 space-y-3 border-t border-slate-200 dark:border-white/10 pt-8 mt-8">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200" id="datajud-atalho-cnj-tjgo">
          Atalho: um processo por CNJ (TJGO, com cache)
        </h2>
        <div className="rounded-lg border border-slate-200 dark:border-white/10 p-4 space-y-3 bg-white dark:bg-[#121821]">
          <label className="block text-sm">
            <span className="text-slate-700 dark:text-slate-300">Número CNJ (processo TJGO)</span>
            <input
              className="mt-1 w-full max-w-xl rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] px-2 py-1.5 text-sm font-mono"
              value={cnj}
              onChange={(e) => setCnj(e.target.value)}
              placeholder="Ex.: 0000000-00.2023.8.09.0001"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void consultar();
              }}
            />
            {cnjParaNumeroUnicoVinteDigitos(normalizarCnjDigitado(cnj)) ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono">
                Número único (DataJud): {cnjParaNumeroUnicoVinteDigitos(normalizarCnjDigitado(cnj))}
              </p>
            ) : null}
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => void consultar()}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {loading ? 'A consultar…' : 'Consultar DataJud'}
          </button>
        </div>

        {erro ? (
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-3 text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap">
            {erro}
          </div>
        ) : null}

        {resultado && !erro ? (
          <div className="rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden text-sm max-w-3xl">
            <div className="px-3 py-2 font-medium bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-slate-200">
              Resultado (atalho) — {resultado.fromCache ? 'cache local' : 'rede'}
              {resultado.ok ? ` · ${resultado.motivo ?? 'ok'}` : ` · ${resultado.motivo ?? 'falha'}`}
            </div>
            <div className="p-3 space-y-2 bg-white dark:bg-[#121821] text-slate-700 dark:text-slate-300">
              {resultado.hit && d ? (
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                  <dt className="text-slate-500 dark:text-slate-400">Processo</dt>
                  <dd className="font-mono text-xs">{d.numeroProcesso}</dd>
                  <dt className="text-slate-500 dark:text-slate-400">Id (DataJud)</dt>
                  <dd className="font-mono text-xs break-all">{d.id ?? '—'}</dd>
                  <dt className="text-slate-500 dark:text-slate-400">Tribunal (DataJud)</dt>
                  <dd>{d.tribunal ?? '—'}</dd>
                  <dt className="text-slate-500 dark:text-slate-400">Classe</dt>
                  <dd>
                    {d.classe ?? '—'}
                    {d.classeCodigo != null ? (
                      <span className="text-slate-500 dark:text-slate-500"> · código {d.classeCodigo}</span>
                    ) : null}
                  </dd>
                  <dt className="text-slate-500 dark:text-slate-400">Órgão julgador</dt>
                  <dd>
                    {d.orgaoJulgador ?? '—'}
                    {d.orgaoJulgadorCodigo != null ? (
                      <span className="text-slate-500 dark:text-slate-500"> · código {d.orgaoJulgadorCodigo}</span>
                    ) : null}
                  </dd>
                  <dt className="text-slate-500 dark:text-slate-400">Grau / sigilo</dt>
                  <dd>
                    {d.grau ?? '—'} {d.nivelSigilo != null ? `· sigilo: ${d.nivelSigilo}` : ''}
                  </dd>
                  <dt className="text-slate-500 dark:text-slate-400">Ajuizamento</dt>
                  <dd>{d.dataAjuizamento ?? '—'}</dd>
                  <dt className="text-slate-500 dark:text-slate-400">Último movimento</dt>
                  <dd className="sm:col-span-2">
                    {d.ultimoMovimentoData ? `${d.ultimoMovimentoData} — ` : ''}
                    {d.ultimoMovimentoTexto ?? '—'}
                    {d.ultimoMovimentoOrgao ? (
                      <span className="block text-slate-500 dark:text-slate-500 text-xs mt-0.5">
                        Órgão (mov.): {d.ultimoMovimentoOrgao}
                      </span>
                    ) : null}
                    {d.ultimoMovimentoCodigo != null ? (
                      <span className="block text-slate-500 dark:text-slate-500 text-xs mt-0.5">
                        Código movimento (TPU): {d.ultimoMovimentoCodigo}
                      </span>
                    ) : null}
                    {d.boletimPainelLegenda ? (
                      <span className="block text-emerald-800/90 dark:text-emerald-200/80 text-xs mt-0.5">
                        {d.boletimPainelLegenda}
                      </span>
                    ) : null}
                  </dd>
                  {d.numerosBoletimOcorrencia?.length ? (
                    <>
                      <dt className="text-slate-500 dark:text-slate-400">BO (MTD 1.2)</dt>
                      <dd className="font-mono text-xs sm:col-span-2">{d.numerosBoletimOcorrencia.join(', ')}</dd>
                    </>
                  ) : null}
                  {d.numerosInqueritoPolicial?.length ? (
                    <>
                      <dt className="text-slate-500 dark:text-slate-400">Inquérito policial (MTD 1.2)</dt>
                      <dd className="font-mono text-xs sm:col-span-2">{d.numerosInqueritoPolicial.join(', ')}</dd>
                    </>
                  ) : null}
                  {Array.isArray(d.partes) && d.partes.length > 0 ? (
                    <>
                      <dt className="text-slate-500 dark:text-slate-400">Partes (MTD 1.2)</dt>
                      <dd className="text-xs sm:col-span-2">
                        {d.partes.length} parte(s) no payload — ver JSON bruto para detalhe.
                      </dd>
                    </>
                  ) : null}
                  {d.sistema != null ? (
                    <>
                      <dt className="text-slate-500 dark:text-slate-400">Sistema (índice)</dt>
                      <dd className="text-xs font-mono sm:col-span-2">{JSON.stringify(d.sistema)}</dd>
                    </>
                  ) : null}
                  {d.formato != null ? (
                    <>
                      <dt className="text-slate-500 dark:text-slate-400">Formato</dt>
                      <dd className="text-xs font-mono sm:col-span-2">{JSON.stringify(d.formato)}</dd>
                    </>
                  ) : null}
                  {d.dataHoraUltimaAtualizacao ? (
                    <>
                      <dt className="text-slate-500 dark:text-slate-400">Última atualização (_source)</dt>
                      <dd className="text-xs">{d.dataHoraUltimaAtualizacao}</dd>
                    </>
                  ) : null}
                  {d.timestampIndice ? (
                    <>
                      <dt className="text-slate-500 dark:text-slate-400">@timestamp</dt>
                      <dd className="text-xs font-mono">{d.timestampIndice}</dd>
                    </>
                  ) : null}
                  {typeof d.movimentosCount === 'number' ? (
                    <>
                      <dt className="text-slate-500 dark:text-slate-400">Movimentos (total)</dt>
                      <dd className="text-xs">{d.movimentosCount}</dd>
                    </>
                  ) : null}
                  {Array.isArray(d.chavesSource) && d.chavesSource.length > 0 ? (
                    <>
                      <dt className="text-slate-500 dark:text-slate-400">Chaves _source</dt>
                      <dd className="text-[11px] font-mono sm:col-span-2 break-all">{d.chavesSource.join(', ')}</dd>
                    </>
                  ) : null}
                </dl>
              ) : (
                <div className="space-y-2 text-slate-600 dark:text-slate-400">
                  <p>
                    {resultado.ok && resultado.motivo === 'nao_encontrado'
                      ? 'Nenhum documento encontrado no índice TJGO para este CNJ.'
                      : resultado.mensagem || 'Sem dados para exibir.'}
                  </p>
                </div>
              )}
              {resultado.tribunalResolvido ? (
                <p className="text-xs text-slate-500 pt-2 border-t border-slate-100 dark:border-white/10">
                  Mapeamento: {resultado.tribunalResolvido.sigla} — {resultado.tribunalResolvido.nome}
                </p>
              ) : null}
              <details className="text-xs pt-2">
                <summary className="cursor-pointer text-slate-500">JSON bruto (debug)</summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded bg-slate-50 dark:bg-black/40 p-2 text-[11px]">
                  {JSON.stringify(resultado.jsonBruto ?? resultado, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

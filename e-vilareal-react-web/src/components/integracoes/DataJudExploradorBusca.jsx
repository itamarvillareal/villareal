import { Fragment, useCallback, useMemo, useState } from 'react';
import {
  DATAJUD_CAMPO,
  DATAJUD_WIKI_GLOSSARIO_URL,
  executarDatajudSearch,
  getDatajudRequestBase,
} from '../../data/datajudApiClient.js';
import {
  DATAJUD_LAB_CAMPOS_DOCUMENTO_MATCH,
  DATAJUD_LAB_CAMPOS_NOME_PARTE,
  DATAJUD_LAB_TIPOS_PESQUISA,
  datajudLabCorpoAssuntoCodigo,
  datajudLabCorpoBoolMustClasseEIntervaloAjuizamento,
  datajudLabCorpoClasseEOrgao,
  datajudLabCorpoDocumentoDigitos,
  datajudLabCorpoDslCampoValor,
  datajudLabCorpoExistsField,
  datajudLabCorpoGrau,
  datajudLabCorpoIds,
  datajudLabCorpoIntervaloDataAjuizamento,
  datajudLabCorpoMatchAll,
  datajudLabCorpoMatchAllComSortTimestampAsc,
  datajudLabCorpoMatchNumeroUnicoVinte,
  datajudLabCorpoMultiMatchCamposLivres,
  datajudLabCorpoMovimentoCodigo,
  datajudLabCorpoNestedMovimentoTexto,
  datajudLabCorpoNestedPartesCampoTexto,
  datajudLabCorpoNomeParte,
  datajudLabCorpoNivelSigilo,
  datajudLabCorpoNumeroProcesso,
  datajudLabCorpoPrefix,
  datajudLabCorpoQueryString,
  datajudLabCorpoRangeCampoGenerico,
  datajudLabCorpoRangeTimestamp,
  datajudLabCorpoSimpleQueryString,
  datajudLabCorpoTermKeywordNumeroProcesso,
  datajudLabCorpoTermsCampo,
  datajudLabCorpoWildcard,
} from '../../data/datajudBuscaBuilders.js';
import { listaIndicesTrtDatajud, listaTribunaisJEDatajudMapeados } from '../../data/publicacoesCnjTribunal.js';

function LabCard({ title, children, footer }) {
  return (
    <section className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121821] p-4 space-y-3">
      <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
      <div className="space-y-2 text-sm">{children}</div>
      {footer ? <div className="text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-white/10">{footer}</div> : null}
    </section>
  );
}

function JsonPreview({ value }) {
  return (
    <pre className="text-[11px] font-mono max-h-32 overflow-auto rounded bg-slate-50 dark:bg-black/40 p-2 text-slate-700 dark:text-slate-300">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function GrupoTitulo({ label }) {
  return (
    <div className="lg:col-span-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-white/10 pb-1 mb-0.5 mt-2">
        {label}
      </p>
    </div>
  );
}

/**
 * Painel de exploração: vários modos de `_search`, índice escolhível, pré-visualização do corpo e lista de hits.
 */
export function DataJudExploradorBusca() {
  const base = getDatajudRequestBase();
  const tribunaisJE = useMemo(() => listaTribunaisJEDatajudMapeados(), []);
  const trts = useMemo(() => listaIndicesTrtDatajud(), []);

  const [apiIndex, setApiIndex] = useState('api_publica_tjgo');
  const [apiCustom, setApiCustom] = useState('');
  const usarCustom = apiIndex === '__custom__';
  const indiceEfetivo = (usarCustom ? apiCustom : apiIndex).trim();

  const [size, setSize] = useState(20);
  const [trackTotal, setTrackTotal] = useState(false);
  const commonOpts = useMemo(
    () => ({ size: Number(size) > 0 ? Number(size) : 20, trackTotalHits: trackTotal }),
    [size, trackTotal],
  );

  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [ultimoTitulo, setUltimoTitulo] = useState('');
  const [ultimoCorpo, setUltimoCorpo] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [expandidoId, setExpandidoId] = useState(null);

  const executar = useCallback(
    async (titulo, body) => {
      if (!body || typeof body !== 'object') {
        setErro('Corpo de busca inválido.');
        return;
      }
      if (!indiceEfetivo) {
        setErro('Escolha ou digite o índice da API (ex.: api_publica_tjgo).');
        return;
      }
      setErro('');
      setUltimoTitulo(titulo);
      setUltimoCorpo(body);
      setResultado(null);
      setLoading(true);
      try {
        const r = await executarDatajudSearch({ apiIndex: indiceEfetivo, body });
        setResultado(r);
        if (!r.ok) {
          setErro(r.mensagem || r.motivo || 'Falha na pesquisa.');
        }
      } catch (e) {
        setErro(e?.message || String(e));
      } finally {
        setLoading(false);
      }
    },
    [indiceEfetivo],
  );

  const [cnjNumero, setCnjNumero] = useState('');
  const [n20, setN20] = useState('');
  const [qsTexto, setQsTexto] = useState('');
  const [qsCampos, setQsCampos] = useState(`${DATAJUD_CAMPO.numeroProcesso},classe.nome`);
  const [classe, setClasse] = useState('');
  const [orgao, setOrgao] = useState('');
  const [dataGte, setDataGte] = useState('');
  const [dataLte, setDataLte] = useState('');
  const [movCod, setMovCod] = useState('');
  const [assuntoCod, setAssuntoCod] = useState('');
  const [grau, setGrau] = useState('');
  const [sigilo, setSigilo] = useState('');
  const [nomeParte, setNomeParte] = useState('');
  const [docDigitos, setDocDigitos] = useState('');
  const [jsonLivre, setJsonLivre] = useState('{\n  "query": { "match_all": {} }\n}');
  const [termKeywordNumero, setTermKeywordNumero] = useState('');
  const [dslTipo, setDslTipo] = useState('match');
  const [dslCampo, setDslCampo] = useState('tribunal');
  const [dslValor, setDslValor] = useState('');
  const [mmLivreQuery, setMmLivreQuery] = useState('');
  const [mmLivreCampos, setMmLivreCampos] = useState('classe.nome,orgaoJulgador.nome');
  const [mmLivreTipo, setMmLivreTipo] = useState('best_fields');
  const [sqsQuery, setSqsQuery] = useState('');
  const [sqsCampos, setSqsCampos] = useState('classe.nome');
  const [tsGte, setTsGte] = useState('');
  const [tsLte, setTsLte] = useState('');
  const [rangeCampo, setRangeCampo] = useState('dataAjuizamento');
  const [rangeGte, setRangeGte] = useState('');
  const [rangeLte, setRangeLte] = useState('');
  const [existsCampo, setExistsCampo] = useState('movimentos');
  const [idsTexto, setIdsTexto] = useState('');
  const [prefixCampo, setPrefixCampo] = useState('numeroProcesso');
  const [prefixVal, setPrefixVal] = useState('');
  const [wcCampo, setWcCampo] = useState('numeroProcesso');
  const [wcPadrao, setWcPadrao] = useState('*');
  const [termsCampo, setTermsCampo] = useState('grau');
  const [termsVals, setTermsVals] = useState('');
  const [boolClasse, setBoolClasse] = useState('');
  const [boolDataGte, setBoolDataGte] = useState('');
  const [boolDataLte, setBoolDataLte] = useState('');
  const [movTexto, setMovTexto] = useState('');
  const [partesSub, setPartesSub] = useState('nome');
  const [partesTxt, setPartesTxt] = useState('');

  const hits = resultado?.hitsNormalizados ?? [];
  const primeiro = hits[0];

  return (
    <div id="datajud-laboratorio-dsl" className="max-w-6xl mx-auto space-y-6 p-4 md:p-6 scroll-mt-20">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Laboratório de buscas DataJud</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 space-y-2">
          <span className="block">
            Todas as formas abaixo são <strong>tentativas</strong> de Query DSL sobre{' '}
            <code className="text-xs rounded bg-slate-100 px-1 dark:bg-white/10">POST {base}/{'{índice}'}/_search</code>.
            Glossário:{' '}
            <a className="underline" href={DATAJUD_WIKI_GLOSSARIO_URL} target="_blank" rel="noreferrer">
              datajud-wiki.cnj.jus.br
            </a>
            .
          </span>
          <span className="block rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100">
            <strong>LGPD / API pública:</strong> buscas por nome de parte ou CPF/CNPJ podem não devolver dados, devolver
            campos mascarados ou falhar conforme o índice do tribunal. Use apenas para validar integração e layout — não
            assuma disponibilidade de dados pessoais.
          </span>
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121821] p-4 space-y-3 text-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-slate-700 dark:text-slate-300">Índice (`api_publica_*`)</span>
            <select
              className="mt-1 w-full rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] px-2 py-1.5 text-sm"
              value={apiIndex}
              onChange={(e) => setApiIndex(e.target.value)}
            >
              <optgroup label="Justiça estadual (mapeado no app)">
                {tribunaisJE.map((t) => (
                  <option key={t.apiIndex} value={t.apiIndex}>
                    {t.sigla} — {t.nome}
                  </option>
                ))}
              </optgroup>
              <optgroup label="Justiça do trabalho (TRT 1–24)">
                {trts.map((t) => (
                  <option key={t.apiIndex} value={t.apiIndex}>
                    {t.sigla}
                  </option>
                ))}
              </optgroup>
              <option value="__custom__">Outro (digitar abaixo)…</option>
            </select>
          </label>
          {usarCustom ? (
            <label className="block">
              <span className="text-slate-700 dark:text-slate-300">Índice manual</span>
              <input
                className="mt-1 w-full rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] px-2 py-1.5 font-mono text-xs"
                value={apiCustom}
                onChange={(e) => setApiCustom(e.target.value)}
                placeholder="api_publica_tjxx"
              />
            </label>
          ) : (
            <div className="flex items-end text-xs text-slate-500 dark:text-slate-400">
              Índice activo: <code className="ml-1 font-mono">{indiceEfetivo || '—'}</code>
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block w-28">
            <span className="text-slate-700 dark:text-slate-300">size</span>
            <input
              type="number"
              min={1}
              max={10000}
              className="mt-1 w-full rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] px-2 py-1.5 font-mono text-xs"
              value={size}
              onChange={(e) => setSize(e.target.value)}
            />
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={trackTotal} onChange={(e) => setTrackTotal(e.target.checked)} />
            <span className="text-slate-700 dark:text-slate-300">track_total_hits</span>
          </label>
        </div>
      </div>

      <details className="max-w-6xl mx-auto px-4 md:px-6 text-xs text-slate-600 dark:text-slate-400">
        <summary className="cursor-pointer font-medium text-slate-700 dark:text-slate-300">
          Tipos de pesquisa implementados no código ({DATAJUD_LAB_TIPOS_PESQUISA.length})
        </summary>
        <p className="mt-2 flex flex-wrap gap-1">
          {DATAJUD_LAB_TIPOS_PESQUISA.map((id) => (
            <span key={id} className="font-mono rounded bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 text-[10px] text-slate-700 dark:text-slate-300">
              {id}
            </span>
          ))}
        </p>
      </details>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GrupoTitulo label="Processo e número" />
        <LabCard
          title="1. Número do processo (CNJ formatado ou 20 dígitos)"
          footer="Combina match/term/query_string em numeroProcesso (como na consulta por CNJ do cliente)."
        >
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] px-2 py-1.5 font-mono text-xs"
            value={cnjNumero}
            onChange={(e) => setCnjNumero(e.target.value)}
            placeholder="0000000-00.2023.8.09.0001 ou 20 dígitos"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => void executar('numero_processo', datajudLabCorpoNumeroProcesso(cnjNumero, commonOpts))}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoNumeroProcesso(cnjNumero, commonOpts)} />
        </LabCard>

        <LabCard title="2. Match tutorial — só 20 dígitos" footer="Ex. 1 da wiki: match em numeroProcesso.">
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] px-2 py-1.5 font-mono text-xs"
            value={n20}
            onChange={(e) => setN20(e.target.value)}
            placeholder="20 dígitos sem pontuação"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoMatchNumeroUnicoVinte(n20, commonOpts);
              if (!b) setErro('Informe exactamente 20 dígitos.');
              else void executar('match_n20', b);
            }}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoMatchNumeroUnicoVinte(n20, commonOpts) ?? { erro: '20 dígitos obrigatórios' }} />
        </LabCard>

        <LabCard
          title="2b. term — numeroProcesso.keyword (valor exacto)"
          footer="Query `term` só no subcampo .keyword; use CNJ formatado ou 20 dígitos."
        >
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] px-2 py-1.5 font-mono text-xs"
            value={termKeywordNumero}
            onChange={(e) => setTermKeywordNumero(e.target.value)}
            placeholder="CNJ ou 20 dígitos"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoTermKeywordNumeroProcesso(termKeywordNumero, commonOpts);
              if (!b) setErro('Informe CNJ ou 20 dígitos para o term keyword.');
              else void executar('term_numero_keyword', b);
            }}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoTermKeywordNumeroProcesso(termKeywordNumero, commonOpts) ?? { erro: 'vazio' }} />
        </LabCard>

        <GrupoTitulo label="Texto e multi-campo" />
        <LabCard
          title="3. query_string (texto livre)"
          footer="Lista de campos separada por vírgula, ou deixe um campo em default_field."
        >
          <textarea
            className="w-full rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] px-2 py-1.5 font-mono text-xs min-h-[60px]"
            value={qsTexto}
            onChange={(e) => setQsTexto(e.target.value)}
            placeholder='Ex.: "distribuído" AND 2023'
          />
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] px-2 py-1.5 font-mono text-xs"
            value={qsCampos}
            onChange={(e) => setQsCampos(e.target.value)}
            placeholder="campos ou default_field"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const campos = qsCampos
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean);
              const b = datajudLabCorpoQueryString(qsTexto, campos.length ? campos : DATAJUD_CAMPO.numeroProcesso, commonOpts);
              if (!b) setErro('Informe o texto da query_string.');
              else void executar('query_string', b);
            }}
          >
            Executar
          </button>
          <JsonPreview
            value={
              datajudLabCorpoQueryString(
                qsTexto,
                qsCampos
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean).length
                  ? qsCampos.split(',').map((s) => s.trim())
                  : DATAJUD_CAMPO.numeroProcesso,
                commonOpts,
              ) ?? { erro: 'texto vazio' }
            }
          />
        </LabCard>

        <LabCard
          title="3b. simple_query_string"
          footer="Sintaxe simplificada; campos em CSV (vazio = todos — pesado)."
        >
          <textarea
            className="w-full rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] px-2 py-1.5 font-mono text-xs min-h-[52px]"
            value={sqsQuery}
            onChange={(e) => setSqsQuery(e.target.value)}
            placeholder="Ex.: distribuído | recebido"
          />
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] px-2 py-1.5 font-mono text-xs"
            value={sqsCampos}
            onChange={(e) => setSqsCampos(e.target.value)}
            placeholder="campos CSV (opcional)"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoSimpleQueryString(sqsQuery, sqsCampos, commonOpts);
              if (!b) setErro('Informe o texto da simple_query_string.');
              else void executar('simple_query_string', b);
            }}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoSimpleQueryString(sqsQuery, sqsCampos, commonOpts) ?? { erro: 'vazio' }} />
        </LabCard>

        <LabCard
          title="3c. multi_match (campos livres)"
          footer="Tipo: best_fields, cross_fields, phrase, phrase_prefix, most_fields…"
        >
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 text-xs mb-1"
            value={mmLivreQuery}
            onChange={(e) => setMmLivreQuery(e.target.value)}
            placeholder="texto da consulta"
          />
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 font-mono text-xs px-2 py-1.5 mb-1"
            value={mmLivreCampos}
            onChange={(e) => setMmLivreCampos(e.target.value)}
            placeholder="campos, separados, por, vírgula"
          />
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 font-mono text-xs px-2 py-1.5 mb-1"
            value={mmLivreTipo}
            onChange={(e) => setMmLivreTipo(e.target.value)}
            placeholder="best_fields"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoMultiMatchCamposLivres(mmLivreQuery, mmLivreCampos, mmLivreTipo, commonOpts);
              if (!b) setErro('Informe consulta e pelo menos um campo.');
              else void executar('multi_match_campos_livres', b);
            }}
          >
            Executar
          </button>
          <JsonPreview
            value={
              datajudLabCorpoMultiMatchCamposLivres(mmLivreQuery, mmLivreCampos, mmLivreTipo, commonOpts) ?? {
                erro: 'consulta/campos vazios',
              }
            }
          />
        </LabCard>

        <LabCard
          title="3d. match | term | match_phrase (campo livre)"
          footer="Experimente campos do glossário (ex.: tribunal, classe.nome)."
        >
          <select
            className="w-full rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] px-2 py-1.5 text-xs"
            value={dslTipo}
            onChange={(e) => setDslTipo(e.target.value)}
          >
            <option value="match">match</option>
            <option value="term">term</option>
            <option value="match_phrase">match_phrase</option>
          </select>
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 font-mono text-xs px-2 py-1.5"
            value={dslCampo}
            onChange={(e) => setDslCampo(e.target.value)}
            placeholder="nome do campo ES"
          />
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 text-xs px-2 py-1.5"
            value={dslValor}
            onChange={(e) => setDslValor(e.target.value)}
            placeholder="valor"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoDslCampoValor(dslTipo, dslCampo, dslValor, commonOpts);
              if (!b) setErro('Preencha campo e valor.');
              else void executar('dsl_campo_valor', b);
            }}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoDslCampoValor(dslTipo, dslCampo, dslValor, commonOpts) ?? { erro: 'incompleto' }} />
        </LabCard>

        <GrupoTitulo label="Metadados, datas e nested" />
        <LabCard title="4. Classe + órgão julgador (wiki ex. 2)" footer="match em classe.codigo e orgaoJulgador.codigo.">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 font-mono text-xs"
              value={classe}
              onChange={(e) => setClasse(e.target.value)}
              placeholder="código classe"
            />
            <input
              className="rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 font-mono text-xs"
              value={orgao}
              onChange={(e) => setOrgao(e.target.value)}
              placeholder="código órgão"
            />
          </div>
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => void executar('classe_orgao', datajudLabCorpoClasseEOrgao(classe, orgao, commonOpts))}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoClasseEOrgao(classe, orgao, commonOpts)} />
        </LabCard>

        <LabCard
          title="4b. bool.must — classe + intervalo dataAjuizamento"
          footer="Útil para fatiar por classe e período de distribuição."
        >
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 font-mono text-xs px-2 py-1.5 mb-1"
            value={boolClasse}
            onChange={(e) => setBoolClasse(e.target.value)}
            placeholder="código classe (match classe.codigo)"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 font-mono text-xs"
              value={boolDataGte}
              onChange={(e) => setBoolDataGte(e.target.value)}
              placeholder="data gte"
            />
            <input
              className="rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 font-mono text-xs"
              value={boolDataLte}
              onChange={(e) => setBoolDataLte(e.target.value)}
              placeholder="data lte"
            />
          </div>
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoBoolMustClasseEIntervaloAjuizamento(boolClasse, boolDataGte, boolDataLte, commonOpts);
              if (!b) setErro('Informe código de classe e pelo menos gte ou lte em data.');
              else void executar('bool_classe_intervalo_ajuizamento', b);
            }}
          >
            Executar
          </button>
          <JsonPreview
            value={
              datajudLabCorpoBoolMustClasseEIntervaloAjuizamento(boolClasse, boolDataGte, boolDataLte, commonOpts) ?? {
                erro: 'classe ou intervalo incompleto',
              }
            }
          />
        </LabCard>

        <LabCard title="5. Intervalo dataAjuizamento" footer="range em dataAjuizamento (formato aceite pelo índice).">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 font-mono text-xs"
              value={dataGte}
              onChange={(e) => setDataGte(e.target.value)}
              placeholder="gte (ex. 2023-01-01)"
            />
            <input
              className="rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 font-mono text-xs"
              value={dataLte}
              onChange={(e) => setDataLte(e.target.value)}
              placeholder="lte"
            />
          </div>
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoIntervaloDataAjuizamento(dataGte, dataLte, commonOpts);
              if (!b) setErro('Informe pelo menos gte ou lte.');
              else void executar('range_ajuizamento', b);
            }}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoIntervaloDataAjuizamento(dataGte, dataLte, commonOpts) ?? { erro: 'gte/lte vazios' }} />
        </LabCard>

        <LabCard title="5b. Range em @timestamp (índice)" footer="Campo interno usado no sort da wiki (Ex. 3).">
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 font-mono text-xs"
              value={tsGte}
              onChange={(e) => setTsGte(e.target.value)}
              placeholder="gte (ISO / epoch-millis)"
            />
            <input
              className="rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 font-mono text-xs"
              value={tsLte}
              onChange={(e) => setTsLte(e.target.value)}
              placeholder="lte"
            />
          </div>
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoRangeTimestamp(tsGte, tsLte, commonOpts);
              if (!b) setErro('Informe gte ou lte para @timestamp.');
              else void executar('range_timestamp', b);
            }}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoRangeTimestamp(tsGte, tsLte, commonOpts) ?? { erro: 'vazio' }} />
        </LabCard>

        <LabCard title="5c. Range em campo arbitrário" footer="Ex.: dataHoraUltimaAtualizacao, ou outro campo date/number do mapping.">
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 font-mono text-xs px-2 py-1.5 mb-1"
            value={rangeCampo}
            onChange={(e) => setRangeCampo(e.target.value)}
            placeholder="nome do campo"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              className="rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 font-mono text-xs"
              value={rangeGte}
              onChange={(e) => setRangeGte(e.target.value)}
              placeholder="gte"
            />
            <input
              className="rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 font-mono text-xs"
              value={rangeLte}
              onChange={(e) => setRangeLte(e.target.value)}
              placeholder="lte"
            />
          </div>
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoRangeCampoGenerico(rangeCampo, { gte: rangeGte, lte: rangeLte }, commonOpts);
              if (!b) setErro('Informe campo e pelo menos gte ou lte.');
              else void executar('range_campo_generico', b);
            }}
          >
            Executar
          </button>
          <JsonPreview
            value={datajudLabCorpoRangeCampoGenerico(rangeCampo, { gte: rangeGte, lte: rangeLte }, commonOpts) ?? {
              erro: 'incompleto',
            }}
          />
        </LabCard>

        <LabCard title="6. Código de movimento (nested movimentos)" footer="Pode falhar se o mapping não usar nested neste tribunal.">
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 font-mono text-xs"
            value={movCod}
            onChange={(e) => setMovCod(e.target.value)}
            placeholder="ex.: 26"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => void executar('movimento_nested', datajudLabCorpoMovimentoCodigo(movCod, commonOpts))}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoMovimentoCodigo(movCod, commonOpts)} />
        </LabCard>

        <LabCard
          title="6b. Movimentos — texto (nested, match)"
          footer="Procura em complemento, nome e descrição do movimento."
        >
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 text-xs"
            value={movTexto}
            onChange={(e) => setMovTexto(e.target.value)}
            placeholder="fragmento do movimento"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoNestedMovimentoTexto(movTexto, commonOpts);
              if (!b) setErro('Informe texto para buscar nos movimentos.');
              else void executar('movimento_texto_nested', b);
            }}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoNestedMovimentoTexto(movTexto, commonOpts) ?? { erro: 'vazio' }} />
        </LabCard>

        <LabCard title="7. Código de assunto (nested assuntos)" footer="Estrutura típica glossário; varia por índice.">
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 font-mono text-xs"
            value={assuntoCod}
            onChange={(e) => setAssuntoCod(e.target.value)}
            placeholder="código assunto"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => void executar('assunto_nested', datajudLabCorpoAssuntoCodigo(assuntoCod, commonOpts))}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoAssuntoCodigo(assuntoCod, commonOpts)} />
        </LabCard>

        <LabCard
          title="7b. Partes — match nested (subcampo)"
          footer="path `partes`; subcampo `nome` vira `partes.nome` (ou digite o caminho completo)."
        >
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 font-mono text-xs px-2 py-1.5 mb-1"
            value={partesSub}
            onChange={(e) => setPartesSub(e.target.value)}
            placeholder="nome (ou pessoa.nome, …)"
          />
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 text-xs"
            value={partesTxt}
            onChange={(e) => setPartesTxt(e.target.value)}
            placeholder="texto"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoNestedPartesCampoTexto(partesSub, partesTxt, commonOpts);
              if (!b) setErro('Informe texto em partes.');
              else void executar('nested_partes', b);
            }}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoNestedPartesCampoTexto(partesSub, partesTxt, commonOpts) ?? { erro: 'vazio' }} />
        </LabCard>

        <LabCard title="8. Grau" footer="match em campo grau.">
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 text-xs"
            value={grau}
            onChange={(e) => setGrau(e.target.value)}
            placeholder="ex.: G1, primeiro_grau, …"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoGrau(grau, commonOpts);
              if (!b) setErro('Informe o grau.');
              else void executar('grau', b);
            }}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoGrau(grau, commonOpts) ?? { erro: 'vazio' }} />
        </LabCard>

        <LabCard title="9. Nível de sigilo" footer="bool em nivelSigilo / sigilo (número ou texto).">
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 font-mono text-xs"
            value={sigilo}
            onChange={(e) => setSigilo(e.target.value)}
            placeholder="0, 1, …"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => void executar('sigilo', datajudLabCorpoNivelSigilo(sigilo, commonOpts))}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoNivelSigilo(sigilo, commonOpts)} />
        </LabCard>

        <GrupoTitulo label="Partes e documentos (LGPD)" />
        <LabCard
          title="10. Nome de parte (multi_match — tentativa)"
          footer={`Campos: ${DATAJUD_LAB_CAMPOS_NOME_PARTE.join(', ')} · Em amostras do índice público TJGO, o _source costuma não trazer «partes» (LGPD / política do tribunal) — por isso a busca por nome frequentemente devolve 0 hits, mesmo existindo processos com essa parte.`}
        >
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 text-xs"
            value={nomeParte}
            onChange={(e) => setNomeParte(e.target.value)}
            placeholder="fragmento do nome"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoNomeParte(nomeParte, commonOpts);
              if (!b) setErro('Informe o nome.');
              else void executar('nome_parte', b);
            }}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoNomeParte(nomeParte, commonOpts) ?? { erro: 'vazio' }} />
        </LabCard>

        <LabCard
          title="11. CPF / CNPJ (só dígitos — tentativa)"
          footer={`Match em: ${DATAJUD_LAB_CAMPOS_DOCUMENTO_MATCH.join(', ')}`}
        >
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 px-2 py-1.5 font-mono text-xs"
            value={docDigitos}
            onChange={(e) => setDocDigitos(e.target.value)}
            placeholder="apenas números"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoDocumentoDigitos(docDigitos, commonOpts);
              if (!b) setErro('Informe dígitos do documento.');
              else void executar('documento', b);
            }}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoDocumentoDigitos(docDigitos, commonOpts) ?? { erro: 'vazio' }} />
        </LabCard>

        <GrupoTitulo label="Filtros exact e auxiliares (ES)" />
        <LabCard title="11b. terms — vários valores exactos" footer="Lista CSV de valores no mesmo campo (ex.: grau).">
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 font-mono text-xs px-2 py-1.5 mb-1"
            value={termsCampo}
            onChange={(e) => setTermsCampo(e.target.value)}
            placeholder="campo"
          />
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 font-mono text-xs px-2 py-1.5"
            value={termsVals}
            onChange={(e) => setTermsVals(e.target.value)}
            placeholder="valor1, valor2, …"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoTermsCampo(termsCampo, termsVals, commonOpts);
              if (!b) setErro('Informe campo e valores (CSV).');
              else void executar('terms_campo', b);
            }}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoTermsCampo(termsCampo, termsVals, commonOpts) ?? { erro: 'incompleto' }} />
        </LabCard>

        <LabCard title="11c. exists — campo presente" footer="Documentos que tenham o campo indexado (não-null).">
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 font-mono text-xs px-2 py-1.5"
            value={existsCampo}
            onChange={(e) => setExistsCampo(e.target.value)}
            placeholder="movimentos, assuntos, …"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoExistsField(existsCampo, commonOpts);
              if (!b) setErro('Informe o nome do campo.');
              else void executar('exists_field', b);
            }}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoExistsField(existsCampo, commonOpts) ?? { erro: 'vazio' }} />
        </LabCard>

        <LabCard title="11d. ids — _id de documentos" footer="Um ou vários _id (vírgula ou espaço), como na resposta hits[].">
          <textarea
            className="w-full min-h-[56px] rounded border border-slate-300 dark:border-white/15 font-mono text-[11px] px-2 py-1.5"
            value={idsTexto}
            onChange={(e) => setIdsTexto(e.target.value)}
            placeholder="id1 id2 …"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoIds(idsTexto, commonOpts);
              if (!b) setErro('Informe pelo menos um _id.');
              else void executar('ids_documentos', b);
            }}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoIds(idsTexto, commonOpts) ?? { erro: 'vazio' }} />
        </LabCard>

        <LabCard title="11e. prefix" footer="Prefixo analisado no campo (mapping dependente do tribunal).">
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 font-mono text-xs px-2 py-1.5 mb-1"
            value={prefixCampo}
            onChange={(e) => setPrefixCampo(e.target.value)}
            placeholder="campo"
          />
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 font-mono text-xs px-2 py-1.5"
            value={prefixVal}
            onChange={(e) => setPrefixVal(e.target.value)}
            placeholder="prefixo"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoPrefix(prefixCampo, prefixVal, commonOpts);
              if (!b) setErro('Informe campo e prefixo.');
              else void executar('prefix', b);
            }}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoPrefix(prefixCampo, prefixVal, commonOpts) ?? { erro: 'incompleto' }} />
        </LabCard>

        <LabCard title="11f. wildcard" footer="Padrão com * ou ? — pode ser custoso; use size baixo.">
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 font-mono text-xs px-2 py-1.5 mb-1"
            value={wcCampo}
            onChange={(e) => setWcCampo(e.target.value)}
            placeholder="campo"
          />
          <input
            className="w-full rounded border border-slate-300 dark:border-white/15 font-mono text-xs px-2 py-1.5"
            value={wcPadrao}
            onChange={(e) => setWcPadrao(e.target.value)}
            placeholder="*0001"
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              const b = datajudLabCorpoWildcard(wcCampo, wcPadrao, commonOpts);
              if (!b) setErro('Informe campo e padrão wildcard.');
              else void executar('wildcard', b);
            }}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoWildcard(wcCampo, wcPadrao, commonOpts) ?? { erro: 'incompleto' }} />
        </LabCard>

        <GrupoTitulo label="Smoke e paginação (wiki)" />
        <LabCard title="12. match_all" footer="Smoke test: devolve documentos do índice até `size`.">
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-slate-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => void executar('match_all', datajudLabCorpoMatchAll(commonOpts))}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoMatchAll(commonOpts)} />
        </LabCard>

        <LabCard
          title="12b. match_all + sort @timestamp asc"
          footer="Base do Ex. 3 da wiki: mesma ordem de sort para search_after entre páginas."
        >
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-slate-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => void executar('match_all_sort_timestamp', datajudLabCorpoMatchAllComSortTimestampAsc(commonOpts))}
          >
            Executar
          </button>
          <JsonPreview value={datajudLabCorpoMatchAllComSortTimestampAsc(commonOpts)} />
        </LabCard>

        <LabCard title="13. Corpo JSON livre" footer="Cole qualquer corpo válido para _search (aggs, sort, etc.).">
          <textarea
            className="w-full min-h-[120px] rounded border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] px-2 py-1.5 font-mono text-[11px]"
            value={jsonLivre}
            onChange={(e) => setJsonLivre(e.target.value)}
          />
          <button
            type="button"
            disabled={loading}
            className="px-3 py-1.5 rounded bg-emerald-700 text-white text-xs font-medium disabled:opacity-50"
            onClick={() => {
              try {
                const b = JSON.parse(jsonLivre);
                void executar('json_livre', b);
              } catch (e) {
                setErro(`JSON inválido: ${e?.message ?? e}`);
              }
            }}
          >
            Executar
          </button>
        </LabCard>
      </div>

      {erro ? (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-3 text-sm text-red-800 dark:text-red-200 whitespace-pre-wrap">
          {erro}
        </div>
      ) : null}

      {ultimoCorpo ? (
        <div className="rounded-lg border border-slate-200 dark:border-white/10 p-4 bg-white dark:bg-[#121821] text-sm space-y-2">
          <p className="font-medium text-slate-800 dark:text-slate-100">
            Último pedido: {ultimoTitulo} {loading ? '(a enviar…)' : ''}
          </p>
          <p className="text-xs text-slate-500">Corpo enviado</p>
          <JsonPreview value={ultimoCorpo} />
        </div>
      ) : null}

      {resultado?.ok ? (
        <div className="rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden text-sm space-y-4">
          <div className="px-3 py-2 font-medium bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-slate-200">
            Resposta · HTTP {resultado.statusHttp} · totalHits: {resultado.totalHits ?? '—'} · hits.length: {hits.length}
          </div>

          {primeiro ? (
            <div className="px-3 pb-3 space-y-2">
              <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Chaves no _source do 1.º hit (layout)</p>
              <div className="flex flex-wrap gap-1">
                {(primeiro.chavesSource ?? []).map((k) => (
                  <span
                    key={k}
                    className="text-[10px] font-mono rounded bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 text-slate-700 dark:text-slate-300"
                  >
                    {k}
                  </span>
                ))}
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs border-t border-slate-100 dark:border-white/10 pt-3">
                <dt className="text-slate-500">sistema</dt>
                <dd className="font-mono">{JSON.stringify(primeiro.sistema)}</dd>
                <dt className="text-slate-500">formato</dt>
                <dd className="font-mono">{JSON.stringify(primeiro.formato)}</dd>
                <dt className="text-slate-500">dataHoraUltimaAtualizacao</dt>
                <dd>{primeiro.dataHoraUltimaAtualizacao ?? '—'}</dd>
                <dt className="text-slate-500">@timestamp (índice)</dt>
                <dd className="font-mono">{primeiro.timestampIndice ?? '—'}</dd>
                <dt className="text-slate-500">movimentosCount / score</dt>
                <dd>
                  {primeiro.movimentosCount} · {primeiro.score ?? '—'}
                </dd>
              </dl>
            </div>
          ) : (
            <p className="px-3 text-slate-600 dark:text-slate-400">Nenhum hit na resposta.</p>
          )}

          <div className="overflow-x-auto border-t border-slate-100 dark:border-white/10">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 dark:bg-white/5 text-left">
                  <th className="p-2">#</th>
                  <th className="p-2">score</th>
                  <th className="p-2">numeroProcesso</th>
                  <th className="p-2">classe</th>
                  <th className="p-2">ajuizamento</th>
                  <th className="p-2">mov.</th>
                  <th className="p-2">id</th>
                  <th className="p-2" />
                </tr>
              </thead>
              <tbody>
                {hits.map((h, i) => (
                  <Fragment key={`hit-${i}-${h.id ?? h.numeroProcesso ?? ''}`}>
                    <tr className="border-t border-slate-100 dark:border-white/10 align-top">
                      <td className="p-2">{i + 1}</td>
                      <td className="p-2 font-mono">{h.score ?? '—'}</td>
                      <td className="p-2 font-mono max-w-[140px] truncate" title={h.numeroProcesso}>
                        {h.numeroProcesso}
                      </td>
                      <td className="p-2 max-w-[160px] truncate" title={h.classe}>
                        {h.classe ?? '—'}
                      </td>
                      <td className="p-2 whitespace-nowrap">{h.dataAjuizamento ?? '—'}</td>
                      <td className="p-2">{h.movimentosCount}</td>
                      <td className="p-2 font-mono max-w-[100px] truncate" title={h.id}>
                        {h.id ?? '—'}
                      </td>
                      <td className="p-2">
                        <button
                          type="button"
                          className="text-emerald-700 dark:text-emerald-400 underline text-[11px]"
                          onClick={() => setExpandidoId((cur) => (cur === h.id ? null : h.id))}
                        >
                          {expandidoId === h.id ? 'Fechar' : 'Detalhe'}
                        </button>
                      </td>
                    </tr>
                    {expandidoId === h.id ? (
                      <tr className="bg-slate-50/80 dark:bg-black/20">
                        <td colSpan={8} className="p-3">
                          <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-2">Objeto normalizado (UI)</p>
                          <pre className="text-[10px] font-mono max-h-56 overflow-auto rounded bg-white dark:bg-black/40 p-2 mb-3">
                            {JSON.stringify({ ...h, rawHit: '[ver abaixo]' }, null, 2)}
                          </pre>
                          <p className="text-[11px] font-medium text-slate-600 dark:text-slate-400 mb-2">rawHit (_source)</p>
                          <pre className="text-[10px] font-mono max-h-64 overflow-auto rounded bg-white dark:bg-black/40 p-2">
                            {JSON.stringify(h.rawHit, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          <details className="px-3 pb-3 text-xs">
            <summary className="cursor-pointer text-slate-500">JSON bruto completo da API</summary>
            <pre className="mt-2 max-h-96 overflow-auto rounded bg-slate-50 dark:bg-black/40 p-2 text-[10px]">
              {JSON.stringify(resultado.jsonBruto, null, 2)}
            </pre>
          </details>
        </div>
      ) : null}
    </div>
  );
}

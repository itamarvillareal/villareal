import { useState } from 'react';
import { Search } from 'lucide-react';
import {
  consultarProcessoDatajud,
  cnjEhProcessoTjgo,
} from '../../data/datajudApiClient.js';
import { cnjParaNumeroUnicoVinteDigitos, parseSegmentosCnj } from '../../data/publicacoesCnjTribunal.js';
import { mensagemErroAmigavel } from '../../utils/mensagemErroAmigavel.js';

function normalizarCnjDigitado(raw) {
  return String(raw ?? '')
    .trim()
    .replace(/\u2212/g, '-')
    .toUpperCase();
}

/**
 * Consulta DataJud por CNJ (TJGO) — interface para usuários do escritório.
 * @param {{ showDebug?: boolean }} props — JSON bruto só para administradores
 */
export function DataJudBuscaSimples({ showDebug = false }) {
  const [cnj, setCnj] = useState('');
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState(null);

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
        'Formato inválido. Use: NNNNNNN-DD.AAAA.J.TR.OOOO (ex.: 0000000-00.2023.8.09.0001).',
      );
      return;
    }
    if (!cnjEhProcessoTjgo(c)) {
      setErro(
        'Esta consulta rápida aceita apenas processos do TJGO (Tribunal de Justiça de Goiás), com o segmento .8.09. no número.',
      );
      return;
    }

    setLoading(true);
    try {
      const r = await consultarProcessoDatajud(c);
      setResultado(r);
      if (!r.ok && r.motivo !== 'nao_encontrado') {
        setErro(mensagemErroAmigavel(r.mensagem || r.erro || 'Consulta não concluída.', 'consultar o processo'));
      }
    } catch (e) {
      setErro(mensagemErroAmigavel(e, 'consultar o processo'));
    } finally {
      setLoading(false);
    }
  };

  const d = resultado?.dados;
  const n20 = cnjParaNumeroUnicoVinteDigitos(normalizarCnjDigitado(cnj));

  return (
    <section className="max-w-3xl mx-auto px-4 md:px-6 space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#121821] p-5 shadow-sm space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
            <Search className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Buscar processo</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Digite o número CNJ do processo no TJGO. Os dados vêm da API pública do CNJ (DataJud).
            </p>
          </div>
        </div>

        <label className="block text-sm">
          <span className="text-slate-700 dark:text-slate-300 font-medium">Número do processo (CNJ)</span>
          <input
            className="mt-1.5 w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-[#0f141c] px-3 py-2 text-sm font-mono"
            value={cnj}
            onChange={(e) => setCnj(e.target.value)}
            placeholder="Ex.: 0000000-00.2023.8.09.0001"
            aria-label="Número CNJ do processo"
            onKeyDown={(e) => {
              if (e.key === 'Enter') void consultar();
            }}
          />
          {n20 ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Referência interna (20 dígitos): <span className="font-mono">{n20}</span>
            </p>
          ) : null}
        </label>

        <button
          type="button"
          disabled={loading}
          onClick={() => void consultar()}
          className="w-full sm:w-auto px-5 py-2.5 text-sm font-semibold rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50"
        >
          {loading ? 'Buscando…' : 'Buscar processo'}
        </button>
      </div>

      {erro ? (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 p-3 text-sm text-red-800 dark:text-red-200"
        >
          {erro}
        </div>
      ) : null}

      {resultado && !erro ? (
        <div className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden text-sm bg-white dark:bg-[#121821]">
          <div className="px-4 py-3 font-medium bg-slate-100 dark:bg-white/5 text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-white/10">
            {resultado.ok && resultado.hit && d
              ? 'Processo encontrado'
              : resultado.ok && resultado.motivo === 'nao_encontrado'
                ? 'Nenhum resultado'
                : 'Consulta concluída'}
            {resultado.fromCache ? (
              <span className="ml-2 text-xs font-normal text-slate-500">(dados em cache)</span>
            ) : null}
          </div>
          <div className="p-4 space-y-3 text-slate-700 dark:text-slate-300">
            {resultado.hit && d ? (
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                <dt className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Processo</dt>
                <dd className="font-mono text-sm sm:col-span-1">{d.numeroProcesso ?? '—'}</dd>
                <dt className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Classe</dt>
                <dd>{d.classe ?? '—'}</dd>
                <dt className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Órgão julgador</dt>
                <dd>{d.orgaoJulgador ?? '—'}</dd>
                <dt className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Ajuizamento</dt>
                <dd>{d.dataAjuizamento ?? '—'}</dd>
                <dt className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wide">Último movimento</dt>
                <dd className="sm:col-span-2">
                  {d.ultimoMovimentoData ? `${d.ultimoMovimentoData} — ` : ''}
                  {d.ultimoMovimentoTexto ?? '—'}
                </dd>
              </dl>
            ) : (
              <p className="text-slate-600 dark:text-slate-400">
                {resultado.ok && resultado.motivo === 'nao_encontrado'
                  ? 'Não encontramos este processo no índice do TJGO. Confira o número ou tente mais tarde.'
                  : mensagemErroAmigavel(resultado.mensagem || 'Sem dados para exibir.', 'consultar o processo')}
              </p>
            )}
            {showDebug ? (
              <details className="text-xs pt-2 border-t border-slate-100 dark:border-white/10">
                <summary className="cursor-pointer text-slate-500">Detalhes técnicos (admin)</summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded bg-slate-50 dark:bg-black/40 p-2 text-[11px] font-mono">
                  {JSON.stringify(resultado.jsonBruto ?? resultado, null, 2)}
                </pre>
              </details>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Banknote,
  Check,
  CircleDollarSign,
  ClipboardCheck,
  Link2,
  Loader2,
  MessageCircle,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import { carregarFecharMesApi } from '../../../repositories/imoveisRepository.js';
import { ImoveisFilaRepassesTerceiros } from './ImoveisFilaRepassesTerceiros.jsx';
import { useImoveisCentral } from './ImoveisCentralContext.jsx';
import { competenciaLabel, formatBRL } from './imoveisCentralFormat.js';

function ChecklistItem({ icone: Icone, titulo, valor, meta, concluido, href, tom = 'slate' }) {
  const tons = {
    slate: 'border-slate-200 dark:border-slate-800',
    emerald: 'border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20',
    orange: 'border-orange-300 dark:border-orange-800 bg-orange-50/40 dark:bg-orange-950/20',
    red: 'border-red-300 dark:border-red-800 bg-red-50/40 dark:bg-red-950/20',
  };
  const pct = meta > 0 ? Math.min(100, Math.round((valor / meta) * 100)) : concluido ? 100 : 0;
  const body = (
    <div className={`rounded-xl border p-4 space-y-2 ${tons[tom] ?? tons.slate}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {Icone ? <Icone className="w-4 h-4 text-teal-600 shrink-0" aria-hidden /> : null}
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{titulo}</h3>
        </div>
        {concluido ? (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            <Check className="w-3.5 h-3.5" aria-hidden />
            OK
          </span>
        ) : null}
      </div>
      <p className="text-2xl font-bold tabular-nums text-slate-900 dark:text-slate-100">
        {typeof valor === 'number' && meta > 0 ? (
          <>
            {valor}
            <span className="text-base font-medium text-slate-500"> / {meta}</span>
          </>
        ) : (
          valor
        )}
      </p>
      {meta > 0 ? (
        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${concluido ? 'bg-emerald-500' : 'bg-teal-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
  if (href) {
    return (
      <Link to={href} className="block hover:opacity-95 transition-opacity">
        {body}
      </Link>
    );
  }
  return body;
}

export function ImoveisFecharMesPage() {
  const { competencia, porNumeroPlanilha, versaoRecarga } = useImoveisCentral();
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!featureFlags.useApiImoveis) return undefined;
    const ac = new AbortController();
    setCarregando(true);
    setErro('');
    carregarFecharMesApi({ competencia, signal: ac.signal })
      .then((r) => setDados(r || null))
      .catch((e) => {
        if (e?.name !== 'AbortError') setErro(e?.message || 'Falha ao carregar o checklist do mês.');
      })
      .finally(() => setCarregando(false));
    return () => ac.abort();
  }, [competencia, versaoRecarga]);

  const resumo = useMemo(() => {
    const c = dados?.checklist ?? {};
    return {
      alugueisRecebidos: Number(c.alugueisRecebidos) || 0,
      alugueisTotal: Number(c.alugueisTotal) || 0,
      cobrancasAFazer: Number(c.cobrancasAFazer) || 0,
      repassesHoje: Number(c.repassesHoje) || 0,
      repassesHojeValor: Number(c.repassesHojeValor) || 0,
      despesasAClassificar: Number(c.despesasAClassificar) || 0,
      sugestoesVinculo: Number(c.sugestoesVinculo) || 0,
    };
  }, [dados]);

  if (!featureFlags.useApiImoveis || !featureFlags.useApiFinanceiro) {
    return (
      <div className="p-6 text-sm text-slate-600 dark:text-slate-300">
        Ative <code className="mx-1">VITE_USE_API_IMOVEIS</code> e{' '}
        <code className="mx-1">VITE_USE_API_FINANCEIRO</code> para usar Fechar o Mês.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 max-w-[1500px] w-full mx-auto">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-slate-100">
              <ClipboardCheck className="w-4 h-4 text-teal-600" aria-hidden />
              Fechar o mês · {competenciaLabel(competencia)}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Checklist operacional antes de encerrar a competência: aluguéis recebidos, cobranças em aberto,
              repasses do dia e classificação pendente no extrato.
              {dados?.fonte === 'agregado' ? (
                <span className="ml-1 text-amber-700 dark:text-amber-300">
                  (dados agregados no front — endpoint dedicado ainda não disponível)
                </span>
              ) : null}
            </p>
          </div>
          {carregando ? (
            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              Atualizando…
            </span>
          ) : null}
        </div>
      </div>

      {erro ? <p className="text-sm text-red-700">{erro}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ChecklistItem
          icone={CircleDollarSign}
          titulo="Aluguéis recebidos"
          valor={resumo.alugueisRecebidos}
          meta={resumo.alugueisTotal}
          concluido={resumo.alugueisTotal > 0 && resumo.alugueisRecebidos >= resumo.alugueisTotal}
          href="/imoveis/conciliacao"
          tom={resumo.alugueisRecebidos >= resumo.alugueisTotal ? 'emerald' : 'orange'}
        />
        <ChecklistItem
          icone={MessageCircle}
          titulo="Cobranças a fazer"
          valor={resumo.cobrancasAFazer}
          meta={0}
          concluido={resumo.cobrancasAFazer === 0}
          href="/imoveis/conciliacao"
          tom={resumo.cobrancasAFazer > 0 ? 'red' : 'emerald'}
        />
        <ChecklistItem
          icone={Banknote}
          titulo="Repasses a pagar hoje"
          valor={resumo.repassesHoje}
          meta={0}
          concluido={resumo.repassesHoje === 0}
          href="#repasses-terceiros"
          tom={resumo.repassesHoje > 0 ? 'orange' : 'emerald'}
        />
        <ChecklistItem
          icone={Sparkles}
          titulo="Despesas / vínculos a classificar"
          valor={resumo.despesasAClassificar + resumo.sugestoesVinculo}
          meta={0}
          concluido={resumo.despesasAClassificar + resumo.sugestoesVinculo === 0}
          href="/imoveis/conciliacao#sugestoes-pagador"
          tom={resumo.despesasAClassificar + resumo.sugestoesVinculo > 0 ? 'orange' : 'emerald'}
        />
      </div>

      {resumo.repassesHoje > 0 ? (
        <p className="text-xs text-orange-800 dark:text-orange-200 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg px-3 py-2">
          <TriangleAlert className="w-3.5 h-3.5 inline mr-1 -mt-0.5" aria-hidden />
          {resumo.repassesHoje} repasse{resumo.repassesHoje === 1 ? '' : 's'} com dia de repasse hoje — total líquido
          estimado {formatBRL(resumo.repassesHojeValor)}.
        </p>
      ) : null}

      <section
        id="repasses-terceiros"
        className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3 scroll-mt-4"
      >
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
            <Banknote className="w-4 h-4 text-teal-600" aria-hidden />
            Fila de repasses · terceiros
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Imóveis de clientes externos (exclui imóveis próprios). Agrupados pelo dia de repasse cadastrado no
            contrato. Use <strong>Pago no banco</strong> para registrar o débito na conta corrente.
          </p>
        </div>
        <ImoveisFilaRepassesTerceiros
          repasses={dados?.repassesPendentes?.itens}
          porNumeroPlanilha={porNumeroPlanilha}
        />
      </section>

      <p className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
        <Link2 className="w-3.5 h-3.5 shrink-0" aria-hidden />
        Conciliação de aluguéis, cobranças e sugestões em{' '}
        <Link to="/imoveis/conciliacao" className="text-teal-700 dark:text-teal-300 hover:underline">
          Conciliação de aluguéis
        </Link>
        .
      </p>
    </div>
  );
}

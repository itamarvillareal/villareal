import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Building2,
  FileText,
  LayoutGrid,
  Receipt,
  UserRound,
  Wallet,
} from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  listarContratosLocacaoImovelApi,
  obterMatrizCompetenciasApi,
} from '../../../repositories/imoveisRepository.js';
import { Imoveis } from '../../Imoveis.jsx';
import { ImoveisAdministracaoFinanceiro } from '../../ImoveisAdministracaoFinanceiro.jsx';
import { useImoveisCentral } from './ImoveisCentralContext.jsx';
import { competenciaLabel, formatBRL, statusMesItem } from './imoveisCentralFormat.js';

const ABAS = [
  { key: 'resumo', label: 'Resumo' },
  { key: 'cadastro', label: 'Cadastro' },
  { key: 'conta-corrente', label: 'Conta Corrente' },
  { key: 'contratos', label: 'Contrato & Docs' },
  { key: 'operacional', label: 'IPTU & Demandas' },
];

function CardInfo({ titulo, children }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{titulo}</p>
      <div className="mt-1 text-sm text-slate-800 dark:text-slate-200">{children}</div>
    </div>
  );
}

const ESTADO_MES_CLS = {
  VINCULADO: 'bg-emerald-500',
  CANDIDATO_UNICO: 'bg-amber-400',
  CANDIDATOS_MULTIPLOS: 'bg-amber-500',
  SEM_CANDIDATO: 'bg-slate-300 dark:bg-slate-700',
};

function HistoricoCompetencias({ matriz }) {
  const meses = Array.isArray(matriz?.meses) ? matriz.meses.slice(-12) : [];
  if (meses.length === 0) {
    return <p className="text-xs text-slate-500">Sem histórico de competências (contrato sem vínculos ainda).</p>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {meses.map((m) => (
        <div
          key={m.competencia}
          className="flex flex-col items-center gap-1"
          title={`${m.competencia} · ${m.estado === 'VINCULADO' ? 'aluguel vinculado' : m.estado === 'SEM_CANDIDATO' ? 'sem candidato' : 'candidato a confirmar'}`}
        >
          <span className={`h-3 w-6 rounded-sm ${ESTADO_MES_CLS[m.estado] ?? 'bg-slate-200'}`} aria-hidden />
          <span className="text-[10px] text-slate-500 tabular-nums">{competenciaLabel(m.competencia)}</span>
        </div>
      ))}
    </div>
  );
}

function AbaResumo({ item, competencia }) {
  const [matriz, setMatriz] = useState(null);

  useEffect(() => {
    if (!featureFlags.useApiImoveis || !item?.contratoId) {
      setMatriz(null);
      return undefined;
    }
    let ativo = true;
    obterMatrizCompetenciasApi(item.contratoId, { meses: 12 })
      .then((m) => {
        if (ativo) setMatriz(m || null);
      })
      .catch(() => {});
    return () => {
      ativo = false;
    };
  }, [item?.contratoId]);

  if (!item) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Imóvel não encontrado na visão geral. Confira o número ou recarregue a central.
      </div>
    );
  }

  const st = statusMesItem(item);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CardInfo titulo="Contrato vigente">
          {item.contratoId ? (
            <>
              <p className="font-semibold">{item.valorAluguel != null ? formatBRL(item.valorAluguel) : '—'} / mês</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Taxa adm. {item.taxaAdministracaoPercent != null ? `${Number(item.taxaAdministracaoPercent).toFixed(2)}%` : '—'} ·
                venc. dia {item.diaVencimentoAluguel ?? '—'} · repasse dia {item.diaRepasse ?? '—'}
              </p>
              <p className="text-xs text-slate-500">status {item.contratoStatus ?? '—'}{item.repasseInterno ? ' · imóvel próprio' : ''}</p>
            </>
          ) : (
            <p className="text-slate-500">Sem contrato cadastrado.</p>
          )}
        </CardInfo>
        <CardInfo titulo="Inquilino">
          <p className="flex items-center gap-1.5 font-medium">
            <UserRound className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden />
            {item.inquilino || '—'}
          </p>
        </CardInfo>
        <CardInfo titulo="Proprietário">
          <p className="flex items-center gap-1.5 font-medium">
            <UserRound className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden />
            {item.proprietario || '—'}
          </p>
        </CardInfo>
        <CardInfo titulo="Vínculo processo">
          {item.codigoCliente ? (
            <p className="font-mono text-xs">
              Cod. {item.codigoCliente} · Proc. {item.numeroInterno ?? '—'}
            </p>
          ) : (
            <p className="text-slate-500">Sem Cod.+Proc. principal.</p>
          )}
        </CardInfo>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
            Competência {competenciaLabel(competencia)}
          </h3>
          <span className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-semibold ${st.cls}`}>
            {st.label}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CardInfo titulo="Aluguel recebido">
            <p className="font-semibold text-emerald-700 dark:text-emerald-300 tabular-nums">
              {formatBRL(item.aluguelRecebido)}
            </p>
          </CardInfo>
          <CardInfo titulo="Repassado">
            <p className="font-semibold tabular-nums">{formatBRL(item.repassado)}</p>
            <p className="text-xs text-slate-500">mês anterior {formatBRL(item.repasseMesAnterior)}</p>
          </CardInfo>
          <CardInfo titulo="Despesas">
            <p className="font-semibold text-orange-700 dark:text-orange-300 tabular-nums">{formatBRL(item.despesas)}</p>
          </CardInfo>
          <CardInfo titulo="Resultado escritório">
            <p className="font-semibold text-teal-700 dark:text-teal-300 tabular-nums">
              {formatBRL(item.resultadoEscritorio)}
            </p>
          </CardInfo>
        </div>
      </div>

      {item.contratoId ? (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Últimos 12 meses (aluguel)</h3>
          <HistoricoCompetencias matriz={matriz} />
          <p className="text-[11px] text-slate-500">
            Verde: aluguel vinculado · âmbar: candidato a confirmar · cinza: sem candidato. Detalhe na aba Conta Corrente.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function AbaContratos({ item, onIrParaCadastro }) {
  const [contratos, setContratos] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!item?.imovelId) {
      setContratos([]);
      return undefined;
    }
    let ativo = true;
    const ac = new AbortController();
    setCarregando(true);
    setErro('');
    listarContratosLocacaoImovelApi(item.imovelId, { signal: ac.signal })
      .then((lista) => {
        if (ativo) setContratos(lista);
      })
      .catch((e) => {
        if (ativo && e?.name !== 'AbortError') setErro(e?.message || 'Falha ao listar contratos.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
      ac.abort();
    };
  }, [item?.imovelId]);

  const th =
    'px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 border-b border-slate-200 dark:border-slate-800 whitespace-nowrap';
  const td = 'px-3 py-2 text-sm text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800/60';

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Contratos de locação</h3>
          <button
            type="button"
            onClick={onIrParaCadastro}
            className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border border-teal-600 bg-teal-50 text-teal-900 font-medium hover:bg-teal-100 dark:bg-teal-950/40 dark:text-teal-200"
          >
            <FileText className="w-3.5 h-3.5" aria-hidden />
            Editar / gerar contrato (no Cadastro)
          </button>
        </div>
        {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
        {carregando ? <p className="text-sm text-slate-500">Carregando contratos…</p> : null}
        {!carregando && contratos.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhum contrato na API para este imóvel. Preencha os dados de locação na aba Cadastro para criar um.
          </p>
        ) : null}
        {contratos.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[720px] text-left border-collapse">
              <thead>
                <tr>
                  <th className={th}>Id</th>
                  <th className={th}>Status</th>
                  <th className={th}>Início</th>
                  <th className={th}>Fim</th>
                  <th className={`${th} text-right`}>Aluguel</th>
                  <th className={`${th} text-right`}>Taxa adm.</th>
                  <th className={th}>Dias (venc./rep.)</th>
                </tr>
              </thead>
              <tbody>
                {contratos.map((c) => (
                  <tr key={c.id}>
                    <td className={`${td} font-mono text-xs`}>{c.id}</td>
                    <td className={td}>
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full border text-[11px] font-semibold ${
                          String(c.status).toUpperCase() === 'VIGENTE'
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-slate-100 text-slate-600 border-slate-300'
                        }`}
                      >
                        {c.status ?? '—'}
                      </span>
                    </td>
                    <td className={`${td} tabular-nums`}>{c.dataInicio ?? '—'}</td>
                    <td className={`${td} tabular-nums`}>{c.dataFim ?? '—'}</td>
                    <td className={`${td} text-right tabular-nums`}>
                      {c.valorAluguel != null ? formatBRL(c.valorAluguel) : '—'}
                    </td>
                    <td className={`${td} text-right tabular-nums`}>
                      {c.taxaAdministracaoPercent != null ? `${Number(c.taxaAdministracaoPercent).toFixed(2)}%` : '—'}
                    </td>
                    <td className={`${td} tabular-nums text-xs`}>
                      {c.diaVencimentoAluguel ?? '—'} / {c.diaRepasse ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="text-[11px] text-slate-500">
          A geração do PDF do contrato (e o preview) fica na aba Cadastro, botão «Gerar contrato de locação».
        </p>
      </div>
    </div>
  );
}

function AbaOperacional({ item }) {
  const cardCls =
    'flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-teal-300 hover:shadow-sm transition-colors';
  // /iptu/:imovelId usa o id interno da API (não o nº da planilha).
  const iptuHref = item?.imovelId != null ? `/iptu/${item.imovelId}` : '/iptu';
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Link to={iptuHref} className={cardCls}>
        <Receipt className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" aria-hidden />
        <span>
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">IPTU do imóvel</span>
          <span className="block text-xs text-slate-500 mt-0.5">Parcelas, consultas de débito e histórico anual.</span>
        </span>
      </Link>
      <Link to="/imoveis/demandas" className={cardCls}>
        <LayoutGrid className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" aria-hidden />
        <span>
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Demandas</span>
          <span className="block text-xs text-slate-500 mt-0.5">Manutenções e pendências operacionais por imóvel.</span>
        </span>
      </Link>
      <Link to="/imoveis/pagamentos" className={cardCls}>
        <Wallet className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" aria-hidden />
        <span>
          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Pagamentos</span>
          <span className="block text-xs text-slate-500 mt-0.5">Contas a pagar (condomínio, IPTU, manutenção…).</span>
        </span>
      </Link>
    </div>
  );
}

export function ImovelDetalhePage() {
  const navigate = useNavigate();
  const { numero: numeroParam } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const numero = Number(numeroParam);
  const numeroValido = Number.isFinite(numero) && numero >= 1;

  const { competencia, porNumeroPlanilha, carregando } = useImoveisCentral();
  const item = numeroValido ? (porNumeroPlanilha.get(numero) ?? null) : null;

  const abaParam = searchParams.get('aba');
  const aba = useMemo(
    () => (ABAS.some((a) => a.key === abaParam) ? abaParam : 'resumo'),
    [abaParam],
  );

  function setAba(key) {
    const next = new URLSearchParams(searchParams);
    if (key === 'resumo') next.delete('aba');
    else next.set('aba', key);
    setSearchParams(next, { replace: true });
  }

  if (!numeroValido) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Número de imóvel inválido.{' '}
          <button type="button" className="underline font-medium" onClick={() => navigate('/imoveis')}>
            Voltar à Visão Geral
          </button>
        </div>
      </div>
    );
  }

  const tituloImovel =
    [item?.condominio, item?.unidade].filter(Boolean).join(' · ') ||
    item?.titulo ||
    item?.enderecoCompleto ||
    `Imóvel ${numero}`;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 pt-3">
        <div className="max-w-[1500px] mx-auto">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => navigate('/imoveis')}
              className="p-1.5 rounded-md border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 shrink-0"
              aria-label="Voltar à Visão Geral"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <Building2 className="w-4 h-4 text-teal-600 shrink-0" aria-hidden />
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
                #{numero} — {tituloImovel}
              </h2>
              <p className="text-xs text-slate-500 truncate">
                {item?.inquilino ? `${item.inquilino} · ` : ''}
                {item?.valorAluguel != null ? `Aluguel ${formatBRL(item.valorAluguel)}` : ''}
                {!item && carregando ? 'Carregando dados…' : ''}
              </p>
            </div>
          </div>
          <nav className="mt-2 flex gap-1 overflow-x-auto" aria-label="Abas do imóvel">
            {ABAS.map((a) => (
              <button
                key={a.key}
                type="button"
                onClick={() => setAba(a.key)}
                className={`px-3 py-2 text-[13px] whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  aba === a.key
                    ? 'border-teal-500 font-semibold text-teal-800 dark:text-teal-300'
                    : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {a.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {aba === 'resumo' ? (
          <div className="p-4 max-w-[1500px] mx-auto w-full">
            {carregando && !item ? (
              <p className="text-sm text-slate-500">Carregando visão geral…</p>
            ) : (
              <AbaResumo item={item} competencia={competencia} />
            )}
          </div>
        ) : null}
        {aba === 'cadastro' ? <Imoveis modoModal imovelIdInicial={numero} /> : null}
        {aba === 'conta-corrente' ? (
          <ImoveisAdministracaoFinanceiro
            imovelIdProp={numero}
            imovelIdApiProp={item?.imovelId ?? null}
            embutido
          />
        ) : null}
        {aba === 'contratos' ? (
          <div className="p-4 max-w-[1500px] mx-auto w-full">
            <AbaContratos item={item} onIrParaCadastro={() => setAba('cadastro')} />
          </div>
        ) : null}
        {aba === 'operacional' ? (
          <div className="p-4 max-w-[1500px] mx-auto w-full">
            <AbaOperacional item={item} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

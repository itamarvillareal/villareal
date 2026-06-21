import { useCallback, useEffect, useState } from 'react';
import { Link2, CircleDollarSign, HandCoins, RefreshCw, CalendarClock, PhoneCall } from 'lucide-react';
import { obterAcoesDoDiaApi } from '../repositories/acoesDoDiaRepository.js';
import { vincularReconciliacaoApi } from '../repositories/imoveisRepository.js';
import { classificarAlvaraHonorarioApi } from '../repositories/honorariosRepository.js';
import { featureFlags } from '../config/featureFlags.js';

function formatBRL(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function formatData(iso) {
  if (!iso) return '—';
  const s = String(iso).slice(0, 10);
  const [y, m, d] = s.split('-');
  if (!y || !m || !d) return s;
  return `${d}/${m}/${y}`;
}

function formatDadosBancarios(raw) {
  if (!raw) return '—';
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const parts = [o.titular, o.chavePix && `Pix ${o.chavePix}`, o.banco, o.agencia && `ag ${o.agencia}`, o.conta && `cc ${o.conta}`]
      .filter(Boolean);
    return parts.length ? parts.join(' · ') : raw;
  } catch {
    return String(raw);
  }
}

function competenciaAtual() {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}`;
}

function BlocoGrupo({ titulo, icone: Icone, quantidade, total, cor, children, vazio }) {
  return (
    <section className="bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden">
      <header className={`px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2 ${cor}`}>
        <div className="flex items-center gap-2">
          <Icone className="w-5 h-5 shrink-0" aria-hidden />
          <h2 className="text-base font-semibold">{titulo}</h2>
        </div>
        <div className="text-sm tabular-nums">
          <span className="font-semibold">{quantidade}</span>
          <span className="opacity-80"> · {formatBRL(total)}</span>
        </div>
      </header>
      <div className="p-4">
        {vazio ? (
          <p className="text-sm text-slate-500">Nada pendente neste grupo.</p>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

export function AcoesDoDia() {
  const [dados, setDados] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [tick, setTick] = useState(0);
  const [vinculando, setVinculando] = useState(null);

  const recarregar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    obterAcoesDoDiaApi({ competencia: competenciaAtual() })
      .then((resp) => {
        if (ativo) setDados(resp);
      })
      .catch((e) => {
        if (ativo) setErro(e?.message || 'Falha ao carregar ações do dia.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [tick]);

  const vincularCredito = async (contratoId, lancamentoId, competencia) => {
    if (!featureFlags.useApiImoveis) {
      setErro('Ative a API de imóveis para vincular aluguéis.');
      return;
    }
    const chave = `imovel-${contratoId}-${lancamentoId}`;
    setVinculando(chave);
    setErro('');
    try {
      await vincularReconciliacaoApi(contratoId, [
        { lancamentoFinanceiroId: lancamentoId, papel: 'ALUGUEL', competenciaMes: competencia },
      ]);
      recarregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao vincular crédito.');
    } finally {
      setVinculando(null);
    }
  };

  const classificarAlvara = async (lancamentoId) => {
    if (!featureFlags.useApiFinanceiro) {
      setErro('Ative a API financeiro para classificar alvará.');
      return;
    }
    const chave = `alvara-${lancamentoId}`;
    setVinculando(chave);
    setErro('');
    try {
      await classificarAlvaraHonorarioApi(lancamentoId);
      recarregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao marcar como alvará.');
    } finally {
      setVinculando(null);
    }
  };

  const competencia = dados?.competencia || competenciaAtual();

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ações do dia</h1>
          <p className="text-sm text-slate-600 mt-1">
            Painel derivado — competência <strong>{competencia}</strong>. Conciliar, cobrar, repassar e renegociar.
          </p>
        </div>
        <button
          type="button"
          onClick={recarregar}
          disabled={carregando}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {erro ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{erro}</div>
      ) : null}

      {carregando && !dados ? (
        <p className="text-sm text-indigo-700">Carregando painel…</p>
      ) : null}

      {dados ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <BlocoGrupo
            titulo="Conciliar"
            icone={Link2}
            quantidade={dados.conciliar?.quantidade ?? 0}
            total={dados.conciliar?.total ?? 0}
            cor="bg-indigo-50 border-indigo-100 text-indigo-950"
            vazio={!(dados.conciliar?.itens?.length > 0)}
          >
            <ul className="space-y-4">
              {(dados.conciliar?.itens ?? []).map((item) => {
                const ehAlvara = item.origem === 'ALVARA';
                const rotulo = ehAlvara
                  ? [
                      item.contratanteNome,
                      item.codigoCliente ? `Cli. ${item.codigoCliente}` : null,
                      item.numeroInterno != null ? `Proc. ${item.numeroInterno}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : [
                      item.imovelNumeroPlanilha != null ? `#${item.imovelNumeroPlanilha}` : null,
                      item.locadorNome,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                return (
                  <li
                    key={`${item.origem}-${item.contratoId}`}
                    className="rounded-lg border border-slate-200 p-3 space-y-2"
                  >
                    <div className="flex flex-wrap justify-between gap-2 text-sm">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-900">{rotulo || (ehAlvara ? 'Processo' : 'Imóvel')}</p>
                          <span
                            className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                              ehAlvara
                                ? 'bg-violet-100 text-violet-900'
                                : 'bg-teal-100 text-teal-900'
                            }`}
                          >
                            {ehAlvara ? 'Alvará' : 'Aluguel'}
                          </span>
                        </div>
                        <p className="text-slate-600 text-xs break-words">
                          {ehAlvara
                            ? item.percentualProveito != null
                              ? `Contrato ${item.percentualProveito}% proveito`
                              : 'Contrato percentual'
                            : item.imovelEndereco}
                        </p>
                      </div>
                      <div className="text-right tabular-nums">
                        <p className="font-semibold">{formatBRL(item.valorAluguel)}</p>
                        <p className="text-xs text-red-700">{item.diasEmAtraso} dia(s) em atraso</p>
                      </div>
                    </div>
                    <ul className="space-y-2">
                      {(item.candidatos ?? []).map((c) => {
                        const chave = ehAlvara
                          ? `alvara-${c.lancamentoId}`
                          : `imovel-${item.contratoId}-${c.lancamentoId}`;
                        return (
                          <li
                            key={c.lancamentoId}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 text-sm"
                          >
                            <div>
                              <span className="font-medium tabular-nums">{formatBRL(c.valor)}</span>
                              <span className="text-slate-500"> · {formatData(c.data)}</span>
                              {c.descricao ? (
                                <p className="text-xs text-slate-600 truncate max-w-md">{c.descricao}</p>
                              ) : null}
                              {ehAlvara && c.retencao != null && c.repasseEsperado != null ? (
                                <p className="text-xs text-violet-800 mt-0.5">
                                  Retenção {formatBRL(c.retencao)} · repasse {formatBRL(c.repasseEsperado)}
                                </p>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              disabled={vinculando === chave}
                              onClick={() =>
                                ehAlvara
                                  ? classificarAlvara(c.lancamentoId)
                                  : vincularCredito(item.contratoId, c.lancamentoId, competencia)
                              }
                              className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-md disabled:opacity-50 ${
                                ehAlvara
                                  ? 'bg-violet-600 text-white hover:bg-violet-700'
                                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
                              }`}
                            >
                              {vinculando === chave
                                ? '…'
                                : ehAlvara
                                  ? 'Marcar como alvará'
                                  : 'É este'}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ul>
          </BlocoGrupo>

          <BlocoGrupo
            titulo="Cobrar"
            icone={PhoneCall}
            quantidade={dados.cobrar?.quantidade ?? 0}
            total={dados.cobrar?.total ?? 0}
            cor="bg-red-50 border-red-100 text-red-950"
            vazio={!(dados.cobrar?.itens?.length > 0)}
          >
            <ul className="divide-y divide-slate-100">
              {(dados.cobrar?.itens ?? []).map((item, idx) => (
                <li key={`${item.tipo}-${item.contratoId ?? idx}-${item.descricao}`} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-slate-500 mr-2">
                        {item.tipo}
                      </span>
                      <span className="font-medium text-slate-900 break-words">{item.descricao}</span>
                    </div>
                    <div className="text-right tabular-nums shrink-0">
                      <p className="font-semibold">{formatBRL(item.valor)}</p>
                      <p className="text-xs text-red-700">{item.diasEmAtraso} dia(s)</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </BlocoGrupo>

          <BlocoGrupo
            titulo="Repassar"
            icone={HandCoins}
            quantidade={dados.repassar?.quantidade ?? 0}
            total={dados.repassar?.total ?? 0}
            cor="bg-amber-50 border-amber-100 text-amber-950"
            vazio={!(dados.repassar?.itens?.length > 0)}
          >
            <ul className="divide-y divide-slate-100">
              {(dados.repassar?.itens ?? []).map((item) => {
                const ehProcesso = item.origem === 'PROCESSO';
                const chave = ehProcesso
                  ? `proc-${item.processoId}-${item.alvaraLancamentoId ?? item.contratoId}`
                  : `${item.contratoId}-${item.competencia}`;
                const titulo = ehProcesso
                  ? item.contratanteNome || 'Contratante'
                  : item.locadorNome || '—';
                const subtitulo = ehProcesso
                  ? [
                      item.codigoCliente ? `Cli. ${item.codigoCliente}` : null,
                      item.numeroInterno != null ? `Proc. ${item.numeroInterno}` : null,
                      item.valorAlvara != null ? `Alvará ${formatBRL(item.valorAlvara)}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')
                  : [
                      item.imovelNumeroPlanilha != null ? `#${item.imovelNumeroPlanilha}` : null,
                      item.imovelEndereco,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                return (
                <li key={chave} className="py-3 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{titulo}</p>
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                            ehProcesso
                              ? 'bg-violet-100 text-violet-900'
                              : 'bg-teal-100 text-teal-900'
                          }`}
                        >
                          {ehProcesso ? 'Processo' : 'Imóvel'}
                        </span>
                      </div>
                      <p className="text-slate-600 text-xs break-words">{subtitulo || '—'}</p>
                      {ehProcesso && item.retencao != null && item.repasseEsperado != null ? (
                        <p className="text-xs text-slate-600 mt-0.5">
                          Retenção {formatBRL(item.retencao)} · repasse esperado {formatBRL(item.repasseEsperado)}
                        </p>
                      ) : null}
                    </div>
                    <p className="font-semibold tabular-nums">{formatBRL(item.valorEmAberto)}</p>
                  </div>
                  {!ehProcesso ? (
                    <p className="text-xs text-slate-600 break-words">
                      <span className="font-medium">Destino:</span> {formatDadosBancarios(item.dadosBancariosRepasse)}
                      {item.competencia ? ` · ${item.competencia}` : ''}
                    </p>
                  ) : item.competencia ? (
                    <p className="text-xs text-slate-500">Ref. {item.competencia}</p>
                  ) : null}
                </li>
                );
              })}
            </ul>
          </BlocoGrupo>

          <BlocoGrupo
            titulo="Renegociar"
            icone={CalendarClock}
            quantidade={dados.renegociar?.quantidade ?? 0}
            total={dados.renegociar?.total ?? 0}
            cor="bg-violet-50 border-violet-100 text-violet-950"
            vazio={!(dados.renegociar?.itens?.length > 0)}
          >
            <ul className="divide-y divide-slate-100">
              {(dados.renegociar?.itens ?? []).map((item) => (
                <li key={item.contratoId} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <div>
                      <p className="font-semibold">
                        {item.imovelNumeroPlanilha != null ? `#${item.imovelNumeroPlanilha}` : 'Imóvel'}
                        {item.locadorNome ? ` · ${item.locadorNome}` : ''}
                      </p>
                      <p className="text-xs text-slate-600 break-words">{item.imovelEndereco}</p>
                      <p className="text-xs text-violet-800 mt-1">
                        Vence em {formatData(item.dataFim)} ({item.diasRestantes} dia(s))
                      </p>
                    </div>
                    <p className="font-semibold tabular-nums shrink-0">{formatBRL(item.valorAluguel)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </BlocoGrupo>
        </div>
      ) : null}

      {!carregando && dados ? (
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <CircleDollarSign className="w-3.5 h-3.5" />
          Valores derivados dos livros A Receber e A Repassar — nada é gravado nesta tela, exceto ao confirmar um crédito.
        </p>
      ) : null}
    </div>
  );
}

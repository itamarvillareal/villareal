import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Link2, CircleDollarSign, HandCoins, RefreshCw, CalendarClock, PhoneCall, Wallet, Building2 } from 'lucide-react';
import { obterAcoesDoDiaApi } from '../repositories/acoesDoDiaRepository.js';
import { listarCandidatosDespesaCondominioApi, confirmarDespesaCondominioApi } from '../repositories/despesaCondominioRepository.js';
import { vincularReconciliacaoApi } from '../repositories/imoveisRepository.js';
import { classificarAlvaraHonorarioApi } from '../repositories/honorariosRepository.js';
import { marcarPagamentoPago } from '../repositories/pagamentosRepository.js';
import { featureFlags } from '../config/featureFlags.js';
import { buildRouterStateChaveClienteProcesso } from '../domain/camposProcessoCliente.js';

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

function hojeIsoLocal() {
  const h = new Date();
  const y = h.getFullYear();
  const m = String(h.getMonth() + 1).padStart(2, '0');
  const d = String(h.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function rotuloConfianca(c) {
  if (c === 'ALTA') return { label: 'Alta', cls: 'bg-emerald-100 text-emerald-900' };
  if (c === 'MEDIA') return { label: 'Média', cls: 'bg-amber-100 text-amber-900' };
  return { label: 'Baixa', cls: 'bg-slate-200 text-slate-700' };
}
function montarContextoPagar(item) {
  const partes = [];
  if (item.categoria) partes.push(item.categoria);
  if (item.imovelNumeroPlanilha != null) partes.push(`Imóvel #${item.imovelNumeroPlanilha}`);
  if (item.numeroInterno != null) partes.push(`Proc. ${item.numeroInterno}`);
  if (item.clienteId != null) partes.push(`Cliente ${item.clienteId}`);
  return partes.length ? partes.join(' · ') : '—';
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
  const navigate = useNavigate();
  const [dados, setDados] = useState(null);
  const [candidatosCondominio, setCandidatosCondominio] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [tick, setTick] = useState(0);
  const [vinculando, setVinculando] = useState(null);
  const [pagoModal, setPagoModal] = useState(null);
  const [pagoData, setPagoData] = useState(hojeIsoLocal());
  const [pagoSemComp, setPagoSemComp] = useState(false);
  const [marcandoPago, setMarcandoPago] = useState(false);
  const [unidadeCondominio, setUnidadeCondominio] = useState({});
  const [confirmandoCondominio, setConfirmandoCondominio] = useState(null);

  const recarregar = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro('');
    Promise.allSettled([
      obterAcoesDoDiaApi({ competencia: competenciaAtual() }),
      listarCandidatosDespesaCondominioApi(),
    ])
      .then(([acoes, candidatos]) => {
        if (!ativo) return;
        if (acoes.status === 'fulfilled') setDados(acoes.value);
        else setErro(acoes.reason?.message || 'Falha ao carregar ações do dia.');
        if (candidatos.status === 'fulfilled') setCandidatosCondominio(candidatos.value);
        else setCandidatosCondominio(null);
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

  const abrirMarcarPago = (pagamentoId) => {
    setPagoModal(pagamentoId);
    setPagoData(hojeIsoLocal());
    setPagoSemComp(false);
  };

  const confirmarMarcarPago = async () => {
    if (!pagoModal) return;
    setMarcandoPago(true);
    setErro('');
    try {
      await marcarPagamentoPago(pagoModal, {
        dataPagamentoEfetivo: pagoData,
        semComprovante: pagoSemComp,
      });
      setPagoModal(null);
      recarregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao marcar como pago.');
    } finally {
      setMarcandoPago(false);
    }
  };

  const confirmarCondominioEscritorio = async (grupo, imovelId) => {
    if (!imovelId) {
      setErro('Escolha a unidade antes de confirmar.');
      return;
    }
    const chave = `${grupo.descricaoNorm}-${imovelId}`;
    setConfirmandoCondominio(chave);
    setErro('');
    try {
      await confirmarDespesaCondominioApi({
        obrigacaoChave: grupo.obrigacaoChave,
        imovelId,
      });
      recarregar();
    } catch (e) {
      setErro(e?.message || 'Falha ao confirmar condomínio.');
    } finally {
      setConfirmandoCondominio(null);
    }
  };

  const competencia = dados?.competencia || competenciaAtual();

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Ações do dia</h1>
          <p className="text-sm text-slate-600 mt-1">
            Painel derivado — competência <strong>{competencia}</strong>. Conciliar, cobrar, repassar, pagar e renegociar.
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
                  {item.tipo === 'ACORDO_PARCELA' && item.codigoCliente && item.numeroInterno != null ? (
                    <div className="mt-2">
                      <button
                        type="button"
                        onClick={() =>
                          navigate('/calculos', {
                            state: {
                              ...buildRouterStateChaveClienteProcesso(item.codigoCliente, item.numeroInterno),
                              abaCalculos: 'Acordos',
                            },
                          })
                        }
                        className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md bg-red-600 text-white hover:bg-red-700"
                      >
                        Ver na aba Acordos
                      </button>
                    </div>
                  ) : null}
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
                const ehAtrasado =
                  !ehProcesso && item.competencia && String(item.competencia) < String(competencia);
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
                        {ehAtrasado ? (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-900">
                            Atrasado
                          </span>
                        ) : null}
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
            titulo="Pagar"
            icone={Wallet}
            quantidade={dados.pagar?.quantidade ?? 0}
            total={dados.pagar?.total ?? 0}
            cor="bg-emerald-50 border-emerald-100 text-emerald-950"
            vazio={!(dados.pagar?.itens?.length > 0)}
          >
            <ul className="divide-y divide-slate-100">
              {(dados.pagar?.itens ?? []).map((item) => (
                <li key={item.pagamentoId} className="py-3 first:pt-0 last:pb-0 space-y-2">
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900 break-words">{item.descricao || 'Pagamento'}</p>
                        {item.vencido ? (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-900">
                            Vencido
                          </span>
                        ) : null}
                      </div>
                      <p className="text-xs text-slate-600 break-words">{montarContextoPagar(item)}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Venc. {formatData(item.vencimento)}</p>
                    </div>
                    <p className="font-semibold tabular-nums shrink-0">{formatBRL(item.valor)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/pagamentos?pagamentoId=${item.pagamentoId}`}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white hover:bg-slate-50"
                    >
                      Abrir no pagamentos
                    </Link>
                    <button
                      type="button"
                      disabled={marcandoPago}
                      onClick={() => abrirMarcarPago(item.pagamentoId)}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      Marcar pago
                    </button>
                  </div>
                </li>
              ))}
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

      {candidatosCondominio ? (
        <BlocoGrupo
          titulo="Condomínio — candidatos (extrato)"
          icone={Building2}
          quantidade={candidatosCondominio.quantidadeGrupos ?? 0}
          total={0}
          cor="bg-cyan-50 border-cyan-100 text-cyan-950"
          vazio={!(candidatosCondominio.grupos?.length > 0)}
        >
          <p className="text-xs text-cyan-900/80 mb-3">
            Débitos recorrentes detectados no extrato (contas A/I). Confirme alta confiança em um toque; prédios
            compartilhados exigem escolher a unidade.{' '}
            <strong>{candidatosCondominio.gruposImovelUnico ?? 0}</strong> imóvel único,{' '}
            <strong>{candidatosCondominio.gruposCondominioCompartilhado ?? 0}</strong> prédio compartilhado,{' '}
            <strong>{candidatosCondominio.gruposSemMatch ?? 0}</strong> sem match.
          </p>
          <ul className="space-y-4">
            {(candidatosCondominio.grupos ?? []).map((g) => {
              const conf = rotuloConfianca(g.confianca);
              const ehAlta = g.confianca === 'ALTA';
              const ehMedia = g.confianca === 'MEDIA';
              const chaveGrupo = g.obrigacaoChave ?? g.descricaoNorm;
              const imovelConfirmar = ehAlta
                ? g.imovelSugeridoId
                : unidadeCondominio[chaveGrupo] ?? null;
              const chaveConfirm = `${chaveGrupo}-${imovelConfirmar ?? 'x'}`;
              const confirmando = confirmandoCondominio === chaveConfirm;
              return (
                <li key={chaveGrupo} className="rounded-lg border border-slate-200 p-3 space-y-2 text-sm">
                  <div className="flex flex-wrap justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900 break-words">
                          {g.condominioNome || g.descricaoExemplo || chaveGrupo}
                        </p>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ${conf.cls}`}>
                          {conf.label}
                        </span>
                        {g.grafiasMesmaObrigacao ? (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-sky-100 text-sky-900">
                            {g.grafias?.length ?? 0} grafias
                          </span>
                        ) : null}
                        {g.historicoDespesaConfirmado ? (
                          <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-900">
                            Hist. DESPESA
                          </span>
                        ) : null}
                      </div>
                      {g.grafias?.length > 0 ? (
                        <p className="text-[11px] text-slate-500 mt-1 break-words">
                          Apelidos: {g.grafias.join(' · ')}
                        </p>
                      ) : null}
                    </div>
                    <div className="text-right tabular-nums shrink-0">
                      <p className="font-semibold">{formatBRL(g.valorEstimado ?? g.valorMedio)}</p>
                      <p className="text-xs text-slate-600">
                        estimado · dia ~{g.diaTipico || '—'} · {g.ocorrencias}× · {g.mesesCobertos?.length ?? 0} meses
                      </p>
                    </div>
                  </div>
                  {g.serieExtrato?.length > 0 ? (
                    <div className="text-[11px] text-slate-600 bg-slate-50 rounded-md p-2 overflow-x-auto">
                      <p className="font-medium text-slate-700 mb-1">Série no extrato (1 lanç./mês)</p>
                      <table className="w-full text-left">
                        <tbody>
                          {(g.serieExtrato ?? []).slice(-8).map((s) => (
                            <tr key={`${s.mes}-${s.grafia}`}>
                              <td className="pr-2 tabular-nums">{s.mes}</td>
                              <td className="pr-2 tabular-nums">{formatBRL(s.valor)}</td>
                              <td className="truncate max-w-[12rem] font-mono text-[10px]">{s.grafia}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                  {g.imovelSugeridoRotulo ? (
                    <p className="text-xs text-cyan-900">
                      <span className="font-medium">Imóvel sugerido:</span> {g.imovelSugeridoRotulo}
                    </p>
                  ) : g.unidadesCandidatas?.length > 0 ? (
                    <div className="text-xs text-cyan-900">
                      <p className="font-medium mb-1">Prédio identificado — escolher unidade:</p>
                      <ul className="flex flex-wrap gap-1.5">
                        {g.unidadesCandidatas.map((u) => {
                          const sel = unidadeCondominio[chaveGrupo] === u.imovelId;
                          return (
                          <li key={u.imovelId}>
                            <button
                              type="button"
                              onClick={() =>
                                setUnidadeCondominio((prev) => ({ ...prev, [chaveGrupo]: u.imovelId }))
                              }
                              className={`rounded-md border px-2 py-1 text-[11px] ${
                                sel
                                  ? 'bg-cyan-600 text-white border-cyan-700'
                                  : 'bg-white border-cyan-200 hover:bg-cyan-50'
                              }`}
                            >
                              {u.numeroPlanilha != null ? `#${u.numeroPlanilha}` : u.imovelId}
                              {u.unidade ? ` · ${u.unidade}` : ''}
                            </button>
                          </li>
                          );
                        })}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 italic">Imóvel desconhecido — revisão manual.</p>
                  )}
                  {(ehAlta || ehMedia) ? (
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        disabled={confirmando || (ehMedia && !imovelConfirmar)}
                        onClick={() => void confirmarCondominioEscritorio(g, imovelConfirmar)}
                        className="rounded-lg bg-cyan-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-cyan-800 disabled:opacity-50"
                      >
                        {confirmando ? 'Confirmando…' : 'Confirmar — escritório paga'}
                      </button>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </BlocoGrupo>
      ) : null}

      {pagoModal ? (
        <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
            <h3 className="text-sm font-bold mb-3">Confirmar pagamento</h3>
            <label className="flex flex-col gap-1 text-xs mb-2">
              <span>Data do pagamento efetivo</span>
              <input
                type="date"
                className="rounded border border-slate-300 px-2 py-1"
                value={pagoData}
                onChange={(e) => setPagoData(e.target.value)}
              />
            </label>
            <label className="inline-flex items-center gap-2 text-xs mb-4">
              <input type="checkbox" checked={pagoSemComp} onChange={(e) => setPagoSemComp(e.target.checked)} />
              Pago sem comprovante (mantém alerta até anexar)
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-1 text-sm"
                onClick={() => setPagoModal(null)}
                disabled={marcandoPago}
              >
                Voltar
              </button>
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
                onClick={() => void confirmarMarcarPago()}
                disabled={marcandoPago}
              >
                {marcandoPago ? 'Confirmando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!carregando && dados ? (
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <CircleDollarSign className="w-3.5 h-3.5" />
          Valores derivados dos livros A Receber, A Repassar e Pagamentos — nada é gravado nesta tela, exceto ao confirmar um crédito ou marcar pago.
        </p>
      ) : null}
    </div>
  );
}

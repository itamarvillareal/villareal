import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { featureFlags } from '../../config/featureFlags.js';
import {
  AlertTriangle,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  MessageCircle,
  MoreVertical,
  RefreshCw,
  Scale,
  Send,
} from 'lucide-react';
import { buildRouterStateChaveClienteProcesso } from '../../domain/camposProcessoCliente.js';
import { montarDadosParaDocumentoFromProcesso } from '../../helpers/documentoHelper.js';
import { formatBRL, parseBRL, agregarLinhasRelatorioCalculosConsolidado } from '../../data/relatorioCalculosData.js';
import { construirRelatorioCalculoPdf, nomeArquivoRelatorioCalculoPdf } from '../../data/relatorioCalculoPdf.js';
import { resolverTextosPartesCabecalhoCalculo } from '../../data/processosDadosRelatorio.js';
import {
  fetchParcelamentosConsolidado,
  proporAcordoDescumprido,
  registrarAndamentoAcordo,
} from '../../repositories/calculosAcordosRepository.js';
import {
  carregarCalculoSalvo,
  gerarPeticaoExecucaoDeCalculoSalvo,
} from '../../services/peticaoExecucaoDeRodada.js';

const SITUACOES = [
  { id: 'vencidas', label: 'Vencidas' },
  { id: 'em_aberto', label: 'Em aberto' },
  { id: 'a_vencer', label: 'A vencer' },
  { id: 'pagas', label: 'Pagas' },
  { id: 'todas', label: 'Todas' },
];

function formatCentavos(cent) {
  return formatBRL((Number(cent) || 0) / 100);
}

function formatDataIso(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
}

function badgeSituacao(situacao) {
  const s = String(situacao ?? '').toUpperCase();
  if (s === 'PAGA') return 'bg-emerald-100 text-emerald-800';
  if (s === 'VENCIDA') return 'bg-red-100 text-red-800';
  if (s === 'A_VENCER') return 'bg-sky-100 text-sky-800';
  return 'bg-amber-100 text-amber-900';
}

function labelSituacao(situacao) {
  const s = String(situacao ?? '').toUpperCase();
  if (s === 'PAGA') return 'Paga';
  if (s === 'VENCIDA') return 'Vencida';
  if (s === 'A_VENCER') return 'A vencer';
  return 'Em aberto';
}

function linhaParaAgregacao(item) {
  return {
    rodadaKey: item.chaveRodada,
    codCliente: item.codigoCliente,
    proc: String(item.numeroProcesso),
    dimensao: String(item.dimensao),
    reu: item.parteOposta,
    unidade: item.unidade,
    valor: formatCentavos(item.valorCentavos),
    valorHonorarios: formatCentavos(item.honorariosCentavos),
    dataVencimento: formatDataIso(item.dataVencimento),
    dataPagamento: formatDataIso(item.dataPagamento),
    situacao: labelSituacao(item.situacao),
    parcela: String(item.parcelaNumero),
    indiceParcela: item.parcelaNumero - 1,
    navigateCodCliente: item.codigoCliente,
    navigateProc: String(item.numeroProcesso),
    navigateDimensao: String(item.dimensao),
  };
}

/**
 * @param {{
 *   onAbrirRodada: (p: { codigoCliente: string, numeroProcesso: number, dimensao: number, aba?: string }) => void,
 *   codigoClienteFiltro?: string,
 * }} props
 */
export function CalculosAcordosPanel({ onAbrirRodada, codigoClienteFiltro = '' }) {
  const navigate = useNavigate();
  const [situacao, setSituacao] = useState('vencidas');
  const [modoExibicao, setModoExibicao] = useState('detalhado');
  const [page, setPage] = useState(0);
  const [size] = useState(50);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [dados, setDados] = useState(null);
  const [menuAberto, setMenuAberto] = useState(null);
  const [processando, setProcessando] = useState(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro('');
    try {
      const params = {
        situacao,
        page,
        size,
        ordenarPor: situacao === 'vencidas' ? 'diasAtraso' : 'vencimento',
        ordemAsc: situacao !== 'vencidas',
      };
      if (codigoClienteFiltro) {
        params.clienteCodigo = codigoClienteFiltro;
      }
      const resp = await fetchParcelamentosConsolidado(params);
      setDados(resp);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar acordos.');
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, [situacao, page, size, codigoClienteFiltro]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const itensDetalhados = dados?.itens ?? [];
  const itensExibicao = useMemo(() => {
    if (modoExibicao !== 'por_acordo') {
      return itensDetalhados;
    }
    const linhas = itensDetalhados.map(linhaParaAgregacao);
    const agregadas = agregarLinhasRelatorioCalculosConsolidado(linhas);
    return agregadas.map((row) => {
      const orig = itensDetalhados.find((i) => i.chaveRodada === row.rodadaKey) ?? {};
      return {
        ...orig,
        chaveRodada: row.rodadaKey,
        parteOposta: row.reu,
        unidade: row.unidade,
        parcelaNumero: 0,
        totalParcelas: 0,
        dataVencimento: null,
        dataPagamento: null,
        valorCentavos: Math.round(parseBRL(row.valor) * 100),
        honorariosCentavos: Math.round(parseBRL(row.valorHonorarios) * 100),
        situacao: 'CONSOLIDADO',
        diasAtraso: 0,
        linhaConsolidada: true,
      };
    });
  }, [itensDetalhados, modoExibicao]);

  const resumo = dados?.resumo;

  const abrirRodada = useCallback(
    (item, aba = 'Parcelamento') => {
      onAbrirRodada?.({
        codigoCliente: item.codigoCliente,
        numeroProcesso: item.numeroProcesso,
        dimensao: item.dimensao,
        aba,
      });
    },
    [onAbrirRodada]
  );

  const irFinanceiro = useCallback((item) => {
    const valor = (Number(item.valorCentavos) + Number(item.honorariosCentavos)) / 100;
    const params = new URLSearchParams({
      codCliente: String(item.codigoCliente).replace(/^0+/, '') || item.codigoCliente,
      proc: String(item.numeroProcesso),
    });
    if (item.dataVencimento) {
      params.set('data', String(item.dataVencimento).slice(0, 10));
    }
    if (valor > 0) {
      params.set('valor', String(valor));
    }
    navigate(`/financeiro/extrato?${params.toString()}`);
    if (item.processoId) {
      void registrarAndamentoAcordo({
        processoId: item.processoId,
        origem: 'ACORDO_VINCULO_EXTRATO',
        titulo: `Vínculo extrato — parcela ${item.parcelaNumero}`,
        detalhe: `Abertura do financeiro para vincular parcela ${item.parcelaNumero} (proc. ${item.numeroProcesso}, dim. ${item.dimensao}).`,
      }).catch(() => {});
    }
  }, [navigate]);

  const irWhatsApp = useCallback(
    (item) => {
      if (item.processoId) {
        navigate(`/whatsapp/cobrancas?processoId=${item.processoId}&dimensao=${item.dimensao}`);
        void registrarAndamentoAcordo({
          processoId: item.processoId,
          origem: 'ACORDO_COBRANCA_WHATSAPP',
          titulo: `Cobrança WhatsApp — parcela ${item.parcelaNumero}`,
          detalhe: `Cobrança iniciada para parcela vencida em ${formatDataIso(item.dataVencimento)}.`,
        }).catch(() => {});
      } else {
        navigate('/whatsapp/cobrancas');
      }
    },
    [navigate]
  );

  const gerarPdfCalculo = useCallback(async (item) => {
    setProcessando(`pdf-${item.chaveRodada}`);
    try {
      const dados = await carregarCalculoSalvo({
        codigoCliente: item.codigoCliente,
        numeroInterno: item.numeroProcesso,
        dimensao: item.dimensao,
      });
      if (!dados?.titulos?.length) {
        throw new Error('Cálculo sem títulos para gerar PDF.');
      }
      let cabPdf = dados.cabecalho || {};
      if (!String(cabPdf.unidade ?? '').trim()) {
        try {
          const partes = await resolverTextosPartesCabecalhoCalculo(item.codigoCliente, item.numeroProcesso);
          if (String(partes.unidade ?? '').trim()) {
            cabPdf = { ...cabPdf, unidade: partes.unidade };
          }
        } catch {
          /* mantém cabecalho */
        }
      }
      const doc = construirRelatorioCalculoPdf({
        titulos: dados.titulos,
        resumo: dados.resumo,
        cabecalho: cabPdf,
        codigoCliente: item.codigoCliente,
        proc: item.numeroProcesso,
        dataCalculo: dados.dataCalculo,
        juros: dados.config?.juros,
        multa: dados.config?.multa,
        honorariosTipo: dados.config?.honorariosTipo,
        honorariosValor: dados.config?.honorariosValor,
        indice: dados.config?.indice,
      });
      doc.save(nomeArquivoRelatorioCalculoPdf(item.codigoCliente));
      if (item.processoId) {
        await registrarAndamentoAcordo({
          processoId: item.processoId,
          origem: 'ACORDO_DOCUMENTO_GERADO',
          titulo: 'Memória de cálculo gerada',
          detalhe: `PDF do acordo proc. ${item.numeroProcesso}, dim. ${item.dimensao}.`,
        });
      }
    } catch (e) {
      window.alert(e?.message || 'Falha ao gerar PDF.');
    } finally {
      setProcessando(null);
      setMenuAberto(null);
    }
  }, []);

  const gerarPeticao = useCallback(async (item) => {
    setProcessando(`pet-${item.chaveRodada}`);
    try {
      await gerarPeticaoExecucaoDeCalculoSalvo({
        codigoCliente: item.codigoCliente,
        numeroInterno: item.numeroProcesso,
        dimensao: item.dimensao,
        enderecamento: 'Excelentíssimo Senhor Doutor Juiz de Direito',
        modo: 'Completo',
        dataIso: new Date().toISOString().slice(0, 10),
      });
      if (item.processoId) {
        await registrarAndamentoAcordo({
          processoId: item.processoId,
          origem: 'ACORDO_DOCUMENTO_GERADO',
          titulo: 'Petição de execução gerada',
          detalhe: `Petição a partir do cálculo proc. ${item.numeroProcesso}, dim. ${item.dimensao}.`,
        });
      }
    } catch (e) {
      window.alert(e?.message || 'Falha ao gerar petição.');
    } finally {
      setProcessando(null);
      setMenuAberto(null);
    }
  }, []);

  const irProtocolo = useCallback(
    async (item) => {
      if (!item.processoId) {
        window.alert('Processo não identificado para envio ao protocolo.');
        return;
      }
      setProcessando(`prot-${item.chaveRodada}`);
      try {
        const dadosProcesso = await montarDadosParaDocumentoFromProcesso({
          processoApiId: item.processoId,
          codigoCliente: item.codigoCliente,
          processo: item.numeroProcesso,
          numeroInterno: item.numeroProcesso,
          parteOposta: item.parteOposta,
        });
        navigate('/documentos/gerar', {
          state: {
            dadosProcesso,
            modoInicial: 'arquivo',
          },
        });
        await registrarAndamentoAcordo({
          processoId: item.processoId,
          origem: 'ACORDO_DOCUMENTO_GERADO',
          titulo: 'Petição — execução por descumprimento de acordo',
          detalhe: `Abertura do envio para protocolo (proc. ${item.numeroProcesso}, dim. ${item.dimensao}, parc. ${item.parcelaNumero}).`,
        });
      } catch (e) {
        window.alert(e?.message || 'Falha ao abrir protocolo.');
      } finally {
        setProcessando(null);
        setMenuAberto(null);
      }
    },
    [navigate]
  );

  const declararDescumprido = useCallback(
    async (item) => {
      if (item.dimensaoDescumpridoJaExiste) {
        const ok = window.confirm(
          'Já existe proposta de descumprimento neste processo. Deseja abrir a dimensão existente para revisão?'
        );
        if (ok) {
          abrirRodada({ ...item, dimensao: item.proximaDimensaoLivre }, 'Títulos');
        }
        return;
      }
      const ok = window.confirm(
        `Declarar acordo descumprido?\n\nSerá criada uma proposta na dimensão ${item.proximaDimensaoLivre} com as parcelas em aberto. Você poderá revisar antes de salvar.`
      );
      if (!ok) return;
      setProcessando(`desc-${item.chaveRodada}`);
      try {
        const resp = await proporAcordoDescumprido({
          codigoCliente: item.codigoCliente,
          numeroProcesso: item.numeroProcesso,
          dimensaoAcordo: item.dimensao,
          registrarHistorico: true,
        });
        abrirRodada(
          {
            ...item,
            dimensao: resp.dimensaoNova ?? item.proximaDimensaoLivre,
          },
          'Títulos'
        );
        void carregar();
      } catch (e) {
        window.alert(e?.message || 'Falha ao propor descumprimento.');
      } finally {
        setProcessando(null);
        setMenuAberto(null);
      }
    },
    [abrirRodada, carregar]
  );

  const totalPaginas = Math.max(1, Math.ceil((dados?.total ?? 0) / size));

  if (!featureFlags.useApiCalculos) {
    return (
      <div className="flex flex-1 items-center justify-center p-6 text-sm text-slate-600">
        Ative a API de cálculos (VITE_USE_API_CALCULOS) para usar a visão consolidada de acordos.
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white">
      <div className="shrink-0 border-b border-slate-200 bg-slate-50/80 px-3 py-2 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Acordos — visão consolidada</h2>
            <p className="text-xs text-slate-500">
              Parcelamentos aceitos em todo o escritório. Duplo clique abre a rodada.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void carregar()}
            disabled={carregando}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {carregando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Atualizar
          </button>
        </div>

        {resumo ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <KpiCard label="Vencidas" valor={resumo.vencidas} destaque="red" />
            <KpiCard label="Valor vencido" valor={formatCentavos(resumo.valorVencidoCentavos)} />
            <KpiCard label="Sem extrato" valor={resumo.semExtrato} destaque="amber" />
            <KpiCard label="Em aberto (R$)" valor={formatCentavos(resumo.valorEmAbertoCentavos)} />
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2 items-center text-xs">
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">Situação</span>
            <select
              value={situacao}
              onChange={(e) => {
                setSituacao(e.target.value);
                setPage(0);
              }}
              className="rounded border border-slate-300 px-2 py-1 bg-white"
            >
              {SITUACOES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1.5">
            <span className="text-slate-500">Exibição</span>
            <select
              value={modoExibicao}
              onChange={(e) => setModoExibicao(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 bg-white"
            >
              <option value="detalhado">Detalhado (parcela)</option>
              <option value="por_acordo">Por acordo</option>
            </select>
          </label>
          <span className="text-slate-400 ml-auto tabular-nums">
            {dados?.total ?? 0} linha(s)
          </span>
        </div>
      </div>

      {erro ? (
        <div className="mx-3 mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{erro}</div>
      ) : null}

      <div className="flex-1 min-h-0 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-slate-100 z-10">
            <tr className="text-left text-slate-600 border-b border-slate-200">
              <th className="px-2 py-1.5 font-medium">Cliente</th>
              <th className="px-2 py-1.5 font-medium">Proc / Dim</th>
              <th className="px-2 py-1.5 font-medium">Réu / Unidade</th>
              <th className="px-2 py-1.5 font-medium text-center">Parc.</th>
              <th className="px-2 py-1.5 font-medium">Vencimento</th>
              <th className="px-2 py-1.5 font-medium text-right">Valor</th>
              <th className="px-2 py-1.5 font-medium text-center">Situação</th>
              <th className="px-2 py-1.5 font-medium text-center">Extrato</th>
              <th className="px-2 py-1.5 w-10" />
            </tr>
          </thead>
          <tbody>
            {carregando && itensExibicao.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                  <Loader2 className="inline h-5 w-5 animate-spin mr-2" />
                  Carregando acordos…
                </td>
              </tr>
            ) : null}
            {!carregando && itensExibicao.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-slate-500">
                  Nenhum acordo encontrado para os filtros selecionados.
                </td>
              </tr>
            ) : null}
            {itensExibicao.map((item) => {
              const key = item.linhaConsolidada
                ? `agg-${item.chaveRodada}`
                : `${item.chaveRodada}:${item.parcelaNumero}`;
              const menuId = key;
              return (
                <tr
                  key={key}
                  className="border-b border-slate-100 hover:bg-indigo-50/40 cursor-pointer even:bg-slate-50/50"
                  onDoubleClick={() => abrirRodada(item)}
                >
                  <td className="px-2 py-1.5 tabular-nums">{Number(item.codigoCliente)}</td>
                  <td className="px-2 py-1.5 tabular-nums">
                    {item.numeroProcesso} / {item.dimensao}
                  </td>
                  <td className="px-2 py-1.5 max-w-[180px] truncate" title={item.parteOposta}>
                    <div className="truncate">{item.parteOposta || '—'}</div>
                    <div className="text-[10px] text-slate-400 truncate">{item.unidade || ''}</div>
                  </td>
                  <td className="px-2 py-1.5 text-center tabular-nums">
                    {item.linhaConsolidada
                      ? '—'
                      : `${item.parcelaNumero}${item.totalParcelas ? `/${item.totalParcelas}` : ''}`}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {item.linhaConsolidada ? '—' : formatDataIso(item.dataVencimento)}
                    {!item.linhaConsolidada && item.diasAtraso > 0 ? (
                      <span className="block text-[10px] text-red-600">{item.diasAtraso}d atraso</span>
                    ) : null}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">
                    {formatCentavos(item.valorCentavos + item.honorariosCentavos)}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${badgeSituacao(item.situacao)}`}>
                      {item.linhaConsolidada ? 'Acordo' : labelSituacao(item.situacao)}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    {item.extratoVinculado ? (
                      <span className="text-emerald-600" title="Vinculado no extrato">
                        <Link2 className="inline h-3.5 w-3.5" />
                      </span>
                    ) : item.situacao === 'PAGA' ? (
                      <span className="text-slate-300">—</span>
                    ) : (
                      <span className="text-amber-600" title="Sem vínculo">
                        <AlertTriangle className="inline h-3.5 w-3.5" />
                      </span>
                    )}
                  </td>
                  <td className="px-1 py-1 relative">
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-slate-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuAberto(menuAberto === menuId ? null : menuId);
                      }}
                    >
                      <MoreVertical className="h-4 w-4 text-slate-500" />
                    </button>
                    {menuAberto === menuId ? (
                      <div className="absolute right-0 top-full z-20 mt-0.5 w-48 rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-left">
                        <MenuItem icon={ExternalLink} label="Abrir parcelamento" onClick={() => { setMenuAberto(null); abrirRodada(item); }} />
                        {!item.extratoVinculado && item.situacao !== 'PAGA' ? (
                          <MenuItem icon={Link2} label="Vincular no financeiro" onClick={() => { setMenuAberto(null); irFinanceiro(item); }} />
                        ) : null}
                        {item.situacao === 'VENCIDA' ? (
                          <>
                            <MenuItem icon={MessageCircle} label="Cobrar (WhatsApp)" onClick={() => { setMenuAberto(null); irWhatsApp(item); }} />
                            <MenuItem
                              icon={Scale}
                              label="Declarar descumprido"
                              onClick={() => void declararDescumprido(item)}
                              disabled={!!processando}
                            />
                          </>
                        ) : null}
                        <MenuItem
                          icon={FileText}
                          label="PDF memória cálculo"
                          onClick={() => void gerarPdfCalculo(item)}
                          disabled={!!processando}
                        />
                        <MenuItem
                          icon={FileText}
                          label="Petição execução"
                          onClick={() => void gerarPeticao(item)}
                          disabled={!!processando}
                        />
                        {item.processoId ? (
                          <MenuItem
                            icon={Send}
                            label="Enviar para protocolo"
                            onClick={() => void irProtocolo(item)}
                            disabled={!!processando}
                          />
                        ) : null}
                        {item.processoId ? (
                          <MenuItem
                            icon={ExternalLink}
                            label="Abrir processo"
                            onClick={() => {
                              setMenuAberto(null);
                              navigate('/processos', {
                                state: buildRouterStateChaveClienteProcesso(item.codigoCliente, item.numeroProcesso),
                              });
                            }}
                          />
                        ) : null}
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPaginas > 1 ? (
        <div className="shrink-0 flex items-center justify-center gap-2 border-t border-slate-200 px-3 py-2 text-xs">
          <button
            type="button"
            disabled={page <= 0 || carregando}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className="rounded border px-2 py-1 disabled:opacity-40"
          >
            Anterior
          </button>
          <span className="tabular-nums text-slate-600">
            Página {page + 1} / {totalPaginas}
          </span>
          <button
            type="button"
            disabled={page >= totalPaginas - 1 || carregando}
            onClick={() => setPage((p) => p + 1)}
            className="rounded border px-2 py-1 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      ) : null}
    </div>
  );
}

function KpiCard({ label, valor, destaque }) {
  const cls =
    destaque === 'red'
      ? 'border-red-200 bg-red-50 text-red-900'
      : destaque === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-slate-200 bg-white text-slate-800';
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${cls}`}>
      <div className="text-[10px] uppercase tracking-wide opacity-70">{label}</div>
      <div className="font-semibold tabular-nums">{valor}</div>
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-40 text-left"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
      {label}
    </button>
  );
}

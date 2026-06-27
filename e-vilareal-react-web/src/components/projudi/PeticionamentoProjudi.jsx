import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileSignature,
  History,
  Loader2,
  RefreshCw,
  Send,
  Trash2,
  X,
} from 'lucide-react';
import {
  acompanharProtocolo,
  agendarProtocolo,
  baixarZip,
  cancelarAgendamentoProtocolo,
  datetimeLocalParaIso,
  isoParaDatetimeLocal,
  minDatetimeLocalAgendamento,
  validarAntecedenciaAgendamento,
  enviarAssinados,
  excluirPeticao,
  listar,
  listarHistorico,
  listarCredenciais,
  podeCancelarAgendamentoProtocolo,
  previaProtocoloLote,
  protocolarLote,
  reabrirProtocolo,
  registrarAssinados,
} from '../../api/peticoesProjudiApi.js';
import { isArquivoP7s, separarArquivosP7s } from '../../domain/peticaoArquivo.js';
import { downloadPdfBlob } from '../../repositories/documentosRepository.js';
import {
  buscarProcessoPorChaveNatural,
  buscarProcessoPorId,
  listarProcessosPorNumeroProcessoDiagnostico,
} from '../../repositories/processosRepository.js';
import { labelTipoArquivoPeticao } from './PeticaoArquivosTabela.jsx';
import { PeticaoHistoricoLista } from './PeticaoHistoricoLista.jsx';
import { PeticaoProtocoloConfirmModal } from './PeticaoProtocoloConfirmModal.jsx';
import { ProcessosToast, processosBtnPrimary } from '../processos/ProcessosAdminLayout.jsx';

const inputClass =
  'w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white text-slate-900';

const HISTORICO_PAGE_SIZE = 30;
const HISTORICO_DIAS_PADRAO = 7;

const TIPOS_ARQUIVO = [
  { id: 16, label: 'Petição' },
  { id: 1, label: 'Outros' },
];

function resolverNumeroProcessoOrigem(state) {
  if (!state || typeof state !== 'object') return '';
  return String(state.numeroProcesso ?? state.numeroProcessoNovo ?? state.numeroCnj ?? '').trim();
}

function formatCpfExibicao(cpf) {
  const d = String(cpf ?? '').replace(/\D/g, '');
  if (d.length !== 11) return cpf || '—';
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function labelCredencial(c) {
  if (!c) return '';
  const rotulo = c.rotulo ? ` · ${c.rotulo}` : '';
  return `#${c.id} · ${formatCpfExibicao(c.cpfUsuario)}${rotulo}`;
}

function inferirTipoArquivo(nome) {
  const n = String(nome || '').toLowerCase();
  if (n.includes('calculo') || n.includes('cálculo')) return 1;
  return 16;
}

function linhaP7sComArquivo(file) {
  return { key: crypto.randomUUID(), file, idArquivoTipo: inferirTipoArquivo(file?.name) };
}

function rotuloParteOposta(papelCliente) {
  const p = String(papelCliente || '').toUpperCase();
  if (p === 'REQUERIDO') return 'Autora';
  if (p === 'REQUERENTE') return 'Ré';
  return 'Parte oposta';
}

const PROTOCOLO_STATUS_INFO = {
  AGUARDANDO: {
    rotulo: 'Na fila',
    classe: 'text-slate-500 bg-slate-50 border-slate-200',
    Icone: Clock,
    spin: false,
  },
  PROTOCOLANDO: {
    rotulo: 'Protocolando…',
    classe: 'text-amber-700 bg-amber-50 border-amber-200',
    Icone: Loader2,
    spin: true,
  },
  PROTOCOLADA: {
    rotulo: 'Protocolada',
    classe: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    Icone: CheckCircle2,
    spin: false,
  },
  ERRO: {
    rotulo: 'Erro — voltou à fila',
    classe: 'text-rose-700 bg-rose-50 border-rose-200',
    Icone: AlertTriangle,
    spin: false,
  },
};

function formatarDuracao(ms) {
  if (ms == null || ms < 0) return '0s';
  const segTotal = Math.floor(ms / 1000);
  const min = Math.floor(segTotal / 60);
  const seg = segTotal % 60;
  return min > 0 ? `${min}m ${String(seg).padStart(2, '0')}s` : `${seg}s`;
}

function ProtocoloProgressoPainel({ progresso, peticoes, onFechar }) {
  const { itens, statusPorId, finalizado } = progresso;
  const total = itens.length;
  const statusDe = (id) => statusPorId[id] || 'AGUARDANDO';
  const ok = itens.filter((i) => statusDe(i.peticaoId) === 'PROTOCOLADA').length;
  const erro = itens.filter((i) => statusDe(i.peticaoId) === 'ERRO').length;
  const concluidas = ok + erro;
  const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;

  const mensagemPorId = useMemo(() => {
    const m = {};
    for (const p of peticoes || []) {
      if (p?.id != null && p.protocoloMensagem) m[p.id] = p.protocoloMensagem;
    }
    return m;
  }, [peticoes]);

  const etapaPorId = useMemo(() => {
    const m = {};
    for (const p of peticoes || []) {
      if (p?.id != null && p.protocoloEtapa) m[p.id] = p.protocoloEtapa;
    }
    return m;
  }, [peticoes]);

  const itensComErro = itens.filter((i) => statusDe(i.peticaoId) === 'ERRO');

  // Relógio que tica a cada segundo enquanto o protocolo está em andamento.
  const [agora, setAgora] = useState(() => Date.now());
  useEffect(() => {
    if (finalizado) return undefined;
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [finalizado]);

  // Início de cada etapa (por petição) e do protocolo inteiro, para cronometrar.
  const inicioEtapaRef = useRef({});
  const inicioTotalRef = useRef(Date.now());
  const fimTotalRef = useRef(null);

  useEffect(() => {
    const mapa = inicioEtapaRef.current;
    for (const item of itens) {
      const id = item.peticaoId;
      const st = statusPorId[id] || 'AGUARDANDO';
      const chave = `${st}::${etapaPorId[id] || ''}`;
      if (!mapa[id] || mapa[id].chave !== chave) {
        mapa[id] = { chave, inicio: Date.now() };
      }
    }
  }, [itens, statusPorId, etapaPorId]);

  useEffect(() => {
    if (finalizado && fimTotalRef.current == null) {
      fimTotalRef.current = Date.now();
    }
  }, [finalizado]);

  const fimRef = finalizado ? fimTotalRef.current ?? agora : agora;
  const totalDecorrido = fimRef - inicioTotalRef.current;
  const decorridoEtapa = (id) => {
    const reg = inicioEtapaRef.current[id];
    if (!reg) return 0;
    return fimRef - reg.inicio;
  };

  const etapaAtiva = (() => {
    const emAndamento = itens.find((i) => statusDe(i.peticaoId) === 'PROTOCOLANDO' && etapaPorId[i.peticaoId]);
    return emAndamento ? etapaPorId[emAndamento.peticaoId] : null;
  })();

  const copiarErros = () => {
    const texto = itensComErro
      .map(
        (i) =>
          `#${i.peticaoId} · ${i.numeroProcesso}\n${mensagemPorId[i.peticaoId] || '(sem detalhe — ver logs do servidor)'}`,
      )
      .join('\n\n----------------------------------------\n\n');
    try {
      void navigator.clipboard.writeText(texto);
    } catch {
      // sem clipboard: o utilizador pode selecionar o texto manualmente.
    }
  };

  return (
    <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {finalizado ? (
            erro > 0 ? (
              <AlertTriangle className="w-4 h-4 text-amber-600" aria-hidden />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" aria-hidden />
            )
          ) : (
            <Loader2 className="w-4 h-4 animate-spin text-sky-700" aria-hidden />
          )}
          <div className="flex flex-col">
            <span>
              {finalizado
                ? `Protocolo finalizado — ${ok} de ${total} concluída(s)${erro > 0 ? `, ${erro} com erro` : ''}`
                : `Protocolando… ${concluidas} de ${total}`}
              <span className="ml-2 font-mono text-xs font-normal text-slate-500">
                {formatarDuracao(totalDecorrido)}
              </span>
            </span>
            {!finalizado && etapaAtiva ? (
              <span className="text-xs font-normal text-sky-700">{etapaAtiva}</span>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {itensComErro.length > 0 ? (
            <button
              type="button"
              className="shrink-0 rounded border border-rose-300 bg-white px-2 py-0.5 text-xs font-medium text-rose-700 hover:bg-rose-50"
              onClick={copiarErros}
              title="Copiar os erros para a área de transferência"
            >
              Copiar erros
            </button>
          ) : null}
          {finalizado ? (
            <button
              type="button"
              className="shrink-0 p-1 text-slate-500 hover:text-slate-700"
              onClick={onFechar}
              title="Fechar"
              aria-label="Fechar painel de protocolo"
            >
              <X className="w-4 h-4" aria-hidden />
            </button>
          ) : null}
        </div>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full transition-all duration-500 ${erro > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="space-y-1">
        {itens.map((item) => {
          const st = statusDe(item.peticaoId);
          const info = PROTOCOLO_STATUS_INFO[st] || PROTOCOLO_STATUS_INFO.AGUARDANDO;
          const { Icone } = info;
          const mensagem = st === 'ERRO' ? mensagemPorId[item.peticaoId] : null;
          const etapa = st === 'PROTOCOLANDO' ? etapaPorId[item.peticaoId] : null;
          return (
            <li
              key={item.peticaoId}
              className="rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
            >
              <div className="flex items-center gap-2">
                <Icone
                  className={`w-4 h-4 shrink-0 ${info.spin ? 'animate-spin' : ''}`}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">
                    #{item.peticaoId} · <span className="font-mono text-xs">{item.numeroProcesso}</span>
                  </div>
                  {item.parteOposta || item.parteCliente ? (
                    <div className="text-xs text-slate-500 truncate">
                      <span className="font-medium text-slate-600">
                        {rotuloParteOposta(item.papelCliente)}:
                      </span>{' '}
                      {item.parteOposta || '—'}
                      <span className="mx-1 text-slate-400">×</span>
                      <span className="font-medium text-emerald-700">Cliente:</span>{' '}
                      {item.parteCliente || '—'}
                    </div>
                  ) : null}
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-medium ${info.classe}`}
                >
                  {info.rotulo}
                </span>
              </div>
              {etapa ? (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-sky-700">
                  <Loader2 className="w-3 h-3 animate-spin" aria-hidden />
                  <span className="flex-1">{etapa}</span>
                  <span className="font-mono text-slate-500">{formatarDuracao(decorridoEtapa(item.peticaoId))}</span>
                </div>
              ) : null}
              {mensagem ? (
                <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-rose-50 border border-rose-200 p-2 text-[11px] leading-snug text-rose-800">
                  {mensagem}
                </pre>
              ) : st === 'ERRO' ? (
                <p className="mt-1.5 text-[11px] text-rose-700">
                  Sem detalhe na fila — veja os logs do servidor (docker compose logs backend).
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function classeResultadoProtocolo(resultado) {
  switch (resultado) {
    case 'PROTOCOLADA':
      return 'text-emerald-700 bg-emerald-50 border-emerald-200';
    case 'IGNORADA':
      return 'text-slate-600 bg-slate-50 border-slate-200';
    default:
      return 'text-rose-700 bg-rose-50 border-rose-200';
  }
}

export function PeticionamentoProjudi() {
  const location = useLocation();
  const numeroProcessoOrigem = useMemo(
    () => resolverNumeroProcessoOrigem(location.state),
    [location.state],
  );

  const [aba, setAba] = useState('protocolar');
  const [filaPeticoes, setFilaPeticoes] = useState([]);
  const [historicoPeticoes, setHistoricoPeticoes] = useState([]);
  const [historicoMeta, setHistoricoMeta] = useState({ page: 0, totalPages: 0, totalElements: 0 });
  const [historicoDias, setHistoricoDias] = useState(HISTORICO_DIAS_PADRAO);
  const [historicoCarregando, setHistoricoCarregando] = useState(false);
  const [historicoCarregandoMais, setHistoricoCarregandoMais] = useState(false);
  const [protocoloLiveRows, setProtocoloLiveRows] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [apiError, setApiError] = useState('');
  const [toast, setToast] = useState('');
  const [operacao, setOperacao] = useState(null);

  const [credencialId, setCredencialId] = useState('');
  const [credenciais, setCredenciais] = useState([]);
  const [numeroProcesso, setNumeroProcesso] = useState('');
  const [modoRegistro, setModoRegistro] = useState('cnj');
  const [codigoClienteReg, setCodigoClienteReg] = useState('');
  const [numeroInternoReg, setNumeroInternoReg] = useState('');
  const [complemento, setComplemento] = useState('');
  const [linhasP7s, setLinhasP7s] = useState([]);

  const [partesPorProcesso, setPartesPorProcesso] = useState({});
  const [selecionadas, setSelecionadas] = useState(() => new Set());
  const [agendamentoInputPorPeticao, setAgendamentoInputPorPeticao] = useState({});
  const [modalProtocolo, setModalProtocolo] = useState(false);
  const [previa, setPrevia] = useState(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [resultadoProtocolo, setResultadoProtocolo] = useState([]);
  const [protocoloProgresso, setProtocoloProgresso] = useState(null);

  useEffect(() => {
    if (numeroProcessoOrigem) setNumeroProcesso(numeroProcessoOrigem);
  }, [numeroProcessoOrigem]);

  const processoFiltro = useMemo(() => {
    return (numeroProcesso.trim() || numeroProcessoOrigem || '').replace(/\D/g, '');
  }, [numeroProcesso, numeroProcessoOrigem]);

  const recarregarFila = useCallback(async () => {
    const rows = await listar('ASSINADA');
    setFilaPeticoes(Array.isArray(rows) ? rows : []);
  }, []);

  const carregarHistorico = useCallback(
    async (page = 0, append = false, dias = historicoDias) => {
      if (append) setHistoricoCarregandoMais(true);
      else setHistoricoCarregando(true);
      try {
        const res = await listarHistorico({
          page,
          size: HISTORICO_PAGE_SIZE,
          dias,
          numeroProcesso: processoFiltro || undefined,
        });
        const chunk = Array.isArray(res?.content) ? res.content : [];
        setHistoricoPeticoes((prev) => (append ? [...prev, ...chunk] : chunk));
        setHistoricoMeta({
          page: Number(res?.number ?? page),
          totalPages: Number(res?.totalPages ?? 0),
          totalElements: Number(res?.totalElements ?? chunk.length),
        });
        setHistoricoDias(dias);
      } catch (e) {
        if (!append) {
          setHistoricoPeticoes([]);
          setHistoricoMeta({ page: 0, totalPages: 0, totalElements: 0 });
        }
        throw e;
      } finally {
        if (append) setHistoricoCarregandoMais(false);
        else setHistoricoCarregando(false);
      }
    },
    [processoFiltro, historicoDias],
  );

  const verHistoricoAnterior = useCallback(() => {
    void carregarHistorico(0, false, 0);
  }, [carregarHistorico]);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setApiError('');
    try {
      await Promise.all([recarregarFila(), carregarHistorico(0, false, HISTORICO_DIAS_PADRAO)]);
    } catch (e) {
      setApiError(e?.message || 'Falha ao carregar petições.');
      setFilaPeticoes([]);
    } finally {
      setCarregando(false);
    }
  }, [recarregarFila, carregarHistorico]);

  useEffect(() => {
    void recarregar();
  }, [recarregar]);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await listarCredenciais();
        const lista = Array.isArray(rows) ? rows : [];
        setCredenciais(lista);
        setCredencialId((atual) => {
          if (atual) return atual;
          const preferida = lista.find((c) => String(c.cpfUsuario || '').endsWith('5190')) || lista[0];
          return preferida ? String(preferida.id) : '';
        });
      } catch {
        setCredenciais([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(''), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const peticoesFiltradas = useMemo(() => {
    if (!processoFiltro) return filaPeticoes;
    return filaPeticoes.filter((p) => String(p.numeroProcesso || '').replace(/\D/g, '') === processoFiltro);
  }, [filaPeticoes, processoFiltro]);

  const assinadas = useMemo(
    () => peticoesFiltradas.filter((p) => p.status === 'ASSINADA'),
    [peticoesFiltradas],
  );

  const historicoTemMais =
    historicoMeta.totalPages > 0 && historicoMeta.page + 1 < historicoMeta.totalPages;

  useEffect(() => {
    const digitosUnicos = [
      ...new Set(
        assinadas
          .map((p) => String(p.numeroProcesso || '').replace(/\D/g, ''))
          .filter((d) => d.length >= 18),
      ),
    ];
    const faltantes = digitosUnicos.filter((d) => !(d in partesPorProcesso));
    if (faltantes.length === 0) return undefined;
    let cancelado = false;
    void (async () => {
      const novos = {};
      for (const d of faltantes) {
        try {
          const rows = await listarProcessosPorNumeroProcessoDiagnostico(d);
          const match =
            (Array.isArray(rows) ? rows : []).find(
              (r) => String(r.numeroProcessoNovo || '').replace(/\D/g, '') === d,
            ) || (Array.isArray(rows) ? rows[0] : null);
          const processo = match?.processoId ? await buscarProcessoPorId(match.processoId) : null;
          novos[d] = {
            papelCliente: String(processo?.papelCliente || '').toUpperCase(),
            parteCliente: String(processo?.parteCliente || match?.parteCliente || '').trim(),
            parteOposta: String(processo?.parteOposta || match?.parteOposta || '').trim(),
          };
        } catch {
          novos[d] = { papelCliente: '', parteCliente: '', parteOposta: '' };
        }
      }
      if (!cancelado) setPartesPorProcesso((prev) => ({ ...prev, ...novos }));
    })();
    return () => {
      cancelado = true;
    };
  }, [assinadas, partesPorProcesso]);

  const toggleSelecionada = (id) => {
    setSelecionadas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const todasSelecionadas = assinadas.length > 0 && assinadas.every((p) => selecionadas.has(p.id));

  const alternarSelecionarTodas = () => {
    setSelecionadas(todasSelecionadas ? new Set() : new Set(assinadas.map((p) => p.id)));
  };

  const resolverCnjPorCodigoProc = async () => {
    const cod = codigoClienteReg.trim();
    const proc = numeroInternoReg.trim();
    if (!cod || !proc) {
      throw new Error('Informe o código do cliente e o nº do processo (Proc).');
    }
    const processo = await buscarProcessoPorChaveNatural(cod, proc);
    if (!processo) {
      throw new Error(`Processo não encontrado para código ${cod} · proc ${proc}.`);
    }
    const cnj = String(processo.numeroProcessoNovo ?? '').trim();
    if (!cnj) {
      throw new Error(
        `O processo ${cod} · proc ${proc} não tem número CNJ (Nº Processo Novo) cadastrado.`,
      );
    }
    return cnj;
  };

  const registrarP7s = async (e) => {
    e.preventDefault();
    const arquivos = linhasP7s.map((l) => l.file).filter(Boolean);
    if (modoRegistro === 'cnj' && !numeroProcesso.trim()) {
      setApiError('Informe o número do processo.');
      return;
    }
    if (modoRegistro === 'codigo' && (!codigoClienteReg.trim() || !numeroInternoReg.trim())) {
      setApiError('Informe o código do cliente e o nº do processo (Proc).');
      return;
    }
    if (arquivos.length === 0) {
      setApiError('Selecione ao menos um arquivo .p7s.');
      return;
    }
    setOperacao('registrar');
    setApiError('');
    try {
      let numeroProcessoFinal = numeroProcesso.trim();
      if (modoRegistro === 'codigo') {
        numeroProcessoFinal = await resolverCnjPorCodigoProc();
        setNumeroProcesso(numeroProcessoFinal);
      }
      const fd = new FormData();
      fd.append('credencialId', String(credencialId).trim() || String(credenciais[0]?.id ?? '1'));
      fd.append('numeroProcesso', numeroProcessoFinal);
      if (complemento.trim()) fd.append('complemento', complemento.trim());
      for (const linha of linhasP7s) {
        if (linha.file) {
          fd.append('arquivosP7s', linha.file);
          fd.append('idArquivoTipos', String(linha.idArquivoTipo));
        }
      }
      await registrarAssinados(fd);
      setToast(`${arquivos.length} .p7s registrado(s).`);
      setComplemento('');
      setLinhasP7s([]);
      await recarregar();
    } catch (err) {
      setApiError(err?.message || 'Falha ao registrar.');
    } finally {
      setOperacao(null);
    }
  };

  const abrirModalProtocolo = async () => {
    const ids = [...selecionadas];
    if (!ids.length) return;
    setModalProtocolo(true);
    setPrevia(null);
    setCarregandoPrevia(true);
    setApiError('');
    try {
      setPrevia(await previaProtocoloLote(ids));
    } catch (err) {
      setApiError(err?.message || 'Falha na prévia.');
      setModalProtocolo(false);
    } finally {
      setCarregandoPrevia(false);
    }
  };

  const confirmarProtocolo = async () => {
    const ids = [...selecionadas];
    if (!ids.length) {
      setModalProtocolo(false);
      setPrevia(null);
      return;
    }
    const itensSnapshot = ids.map((id) => {
      const p = filaPeticoes.find((x) => x.id === id);
      const dig = String(p?.numeroProcesso || '').replace(/\D/g, '');
      const partes = partesPorProcesso[dig] || {};
      return {
        peticaoId: id,
        numeroProcesso: p?.numeroProcesso || '',
        parteOposta: partes.parteOposta || '',
        parteCliente: partes.parteCliente || '',
        papelCliente: partes.papelCliente || '',
      };
    });
    setOperacao('protocolo');
    setApiError('');
    setResultadoProtocolo([]);
    setProtocoloProgresso({
      itens: itensSnapshot,
      statusPorId: Object.fromEntries(ids.map((id) => [id, 'AGUARDANDO'])),
      finalizado: false,
    });
    try {
      await protocolarLote(ids);
    } catch (err) {
      setApiError(err?.message || 'Falha ao iniciar o protocolo.');
      setOperacao(null);
      setModalProtocolo(false);
      setPrevia(null);
      setProtocoloProgresso(null);
      return;
    }
    setSelecionadas(new Set());
    setModalProtocolo(false);
    setPrevia(null);
    setToast('Protocolo iniciado em segundo plano…');
    try {
      const r = await acompanharProtocolo(ids, (rows) => {
        const lista = Array.isArray(rows) ? rows : [];
        setFilaPeticoes(lista.filter((p) => p.status === 'ASSINADA'));
        setProtocoloLiveRows(lista.filter((p) => ids.includes(p.id)));
      }, {
        onProgress: (statusPorId) =>
          setProtocoloProgresso((prev) => (prev ? { ...prev, statusPorId } : prev)),
      });
      setProtocoloProgresso((prev) =>
        prev ? { ...prev, statusPorId: r.statusPorId, finalizado: true } : prev,
      );
      const ok = r.protocoladas.length;
      const erro = r.comErro.length;
      const pend = r.pendentes.length;
      if (erro === 0 && pend === 0) setToast(`Protocolo concluído (${ok}).`);
      else if (ok > 0 && erro > 0) setToast(`Protocolo: ${ok} concluída(s), ${erro} com erro.`);
      else if (erro > 0) setToast(`Protocolo: ${erro} com erro. Verifique a fila.`);
      else setToast('Protocolo ainda em andamento. Acompanhe pela fila.');
    } catch {
      // A fila reflete o estado real; ignora erro de acompanhamento.
      setProtocoloProgresso((prev) => (prev ? { ...prev, finalizado: true } : prev));
    } finally {
      await recarregar();
      setOperacao(null);
    }
  };

  function formatarAgendamentoProtocolo(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  }

  const onAgendarProtocoloPeticao = async (peticaoId) => {
    const p = filaPeticoes.find((x) => x.id === peticaoId);
    const local =
      agendamentoInputPorPeticao[peticaoId] ??
      isoParaDatetimeLocal(p?.protocoloAgendadoPara) ??
      '';
    const iso = datetimeLocalParaIso(local);
    const erroAntecedencia = validarAntecedenciaAgendamento(iso ?? local);
    if (erroAntecedencia) {
      setApiError(erroAntecedencia);
      return;
    }
    setOperacao(`agendar-${peticaoId}`);
    setApiError('');
    try {
      await agendarProtocolo(peticaoId, iso);
      setToast(`Petição #${peticaoId} agendada para ${formatarAgendamentoProtocolo(iso)}.`);
      setAgendamentoInputPorPeticao((prev) => {
        const next = { ...prev };
        delete next[peticaoId];
        return next;
      });
      await recarregar();
    } catch (err) {
      setApiError(err?.message || 'Falha ao agendar protocolo.');
    } finally {
      setOperacao(null);
    }
  };

  const onCancelarAgendamento = async (peticaoId) => {
    setOperacao(`cancelar-ag-${peticaoId}`);
    setApiError('');
    try {
      await cancelarAgendamentoProtocolo(peticaoId);
      setToast(`Agendamento da petição #${peticaoId} cancelado.`);
      await recarregar();
    } catch (err) {
      setApiError(err?.message || 'Falha ao cancelar agendamento.');
    } finally {
      setOperacao(null);
    }
  };

  const onReabrirProtocolo = async (peticaoId) => {
    setOperacao(`reabrir-${peticaoId}`);
    setApiError('');
    try {
      await reabrirProtocolo(peticaoId);
      setToast(`Petição #${peticaoId} reaberta.`);
      setAba('protocolar');
      await recarregar();
    } catch (err) {
      setApiError(err?.message || 'Falha ao reabrir.');
    } finally {
      setOperacao(null);
    }
  };

  const onExcluirPeticao = async (peticaoId) => {
    if (
      !window.confirm(
        `Excluir a petição #${peticaoId} da fila de protocolo? Os arquivos serão removidos e esta ação não pode ser desfeita.`,
      )
    ) {
      return;
    }
    setOperacao(`excluir-${peticaoId}`);
    setApiError('');
    try {
      await excluirPeticao(peticaoId);
      setSelecionadas((prev) => {
        const next = new Set(prev);
        next.delete(peticaoId);
        return next;
      });
      setToast(`Petição #${peticaoId} excluída.`);
      await recarregar();
    } catch (err) {
      setApiError(err?.message || 'Falha ao excluir petição.');
    } finally {
      setOperacao(null);
    }
  };

  const baixarLote = async () => {
    setOperacao('zip');
    try {
      const { blob, filename } = await baixarZip();
      downloadPdfBlob(blob, filename);
      setToast('ZIP baixado.');
    } catch (err) {
      setApiError(err?.message || 'Falha ao baixar ZIP.');
    } finally {
      setOperacao(null);
    }
  };

  const onEnviarAssinados = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    const { validos, invalidos } = separarArquivosP7s(files);
    if (invalidos.length) {
      setApiError('Envie apenas arquivos .p7s.');
      return;
    }
    setOperacao('assinados');
    try {
      const fd = new FormData();
      for (const f of validos) fd.append('arquivosP7s', f);
      await enviarAssinados(fd);
      setToast(`${validos.length} .p7s pareado(s).`);
      await recarregar();
    } catch (err) {
      setApiError(err?.message || 'Falha ao enviar .p7s.');
    } finally {
      setOperacao(null);
    }
  };

  const processoExibicao = numeroProcesso.trim() || numeroProcessoOrigem;

  return (
    <div className="min-h-full bg-slate-50 text-slate-900">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <header className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <FileSignature className="w-5 h-5 text-sky-700" aria-hidden />
              Peticionamento PROJUDI
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Registre arquivos <strong>.p7s</strong> assinados e protocolize no TJGO.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
            onClick={() => void recarregar()}
            disabled={carregando}
          >
            {carregando ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="w-4 h-4" aria-hidden />
            )}
            Atualizar
          </button>
        </header>

        <div className="flex gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
              aba === 'protocolar' ? 'bg-sky-700 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => setAba('protocolar')}
          >
            Protocolar
            {assinadas.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-white/20 px-1.5 text-xs">{assinadas.length}</span>
            ) : null}
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-3 py-2 text-sm font-medium inline-flex items-center justify-center gap-1 ${
              aba === 'historico' ? 'bg-slate-700 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
            onClick={() => setAba('historico')}
          >
            <History className="w-4 h-4" aria-hidden />
            Histórico
            {historicoMeta.totalElements > 0 ? (
              <span className="rounded-full bg-white/20 px-1.5 text-xs">{historicoMeta.totalElements}</span>
            ) : null}
          </button>
        </div>

        {apiError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            {apiError}
          </div>
        ) : null}

        {resultadoProtocolo.length > 0 ? (
          <div className="space-y-1">
            {resultadoProtocolo.map((item) => (
              <div
                key={item.peticaoId}
                className={`rounded border px-2 py-1.5 text-sm ${classeResultadoProtocolo(item.resultado)}`}
              >
                <strong>#{item.peticaoId}</strong> — <strong>{item.resultado}</strong>
                {item.mensagem ? `: ${item.mensagem}` : ''}
              </div>
            ))}
          </div>
        ) : null}

        {aba === 'protocolar' ? (
          <div className="space-y-5">
            {/* 1 — Registrar .p7s */}
            <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-slate-800">1. Registrar .p7s</h2>
              <p className="text-xs text-slate-500">
                Somente arquivos já assinados (<span className="font-mono">.p7s</span>). Cada arquivo vira uma
                petição na fila; no protocolo, arquivos do mesmo processo entram em uma única juntada.
              </p>
              <form onSubmit={(e) => void registrarP7s(e)} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2 inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                    <button
                      type="button"
                      className={`rounded-md px-3 py-1 font-medium ${
                        modoRegistro === 'cnj'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                      onClick={() => setModoRegistro('cnj')}
                    >
                      Por CNJ
                    </button>
                    <button
                      type="button"
                      className={`rounded-md px-3 py-1 font-medium ${
                        modoRegistro === 'codigo'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                      onClick={() => setModoRegistro('codigo')}
                    >
                      Por código + Proc
                    </button>
                  </div>
                  {modoRegistro === 'cnj' ? (
                    <label className="block sm:col-span-2">
                      <span className="text-xs text-slate-600">Processo (CNJ)</span>
                      <input
                        className={inputClass}
                        value={numeroProcesso}
                        onChange={(ev) => setNumeroProcesso(ev.target.value)}
                        placeholder="0000000-00.0000.0.00.0000"
                      />
                    </label>
                  ) : (
                    <>
                      <label className="block">
                        <span className="text-xs text-slate-600">Código do cliente</span>
                        <input
                          className={inputClass}
                          value={codigoClienteReg}
                          onChange={(ev) => setCodigoClienteReg(ev.target.value)}
                          placeholder="Ex.: 149"
                          inputMode="numeric"
                        />
                      </label>
                      <label className="block">
                        <span className="text-xs text-slate-600">Proc (nº interno)</span>
                        <input
                          className={inputClass}
                          value={numeroInternoReg}
                          onChange={(ev) => setNumeroInternoReg(ev.target.value)}
                          placeholder="Ex.: 195"
                          inputMode="numeric"
                        />
                      </label>
                      <p className="sm:col-span-2 text-xs text-slate-500">
                        O CNJ será resolvido pelo cadastro do processo (código + Proc).
                      </p>
                    </>
                  )}
                  <label className="block sm:col-span-2">
                    <span className="text-xs text-slate-600">Credencial PROJUDI</span>
                    {credenciais.length > 0 ? (
                      <select
                        className={inputClass}
                        value={credencialId}
                        onChange={(ev) => setCredencialId(ev.target.value)}
                      >
                        {credenciais.map((c) => (
                          <option key={c.id} value={String(c.id)}>
                            {labelCredencial(c)}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        className={inputClass}
                        value={credencialId}
                        onChange={(ev) => setCredencialId(ev.target.value)}
                      />
                    )}
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="text-xs text-slate-600">Complemento (opcional)</span>
                    <input
                      className={inputClass}
                      value={complemento}
                      onChange={(ev) => setComplemento(ev.target.value)}
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <input
                    id="registrar-p7s"
                    type="file"
                    accept=".p7s,.pdf.p7s,application/pkcs7-signature"
                    multiple
                    className="sr-only"
                    onChange={(ev) => {
                      const files = Array.from(ev.target.files || []);
                      ev.target.value = '';
                      const invalidos = files.filter((f) => !isArquivoP7s(f));
                      if (invalidos.length) {
                        setApiError('Selecione apenas .p7s.');
                        return;
                      }
                      setLinhasP7s((rows) => [...rows, ...files.map((f) => linhaP7sComArquivo(f))]);
                    }}
                  />
                  <label htmlFor="registrar-p7s" className={`${processosBtnPrimary} cursor-pointer text-sm`}>
                    Escolher .p7s…
                  </label>
                  {linhasP7s.length > 0 ? (
                    <span className="text-sm text-slate-600">{linhasP7s.length} arquivo(s)</span>
                  ) : null}
                </div>

                {linhasP7s.length > 0 ? (
                  <ul className="space-y-1 border border-slate-100 rounded-lg p-2 bg-slate-50/50">
                    {linhasP7s.map((linha, idx) => (
                      <li key={linha.key} className="flex flex-wrap items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden />
                        <span className="truncate flex-1 min-w-0 font-medium">{linha.file?.name}</span>
                        <select
                          className={`${inputClass} w-auto text-xs py-1`}
                          value={linha.idArquivoTipo}
                          onChange={(ev) => {
                            const v = Number(ev.target.value);
                            setLinhasP7s((rows) =>
                              rows.map((r, i) => (i === idx ? { ...r, idArquivoTipo: v } : r)),
                            );
                          }}
                        >
                          {TIPOS_ARQUIVO.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.label}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="text-slate-400 hover:text-rose-600"
                          onClick={() => setLinhasP7s((rows) => rows.filter((_, i) => i !== idx))}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}

                <button
                  type="submit"
                  className={processosBtnPrimary}
                  disabled={operacao === 'registrar' || !numeroProcesso.trim() || linhasP7s.length === 0}
                >
                  {operacao === 'registrar' ? (
                    <Loader2 className="w-4 h-4 animate-spin inline mr-1" aria-hidden />
                  ) : null}
                  Registrar na fila
                </button>
              </form>
            </section>

            {/* 2 — Fila + protocolar */}
            <section className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 shadow-sm space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-800">2. Protocolar</h2>
                {processoExibicao ? (
                  <span className="text-xs font-mono text-sky-800 bg-sky-50 px-2 py-0.5 rounded">
                    {processoExibicao}
                  </span>
                ) : (
                  <span className="text-xs text-slate-500">Todos os processos</span>
                )}
              </div>

              {protocoloProgresso ? (
                <ProtocoloProgressoPainel
                  progresso={protocoloProgresso}
                  peticoes={protocoloLiveRows}
                  onFechar={() => setProtocoloProgresso(null)}
                />
              ) : null}

              {carregando ? (
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                  Carregando…
                </div>
              ) : assinadas.length === 0 ? (
                <p className="text-sm text-slate-600">
                  Nenhuma petição assinada na fila
                  {processoFiltro ? ' para este processo' : ''}. Registre .p7s acima.
                </p>
              ) : (
                <>
                  <p className="text-xs text-slate-600">
                    Selecione as petições do <strong>mesmo processo</strong> para uma juntada. O robô envia todos os
                    arquivos e dá um único Concluir.
                  </p>
                  <p className="text-xs text-violet-800">
                    Protocolo automático: escolha data e hora em cada petição. O agendamento pode ser cancelado antes do
                    protocolo iniciar.
                  </p>
                  <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={todasSelecionadas}
                      onChange={alternarSelecionarTodas}
                      aria-label="Selecionar todas as petições"
                    />
                    {todasSelecionadas ? 'Limpar seleção' : `Selecionar todas (${assinadas.length})`}
                  </label>
                  <ul className="rounded-lg border border-slate-200 bg-white divide-y divide-slate-100">
                    {assinadas.map((p) => (
                      <li key={p.id} className="flex items-start gap-2 px-3 py-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selecionadas.has(p.id)}
                          onChange={() => toggleSelecionada(p.id)}
                          aria-label={`Selecionar petição ${p.id}`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">
                            #{p.id} · <span className="font-mono text-xs">{p.numeroProcesso}</span>
                          </div>
                          {(() => {
                            const dig = String(p.numeroProcesso || '').replace(/\D/g, '');
                            const partes = partesPorProcesso[dig];
                            if (!partes || (!partes.parteCliente && !partes.parteOposta)) return null;
                            return (
                              <div className="text-xs text-slate-500 truncate">
                                <span className="font-medium text-slate-600">
                                  {rotuloParteOposta(partes.papelCliente)}:
                                </span>{' '}
                                {partes.parteOposta || '—'}
                                <span className="mx-1 text-slate-400">×</span>
                                <span className="font-medium text-emerald-700">Cliente:</span>{' '}
                                {partes.parteCliente || '—'}
                              </div>
                            );
                          })()}
                          {(p.arquivos || []).map((a) => (
                            <div key={a.id ?? a.ordem} className="text-xs text-slate-600 truncate">
                              {a.nomeOriginal} ({labelTipoArquivoPeticao(a.idArquivoTipo)})
                            </div>
                          ))}
                          {podeCancelarAgendamentoProtocolo(p) ? (
                            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-violet-800">
                              <Clock className="w-3.5 h-3.5 shrink-0" aria-hidden />
                              <span>Agendado: {formatarAgendamentoProtocolo(p.protocoloAgendadoPara)}</span>
                              <button
                                type="button"
                                className="text-rose-700 hover:underline disabled:opacity-50"
                                disabled={operacao === `cancelar-ag-${p.id}`}
                                onClick={() => void onCancelarAgendamento(p.id)}
                              >
                                Cancelar agendamento
                              </button>
                            </div>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-end gap-2 rounded border border-violet-200 bg-violet-50/60 p-2">
                            <label className="flex flex-col gap-1 text-xs text-slate-700">
                              Data e hora
                              <input
                                type="datetime-local"
                                className="rounded border border-slate-300 px-2 py-1 text-sm bg-white"
                                min={minDatetimeLocalAgendamento()}
                                value={
                                  agendamentoInputPorPeticao[p.id] ??
                                  isoParaDatetimeLocal(p.protocoloAgendadoPara) ??
                                  ''
                                }
                                onChange={(e) =>
                                  setAgendamentoInputPorPeticao((prev) => ({
                                    ...prev,
                                    [p.id]: e.target.value,
                                  }))
                                }
                                disabled={operacao === `agendar-${p.id}`}
                              />
                            </label>
                            <button
                              type="button"
                              className={`${processosBtnPrimary} bg-violet-700 hover:bg-violet-800 text-xs py-1.5 px-2.5`}
                              disabled={
                                operacao === `agendar-${p.id}` ||
                                !(
                                  agendamentoInputPorPeticao[p.id] ??
                                  isoParaDatetimeLocal(p.protocoloAgendadoPara)
                                )
                              }
                              onClick={() => void onAgendarProtocoloPeticao(p.id)}
                            >
                              {operacao === `agendar-${p.id}` ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" aria-hidden />
                              ) : (
                                <Clock className="w-3.5 h-3.5 inline mr-1" aria-hidden />
                              )}
                              Agendar protocolo
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="shrink-0 p-1 text-rose-600 hover:text-rose-800 disabled:opacity-50"
                          disabled={operacao === `excluir-${p.id}` || operacao === 'protocolo'}
                          onClick={() => void onExcluirPeticao(p.id)}
                          title="Excluir petição da fila"
                          aria-label={`Excluir petição ${p.id}`}
                        >
                          {operacao === `excluir-${p.id}` ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                          ) : (
                            <Trash2 className="w-4 h-4" aria-hidden />
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={`${processosBtnPrimary} bg-amber-700 hover:bg-amber-800 w-full sm:w-auto`}
                    disabled={selecionadas.size === 0 || operacao === 'protocolo'}
                    onClick={() => void abrirModalProtocolo()}
                  >
                    {operacao === 'protocolo' ? (
                      <Loader2 className="w-4 h-4 animate-spin inline mr-1" aria-hidden />
                    ) : (
                      <Send className="w-4 h-4 inline mr-1" aria-hidden />
                    )}
                    Protocolar selecionadas ({selecionadas.size})
                  </button>
                </>
              )}
            </section>
          </div>
        ) : (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">
              Histórico — {historicoDias > 0 ? `últimos ${historicoDias} dias` : 'completo'}
            </h2>
            {processoExibicao ? (
              <p className="text-xs text-slate-500">
                Processo <span className="font-mono">{processoExibicao}</span>
                {processoFiltro ? '' : ' — exibindo todos'}
              </p>
            ) : null}
            {carregando || historicoCarregando ? (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                Carregando…
              </div>
            ) : (
              <PeticaoHistoricoLista
                peticoes={historicoPeticoes}
                totalElements={historicoMeta.totalElements}
                dias={historicoDias}
                hasMore={historicoTemMais}
                loadingMore={historicoCarregandoMais}
                onLoadMore={() => void carregarHistorico(historicoMeta.page + 1, true, historicoDias)}
                onVerHistoricoAnterior={historicoDias > 0 ? verHistoricoAnterior : undefined}
                onReabrir={onReabrirProtocolo}
                onCancelarAgendamento={(id) => void onCancelarAgendamento(id)}
                operacao={operacao}
              />
            )}

            <details className="rounded-lg border border-slate-200 bg-white p-3 text-sm">
              <summary className="cursor-pointer font-medium text-slate-700 flex items-center gap-1">
                <ChevronDown className="w-4 h-4" aria-hidden />
                Fluxo alternativo: assinar PDFs no sistema
              </summary>
              <p className="text-xs text-slate-500 mt-2 mb-3">
                Se ainda não tem .p7s, registre PDFs em outro fluxo, baixe o ZIP, assine externamente e devolva os
                .p7s — ou registre .p7s direto na aba Protocolar.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={`${processosBtnPrimary} text-xs`}
                  disabled={operacao === 'zip'}
                  onClick={() => void baixarLote()}
                >
                  Baixar lote PDF
                </button>
                <label className={`${processosBtnPrimary} text-xs cursor-pointer inline-flex items-center gap-1`}>
                  Devolver .p7s pareados
                  <input
                    type="file"
                    accept=".p7s,.pdf.p7s"
                    multiple
                    className="sr-only"
                    onChange={(ev) => void onEnviarAssinados(ev)}
                  />
                </label>
              </div>
            </details>
          </section>
        )}
      </div>

      <PeticaoProtocoloConfirmModal
        open={modalProtocolo}
        previa={previa}
        carregandoPrevia={carregandoPrevia}
        confirmando={operacao === 'protocolo'}
        onCancel={() => {
          if (operacao === 'protocolo') return;
          setModalProtocolo(false);
          setPrevia(null);
        }}
        onConfirmar={() => void confirmarProtocolo()}
      />

      <ProcessosToast message={toast} onClose={() => setToast('')} />
    </div>
  );
}

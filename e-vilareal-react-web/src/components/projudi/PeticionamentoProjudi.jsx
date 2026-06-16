import { useCallback, useEffect, useMemo, useState } from 'react';
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
  baixarZip,
  enviarAssinados,
  excluirPeticao,
  listar,
  listarCredenciais,
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

function ProtocoloProgressoPainel({ progresso, onFechar }) {
  const { itens, statusPorId, finalizado } = progresso;
  const total = itens.length;
  const statusDe = (id) => statusPorId[id] || 'AGUARDANDO';
  const ok = itens.filter((i) => statusDe(i.peticaoId) === 'PROTOCOLADA').length;
  const erro = itens.filter((i) => statusDe(i.peticaoId) === 'ERRO').length;
  const concluidas = ok + erro;
  const pct = total > 0 ? Math.round((concluidas / total) * 100) : 0;

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
          {finalizado
            ? `Protocolo finalizado — ${ok} de ${total} concluída(s)${erro > 0 ? `, ${erro} com erro` : ''}`
            : `Protocolando… ${concluidas} de ${total}`}
        </div>
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

      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className={`h-full transition-all duration-500 ${erro > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <ul className="space-y-1">
        {itens.map((item) => {
          const info = PROTOCOLO_STATUS_INFO[statusDe(item.peticaoId)] || PROTOCOLO_STATUS_INFO.AGUARDANDO;
          const { Icone } = info;
          return (
            <li
              key={item.peticaoId}
              className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-sm"
            >
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
  const [peticoes, setPeticoes] = useState([]);
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
  const [modalProtocolo, setModalProtocolo] = useState(false);
  const [previa, setPrevia] = useState(null);
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [resultadoProtocolo, setResultadoProtocolo] = useState([]);
  const [protocoloProgresso, setProtocoloProgresso] = useState(null);

  useEffect(() => {
    if (numeroProcessoOrigem) setNumeroProcesso(numeroProcessoOrigem);
  }, [numeroProcessoOrigem]);

  const recarregar = useCallback(async () => {
    setCarregando(true);
    setApiError('');
    try {
      const rows = await listar();
      setPeticoes(Array.isArray(rows) ? rows : []);
    } catch (e) {
      setApiError(e?.message || 'Falha ao carregar petições.');
      setPeticoes([]);
    } finally {
      setCarregando(false);
    }
  }, []);

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

  const processoFiltro = useMemo(() => {
    return (numeroProcesso.trim() || numeroProcessoOrigem || '').replace(/\D/g, '');
  }, [numeroProcesso, numeroProcessoOrigem]);

  const peticoesFiltradas = useMemo(() => {
    if (!processoFiltro) return peticoes;
    return peticoes.filter((p) => String(p.numeroProcesso || '').replace(/\D/g, '') === processoFiltro);
  }, [peticoes, processoFiltro]);

  const assinadas = useMemo(
    () => peticoesFiltradas.filter((p) => p.status === 'ASSINADA'),
    [peticoesFiltradas],
  );

  const historico = useMemo(
    () =>
      peticoesFiltradas.filter((p) =>
        ['PROTOCOLADA', 'ERRO', 'PENDENTE_ASSINATURA'].includes(p.status),
      ),
    [peticoesFiltradas],
  );

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
      const p = peticoes.find((x) => x.id === id);
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
      const r = await acompanharProtocolo(ids, (rows) => setPeticoes(rows), {
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
            {historico.length > 0 ? (
              <span className="rounded-full bg-white/20 px-1.5 text-xs">{historico.length}</span>
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
            <h2 className="text-sm font-semibold text-slate-800">Histórico</h2>
            {processoExibicao ? (
              <p className="text-xs text-slate-500">
                Processo <span className="font-mono">{processoExibicao}</span>
                {processoFiltro ? '' : ' — exibindo todos'}
              </p>
            ) : null}
            {carregando ? (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                Carregando…
              </div>
            ) : (
              <PeticaoHistoricoLista
                peticoes={historico}
                onReabrir={onReabrirProtocolo}
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

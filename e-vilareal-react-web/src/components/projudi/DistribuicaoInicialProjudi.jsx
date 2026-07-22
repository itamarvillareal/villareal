import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  Scale,
  Trash2,
  User,
  X,
  XCircle,
} from 'lucide-react';
import {
  cadastrarAssuntoProjudi,
  distribuirInicial,
  listarAssuntosProjudi,
  listarClassesProjudi,
  prepararInicial,
  removerAssuntoProjudi,
  sugerirAssuntoProjudi,
  validarProntidaoInicial,
} from '../../api/iniciaisProjudiApi.js';
import { listarCredenciais } from '../../api/peticoesProjudiApi.js';
import { AssinaturaAutomaticaInicialPanel } from './AssinaturaAutomaticaInicialPanel.jsx';
import { isArquivoP7s } from '../../domain/peticaoArquivo.js';
import { SeletorPessoaParteImovel } from '../imoveis/SeletorPessoaParteImovel.jsx';
import { buildLinkDestinoProcesso } from '../../domain/camposProcessoCliente.js';
import { ProcessosToast, processosBtnPrimary } from '../processos/ProcessosAdminLayout.jsx';

const inputClass =
  'w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white text-slate-900';

const TIPOS_ARQUIVO = [
  { id: 16, label: 'Petição' },
  { id: 1, label: 'Outros' },
];

function formatCpfExibicao(cpf) {
  const d = String(cpf ?? '').replace(/\D/g, '');
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return cpf || '—';
}

function labelCredencial(c) {
  if (!c) return '';
  const rotulo = c.rotulo ? ` · ${c.rotulo}` : '';
  return `#${c.id} · ${formatCpfExibicao(c.cpfUsuario)}${rotulo}`;
}

/** @param {import('../../api/iniciaisProjudiApi.js').ResultadoPreparacaoInicial} resultado */
function baixarLogJson(resultado) {
  const blob = new Blob([JSON.stringify(resultado, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `projudi-inicial-${resultado.passoAlcancado || 'log'}-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function montarCsvAssuntos(idsSelecionados) {
  return [...idsSelecionados].join(',');
}

const CLASSE_JEC_PADRAO = { idProcessoTipo: 162, processoTipoCodigo: 1436 };

function montarFormDataInicial({
  credencialId,
  valorCausa,
  idsAssuntosSelecionados,
  pessoaAutor,
  pessoasReu,
  linhasP7s,
  idProcessoTipo,
  processoTipoCodigo,
  processoIdOrigem,
  confirmar,
  opcoesPasso3,
  prioridadeMaior60Anos,
}) {
  const fd = new FormData();
  fd.append('credencialId', String(credencialId).trim() || '1');
  fd.append('valorCausa', valorCausa.trim());
  fd.append('idAssuntos', montarCsvAssuntos(idsAssuntosSelecionados));
  fd.append('pessoaIdAutor', String(pessoaAutor.id));
  for (const reu of pessoasReu || []) {
    if (reu?.id) {
      fd.append('pessoaIdsReu', String(reu.id));
    }
  }
  fd.append('idProcessoTipo', String(idProcessoTipo ?? CLASSE_JEC_PADRAO.idProcessoTipo));
  fd.append('processoTipoCodigo', String(processoTipoCodigo ?? CLASSE_JEC_PADRAO.processoTipoCodigo));
  for (const linha of linhasP7s) {
    if (linha.file) {
      fd.append('pdfs', linha.file);
      fd.append('idArquivoTipos', String(linha.idArquivoTipo));
    }
  }
  if (processoIdOrigem != null && Number(processoIdOrigem) > 0) {
    fd.append('processoIdOrigem', String(processoIdOrigem));
  }
  if (confirmar != null) {
    fd.append('confirmar', confirmar ? 'true' : 'false');
  }
  if (opcoesPasso3) {
    fd.append('segredoJustica', opcoesPasso3.segredoJustica ? 'true' : 'false');
    fd.append('naoMarcarAudiencia', opcoesPasso3.naoMarcarAudiencia ? 'true' : 'false');
    fd.append('juizo100Digital', opcoesPasso3.juizo100Digital ? 'true' : 'false');
  }
  if (prioridadeMaior60Anos != null) {
    fd.append('prioridadeMaior60Anos', prioridadeMaior60Anos ? 'true' : 'false');
  }
  return fd;
}

function linhaP7sComArquivo(file) {
  return { key: crypto.randomUUID(), file, idArquivoTipo: 16 };
}

function BadgeCampo({ nivel, label, motivo }) {
  const resolvido = nivel === 'RESOLVIDO';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
        resolvido
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-amber-200 bg-amber-50 text-amber-800'
      }`}
      title={motivo || undefined}
    >
      {resolvido ? (
        <CheckCircle2 className="w-3 h-3" aria-hidden />
      ) : (
        <AlertTriangle className="w-3 h-3" aria-hidden />
      )}
      {label}: {resolvido ? 'RESOLVIDO' : 'PENDENTE'}
    </span>
  );
}

function CartaoParteResolvida({ titulo, pessoa, resolvida, carregando, erro }) {
  if (!pessoa) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-3 text-sm text-slate-500">
        {titulo}: selecione uma pessoa acima.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <User className="w-4 h-4 text-sky-700" aria-hidden />
          {titulo}
        </h3>
        <span className="text-xs text-slate-500 shrink-0">#{pessoa.id}</span>
      </div>
      <p className="text-sm font-medium text-slate-900 break-words">{pessoa.nome || '—'}</p>

      {carregando ? (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          Resolvendo endereço no PROJUDI…
        </div>
      ) : null}

      {erro ? (
        <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-1">{erro}</p>
      ) : null}

      {resolvida ? (
        <>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
            <div>
              <dt className="text-slate-500">{resolvida.tipoDoc || 'Doc'}</dt>
              <dd className="font-mono">{formatCpfExibicao(resolvida.documento)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Telefone / E-mail</dt>
              <dd>{resolvida.telefone || '—'} · {resolvida.email || '—'}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Endereço</dt>
              <dd>
                {[resolvida.logradouro, resolvida.numero, resolvida.complemento]
                  .filter(Boolean)
                  .join(', ') || '—'}
                {resolvida.cep ? ` · CEP ${resolvida.cep}` : ''}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-1.5">
            <BadgeCampo
              label="Estado"
              nivel={resolvida.estado?.nivel}
              motivo={resolvida.estado?.motivo}
            />
            <BadgeCampo
              label="Cidade"
              nivel={resolvida.cidade?.nivel}
              motivo={resolvida.cidade?.motivo}
            />
            <BadgeCampo
              label="Bairro"
              nivel={resolvida.bairro?.nivel}
              motivo={resolvida.bairro?.motivo}
            />
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${
                resolvida.prontaParaInserir
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-rose-200 bg-rose-50 text-rose-800'
              }`}
            >
              {resolvida.prontaParaInserir ? (
                <CheckCircle2 className="w-3 h-3" aria-hidden />
              ) : (
                <AlertTriangle className="w-3 h-3" aria-hidden />
              )}
              {resolvida.prontaParaInserir ? 'Pronta para inserir' : 'Pendente'}
            </span>
          </div>

          {resolvida.pendencias?.length > 0 ? (
            <ul className="text-xs text-amber-900 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 list-disc pl-4 space-y-0.5 break-words">
              {resolvida.pendencias.map((p) => (
                <li key={p} className="break-words">
                  {p}
                </li>
              ))}
            </ul>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function DistribuicaoInicialProjudi() {
  const location = useLocation();
  const navigate = useNavigate();
  const dadosProcesso =
    location.state?.dadosDistribuicaoInicial && typeof location.state.dadosDistribuicaoInicial === 'object'
      ? location.state.dadosDistribuicaoInicial
      : null;

  const [credencialId, setCredencialId] = useState('1');
  const [credenciais, setCredenciais] = useState([]);
  const [valorCausa, setValorCausa] = useState('');
  const [catalogoAssuntos, setCatalogoAssuntos] = useState([]);
  const [carregandoCatalogoAssuntos, setCarregandoCatalogoAssuntos] = useState(true);
  const [erroCatalogoAssuntos, setErroCatalogoAssuntos] = useState('');
  const [catalogoClasses, setCatalogoClasses] = useState([]);
  const [idsAssuntosSelecionados, setIdsAssuntosSelecionados] = useState([]);
  const [novoAssuntoId, setNovoAssuntoId] = useState('');
  const [novoAssuntoDescricao, setNovoAssuntoDescricao] = useState('');
  const [salvandoAssunto, setSalvandoAssunto] = useState(false);
  const [assuntoSugerido, setAssuntoSugerido] = useState(null);
  const [modalidadeSugerida, setModalidadeSugerida] = useState(null);
  const [idProcessoTipo, setIdProcessoTipo] = useState(CLASSE_JEC_PADRAO.idProcessoTipo);
  const [processoTipoCodigo, setProcessoTipoCodigo] = useState(CLASSE_JEC_PADRAO.processoTipoCodigo);
  const [segredoJustica, setSegredoJustica] = useState(false);
  const [naoMarcarAudiencia, setNaoMarcarAudiencia] = useState(false);
  const [juizo100Digital, setJuizo100Digital] = useState(false);
  const [prioridadeMaior60Anos, setPrioridadeMaior60Anos] = useState(false);
  const prioridadeAutoMarcadaRef = useRef(null);
  const sugestaoAplicadaRef = useRef(false);
  const [linhasP7s, setLinhasP7s] = useState([]);

  const [pessoaAutor, setPessoaAutor] = useState(null);
  const [pessoasReu, setPessoasReu] = useState([]);
  const [parteAutor, setParteAutor] = useState(null);
  const [partesReu, setPartesReu] = useState([]);

  const [apiError, setApiError] = useState('');
  const [toast, setToast] = useState('');
  const [operacao, setOperacao] = useState(null);
  const [resultado, setResultado] = useState(null);
  const [modalDistribuirAberto, setModalDistribuirAberto] = useState(false);
  const [confirmacaoIrreversivel, setConfirmacaoIrreversivel] = useState(false);
  /** @type {[import('../../api/iniciaisProjudiApi.js').ValidacaoProntidaoInicial|null, Function]} */
  const [validacaoProntidao, setValidacaoProntidao] = useState(null);
  const [validandoProntidao, setValidandoProntidao] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const rows = await listarCredenciais();
        const lista = Array.isArray(rows) ? rows : [];
        setCredenciais(lista);
        setCredencialId((atual) => {
          if (atual && atual !== '1') return atual;
          const preferida = lista.find((c) => String(c.id) === '1') || lista[0];
          return preferida ? String(preferida.id) : '1';
        });
      } catch {
        setCredenciais([]);
      }
    })();
  }, []);

  useEffect(() => {
    void carregarCatalogoAssuntos();
  }, []);

  async function carregarCatalogoAssuntos() {
    setCarregandoCatalogoAssuntos(true);
    setErroCatalogoAssuntos('');
    try {
      const rows = await listarAssuntosProjudi();
      setCatalogoAssuntos(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setCatalogoAssuntos([]);
      setErroCatalogoAssuntos(err?.message || 'Falha ao carregar assuntos.');
    } finally {
      setCarregandoCatalogoAssuntos(false);
    }
  }

  async function onGravarAssunto(e) {
    e?.preventDefault?.();
    const id = Number.parseInt(String(novoAssuntoId).trim(), 10);
    const descricao = novoAssuntoDescricao.trim();
    if (!Number.isFinite(id) || id < 1) {
      setApiError('Informe um id de assunto válido (número positivo).');
      return;
    }
    if (!descricao) {
      setApiError('Informe a descrição do assunto.');
      return;
    }
    setSalvandoAssunto(true);
    setApiError('');
    try {
      const item = await cadastrarAssuntoProjudi(id, descricao);
      const normalizado = {
        idAssunto: item.idAssunto,
        rotuloCompleto: item.rotuloCompleto,
        cadastroUsuario: item.cadastroUsuario !== false,
      };
      setCatalogoAssuntos((prev) => {
        const restantes = prev.filter((a) => a.idAssunto !== normalizado.idAssunto);
        return [...restantes, normalizado].sort((a, b) => a.idAssunto - b.idAssunto);
      });
      setIdsAssuntosSelecionados((prev) =>
        prev.includes(normalizado.idAssunto) ? prev : [...prev, normalizado.idAssunto],
      );
      setNovoAssuntoId('');
      setNovoAssuntoDescricao('');
      setToast(`Assunto ${normalizado.idAssunto} gravado no sistema.`);
    } catch (err) {
      setApiError(err?.message || 'Falha ao gravar assunto.');
    } finally {
      setSalvandoAssunto(false);
    }
  }

  async function onRemoverAssuntoCadastro(idAssunto) {
    if (!window.confirm(`Remover o assunto ${idAssunto} do cadastro do sistema?`)) {
      return;
    }
    setApiError('');
    try {
      await removerAssuntoProjudi(idAssunto);
      setCatalogoAssuntos((prev) => prev.filter((a) => a.idAssunto !== idAssunto));
      setIdsAssuntosSelecionados((prev) => prev.filter((id) => id !== idAssunto));
      setToast(`Assunto ${idAssunto} removido do cadastro.`);
    } catch (err) {
      setApiError(err?.message || 'Falha ao remover assunto.');
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const rows = await listarClassesProjudi();
        setCatalogoClasses(Array.isArray(rows) ? rows : []);
      } catch {
        setCatalogoClasses([]);
      }
    })();
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const t = window.setTimeout(() => setToast(''), 5000);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!dadosProcesso) return;
    if (dadosProcesso.valorCausa) setValorCausa(String(dadosProcesso.valorCausa));
    if (dadosProcesso.pessoaAutor?.id) setPessoaAutor(dadosProcesso.pessoaAutor);
    if (Array.isArray(dadosProcesso.pessoasReu) && dadosProcesso.pessoasReu.length > 0) {
      setPessoasReu(dadosProcesso.pessoasReu.filter((p) => p?.id));
    } else if (dadosProcesso.pessoaReu?.id) {
      setPessoasReu([dadosProcesso.pessoaReu]);
    }
  }, [dadosProcesso]);

  useEffect(() => {
    if (sugestaoAplicadaRef.current) return;
    const natureza = dadosProcesso?.naturezaAcao;
    if (!natureza) {
      sugestaoAplicadaRef.current = true;
      return;
    }
    void (async () => {
      try {
        const res = await sugerirAssuntoProjudi(natureza);
        const idSugerido = res?.idAssuntoSugerido ?? null;
        setAssuntoSugerido(idSugerido);
        setModalidadeSugerida(res);
        if (idSugerido != null) {
          setIdsAssuntosSelecionados((prev) => (prev.length === 0 ? [idSugerido] : prev));
        }
        if (res?.idProcessoTipo != null && res?.processoTipoCodigo != null) {
          setIdProcessoTipo(res.idProcessoTipo);
          setProcessoTipoCodigo(res.processoTipoCodigo);
        }
      } catch {
        // sugestão opcional
      } finally {
        sugestaoAplicadaRef.current = true;
      }
    })();
  }, [dadosProcesso?.naturezaAcao]);

  useEffect(() => {
    if (!dadosProcesso) {
      setValidacaoProntidao(null);
      setParteAutor(null);
      setPartesReu([]);
      setValidandoProntidao(false);
      return undefined;
    }
    let cancelado = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setValidandoProntidao(true);
        try {
          const res = await validarProntidaoInicial({
            credencialId,
            valorCausa,
            idAssuntos: montarCsvAssuntos(idsAssuntosSelecionados),
            pessoaIdAutor: pessoaAutor?.id,
            pessoaIdsReu: pessoasReu.map((p) => p?.id).filter(Boolean),
            quantidadeAnexos: linhasP7s.length,
            processoIdOrigem: dadosProcesso?.processoApiId,
          });
          if (!cancelado) {
            setValidacaoProntidao(res);
            setParteAutor(res.autor ?? null);
            setPartesReu(Array.isArray(res.reus) ? res.reus : []);
          }
        } catch {
          if (!cancelado) {
            setValidacaoProntidao({
              pronta: false,
              bloqueios: ['Falha ao consultar validação no servidor.'],
              pendenciasPartes: [],
              autor: null,
              reus: [],
              autorMaiorDe60Anos: null,
            });
            setParteAutor(null);
            setPartesReu([]);
          }
        } finally {
          if (!cancelado) setValidandoProntidao(false);
        }
      })();
    }, 400);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [
    dadosProcesso,
    credencialId,
    valorCausa,
    idsAssuntosSelecionados,
    pessoaAutor?.id,
    pessoasReu,
    linhasP7s.length,
  ]);

  useEffect(() => {
    const autorId = pessoaAutor?.id ?? null;
    if (!autorId) {
      setPrioridadeMaior60Anos(false);
      prioridadeAutoMarcadaRef.current = null;
      return;
    }
    if (prioridadeAutoMarcadaRef.current != null && prioridadeAutoMarcadaRef.current !== autorId) {
      prioridadeAutoMarcadaRef.current = null;
      setPrioridadeMaior60Anos(false);
    }
    if (
      validacaoProntidao?.autorMaiorDe60Anos === true &&
      prioridadeAutoMarcadaRef.current !== autorId
    ) {
      setPrioridadeMaior60Anos(true);
      prioridadeAutoMarcadaRef.current = autorId;
    }
  }, [pessoaAutor?.id, validacaoProntidao?.autorMaiorDe60Anos]);

  const reusComPendencia = partesReu.some((p) => p && !p.prontaParaInserir);
  const todosReusInformados =
    pessoasReu.length > 0 && pessoasReu.every((p) => Number(p?.id) > 0);

  const partesPendentes =
    (parteAutor && !parteAutor.prontaParaInserir) ||
    reusComPendencia ||
    !todosReusInformados ||
    validandoProntidao;

  const podePreparar = validacaoProntidao?.pronta === true && !validandoProntidao;

  const classeSelecionada =
    catalogoClasses.find(
      (c) => c.idProcessoTipo === idProcessoTipo && c.processoTipoCodigo === processoTipoCodigo,
    ) ?? null;

  const opcoesPasso3 = {
    segredoJustica,
    naoMarcarAudiencia,
    juizo100Digital,
  };

  const voltarParaProcesso = () => {
    if (dadosProcesso?.codigoCliente || dadosProcesso?.numeroInterno || dadosProcesso?.processoApiId) {
      navigate(
        buildLinkDestinoProcesso(
          '/processos',
          dadosProcesso.codigoCliente,
          dadosProcesso.numeroInterno,
          { processoApiId: dadosProcesso.processoApiId },
        ),
      );
      return;
    }
    navigate('/processos');
  };

  const onPreparar = async (e) => {
    e.preventDefault();
    if (!podePreparar) return;
    setOperacao('preparar');
    setApiError('');
    setResultado(null);
    try {
      const fd = montarFormDataInicial({
        credencialId,
        valorCausa,
        idsAssuntosSelecionados,
        pessoaAutor,
        pessoasReu,
        linhasP7s,
        idProcessoTipo,
        processoTipoCodigo,
        opcoesPasso3,
        prioridadeMaior60Anos,
      });
      const res = await prepararInicial(fd);
      setResultado(res);
      if (res?.ok) {
        setToast('Preparação concluída até a revisão no PROJUDI.');
      } else {
        setApiError(res?.passoAlcancado ? `Interrompido em ${res.passoAlcancado}.` : 'Preparação não concluída.');
      }
    } catch (err) {
      setApiError(err?.message || 'Falha ao preparar inicial.');
    } finally {
      setOperacao(null);
    }
  };

  const onConfirmarDistribuir = async () => {
    if (!podePreparar || !confirmacaoIrreversivel) return;
    setModalDistribuirAberto(false);
    setConfirmacaoIrreversivel(false);
    setOperacao('distribuir');
    setApiError('');
    setResultado(null);
    try {
      const fd = montarFormDataInicial({
        credencialId,
        valorCausa,
        idsAssuntosSelecionados,
        pessoaAutor,
        pessoasReu,
        linhasP7s,
        idProcessoTipo,
        processoTipoCodigo,
        processoIdOrigem: dadosProcesso?.processoApiId,
        confirmar: true,
        opcoesPasso3,
        prioridadeMaior60Anos,
      });
      const res = await distribuirInicial(fd);
      setResultado(res);
      if (res?.ok && res?.numeroProcessoGerado) {
        setToast(`Processo distribuído: ${res.numeroProcessoGerado}`);
      } else if (res?.ok) {
        setToast('Dry-run concluído até revisão.');
      } else {
        setApiError(res?.passoAlcancado ? `Interrompido em ${res.passoAlcancado}.` : 'Distribuição não concluída.');
      }
    } catch (err) {
      setApiError(err?.message || 'Falha ao distribuir inicial.');
    } finally {
      setOperacao(null);
    }
  };

  return (
    <div className="w-full min-w-0 text-slate-900">
      <div className="mx-auto w-full max-w-[1400px] space-y-5 px-4 py-6 pb-6 sm:px-6">
        <header className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-slate-900 flex items-center gap-2">
              <Scale className="w-5 h-5 text-sky-700" aria-hidden />
              Distribuir Inicial PROJUDI
            </h1>
            {dadosProcesso?.chaveProcesso ? (
              <p className="text-sm text-sky-800 mt-1">
                Processo <span className="font-mono font-medium">{dadosProcesso.chaveProcesso}</span> — dados
                pré-preenchidos a partir do cadastro.
              </p>
            ) : (
              <p className="text-sm text-amber-800 mt-1">
                Abra esta tela pelo botão <strong>Distribuir Inicial PROJUDI</strong> no formulário de Processos
                para carregar autor, réu e valor da causa automaticamente.
              </p>
            )}
            <p className="text-sm text-slate-600 mt-1">
              Monta a inicial no PROJUDI até a tela de <strong>revisão</strong> (Passo 3).
            </p>
          </div>
          <button
            type="button"
            onClick={voltarParaProcesso}
            className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm hover:bg-slate-50 hover:text-slate-800"
            aria-label="Voltar ao processo"
            title="Voltar ao processo"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </header>

        {!dadosProcesso ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 flex gap-2">
            <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            <div>
              Nenhum processo vinculado — você pode cadastrar assuntos PROJUDI abaixo. Para preparar ou
              distribuir uma inicial, abra esta tela pelo botão{' '}
              <strong>Distribuir Inicial PROJUDI</strong> no formulário de Processos.{' '}
              <button
                type="button"
                className="underline font-medium"
                onClick={() => navigate('/processos')}
              >
                Ir para Processos
              </button>
            </div>
          </div>
        ) : null}

        <div
          className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 flex gap-2"
          role="note"
        >
          <Info className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
          <div>
            <strong>Isto NÃO distribui o processo.</strong> O sistema apenas preenche o fluxo no PROJUDI até a
            revisão. Confira os dados no site do TJGO e conclua a distribuição manualmente.
          </div>
        </div>

        {apiError ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800 flex gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
            {apiError}
          </div>
        ) : null}

        <form onSubmit={(e) => void onPreparar(e)} className="space-y-5">
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">Dados da inicial</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <label className="block">
                <span className="text-xs text-slate-600">Valor da causa</span>
                <input
                  className={inputClass}
                  value={valorCausa}
                  onChange={(ev) => setValorCausa(ev.target.value)}
                  placeholder="Ex.: 1500,00"
                />
              </label>
              <label className="block sm:col-span-2">
                <span className="text-xs text-slate-600">Classe processual (PROJUDI)</span>
                {catalogoClasses.length > 0 ? (
                  <select
                    className={inputClass}
                    value={`${idProcessoTipo}:${processoTipoCodigo}`}
                    onChange={(ev) => {
                      const [tipo, codigo] = ev.target.value.split(':');
                      setIdProcessoTipo(Number(tipo));
                      setProcessoTipoCodigo(Number(codigo));
                    }}
                  >
                    {catalogoClasses.map((classe) => (
                      <option
                        key={classe.id}
                        value={`${classe.idProcessoTipo}:${classe.processoTipoCodigo}`}
                      >
                        {classe.rotulo} (Id {classe.idProcessoTipo} / código {classe.processoTipoCodigo})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={inputClass}
                    readOnly
                    value={`Id ${idProcessoTipo} / código ${processoTipoCodigo}`}
                  />
                )}
                <p className="text-xs text-sky-800 mt-1">
                  Será enviada ao PROJUDI:{' '}
                  <strong>{classeSelecionada?.rotulo ?? 'Procedimento do Juizado Especial Cível'}</strong>
                  {modalidadeSugerida?.modalidadeRotulo
                    ? ` — modalidade sugerida: ${modalidadeSugerida.modalidadeRotulo}.`
                    : '.'}
                </p>
              </label>
              <div className="block sm:col-span-2 space-y-2">
                <span className="text-xs text-slate-600">Assuntos (PROJUDI)</span>
                {dadosProcesso?.naturezaAcao ? (
                  <p className="text-xs text-sky-800">
                    Natureza da ação: <strong>{dadosProcesso.naturezaAcao}</strong>
                    {assuntoSugerido != null
                      ? ' — assunto e classe sugeridos pré-selecionados (pode alterar).'
                      : ''}
                  </p>
                ) : null}
                {carregandoCatalogoAssuntos ? (
                  <p className="text-xs text-slate-500">Carregando catálogo…</p>
                ) : erroCatalogoAssuntos ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs text-rose-800 flex items-start justify-between gap-2">
                    <span>{erroCatalogoAssuntos}</span>
                    <button
                      type="button"
                      className="shrink-0 underline font-medium"
                      onClick={() => void carregarCatalogoAssuntos()}
                    >
                      Tentar de novo
                    </button>
                  </div>
                ) : catalogoAssuntos.length === 0 ? (
                  <p className="text-xs text-slate-500">Nenhum assunto cadastrado.</p>
                ) : (
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50/50 p-2 space-y-1.5">
                    {catalogoAssuntos.map((item) => {
                      const checked = idsAssuntosSelecionados.includes(item.idAssunto);
                      return (
                        <div
                          key={item.idAssunto}
                          className="flex items-start gap-2 text-xs hover:bg-white/80 rounded px-1 py-0.5"
                        >
                          <label className="flex flex-1 items-start gap-2 cursor-pointer min-w-0">
                            <input
                              type="checkbox"
                              className="mt-0.5 shrink-0"
                              checked={checked}
                              onChange={(ev) => {
                                setIdsAssuntosSelecionados((prev) =>
                                  ev.target.checked
                                    ? [...prev, item.idAssunto]
                                    : prev.filter((id) => id !== item.idAssunto),
                                );
                              }}
                            />
                            <span className="text-slate-800 min-w-0">
                              <span className="font-mono font-semibold text-sky-800">{item.idAssunto}</span>
                              {' — '}
                              {item.rotuloCompleto}
                              {item.cadastroUsuario ? (
                                <span className="ml-1.5 inline-flex rounded bg-amber-100 px-1 py-0.5 text-[10px] font-medium text-amber-900">
                                  Cadastro
                                </span>
                              ) : null}
                            </span>
                          </label>
                          <button
                            type="button"
                            className="shrink-0 inline-flex items-center gap-1 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700 hover:bg-red-100"
                            title="Excluir da lista"
                            onClick={() => void onRemoverAssuntoCadastro(item.idAssunto)}
                          >
                            <Trash2 className="w-3 h-3" aria-hidden />
                            Excluir
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div
                  className="rounded-lg border border-dashed border-slate-300 bg-white p-3 space-y-2"
                  onKeyDown={(ev) => {
                    if (ev.key === 'Enter' && !salvandoAssunto) {
                      ev.preventDefault();
                      ev.stopPropagation();
                      void onGravarAssunto();
                    }
                  }}
                >
                  <p className="text-xs font-medium text-slate-700">Cadastrar assunto no sistema</p>
                  <p className="text-[11px] text-slate-500">
                    Informe id e descrição PROJUDI para reutilizar em futuras distribuições iniciais.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-[7rem_1fr_auto] gap-2 items-end">
                    <label className="block">
                      <span className="text-xs text-slate-500">Id</span>
                      <input
                        className={inputClass}
                        value={novoAssuntoId}
                        onChange={(ev) => setNovoAssuntoId(ev.target.value.replace(/\D/g, ''))}
                        placeholder="Ex.: 1234"
                        inputMode="numeric"
                        disabled={salvandoAssunto}
                      />
                    </label>
                    <label className="block min-w-0">
                      <span className="text-xs text-slate-500">Descrição</span>
                      <input
                        className={inputClass}
                        value={novoAssuntoDescricao}
                        onChange={(ev) => setNovoAssuntoDescricao(ev.target.value)}
                        placeholder="Ex.: DIREITO CIVIL > …"
                        maxLength={500}
                        disabled={salvandoAssunto}
                      />
                    </label>
                    <button
                      type="button"
                      className={`${processosBtnPrimary} whitespace-nowrap px-3 py-1.5 text-xs`}
                      disabled={salvandoAssunto}
                      onClick={() => void onGravarAssunto()}
                    >
                      {salvandoAssunto ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" aria-hidden />
                          Gravando…
                        </>
                      ) : (
                        'Gravar no sistema'
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-800">Partes</h2>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:gap-8">
              <div className="space-y-2 min-w-0">
                <span className="text-xs font-medium text-slate-600">Autor</span>
                <SeletorPessoaParteImovel
                  pessoaSelecionada={pessoaAutor}
                  onChange={setPessoaAutor}
                  disabled={!dadosProcesso}
                />
                <CartaoParteResolvida
                  titulo="Autor"
                  pessoa={pessoaAutor}
                  resolvida={parteAutor}
                  carregando={validandoProntidao && Boolean(pessoaAutor?.id)}
                  erro=""
                />
              </div>
              <div className="space-y-4 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-slate-600">
                    Réus{pessoasReu.length > 0 ? ` (${pessoasReu.length})` : ''}
                  </span>
                  <button
                    type="button"
                    className="text-xs font-medium text-sky-700 hover:text-sky-900 disabled:text-slate-400"
                    disabled={!dadosProcesso}
                    onClick={() => setPessoasReu((prev) => [...prev, null])}
                  >
                    + Adicionar réu
                  </button>
                </div>
                {pessoasReu.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50/50 p-3 text-sm text-slate-500">
                    Nenhum réu carregado — use o botão acima ou abra esta tela a partir do processo.
                  </div>
                ) : (
                  pessoasReu.map((pessoa, idx) => (
                    <div key={pessoa?.id ?? `reu-slot-${idx}`} className="space-y-2 rounded-lg border border-slate-100 bg-white/60 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-slate-600">
                          {pessoasReu.length > 1 ? `Réu ${idx + 1}` : 'Réu'}
                        </span>
                        {pessoasReu.length > 1 ? (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-xs text-rose-700 hover:text-rose-900"
                            onClick={() =>
                              setPessoasReu((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)))
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            Remover
                          </button>
                        ) : null}
                      </div>
                      <SeletorPessoaParteImovel
                        pessoaSelecionada={pessoa}
                        onChange={(novaPessoa) =>
                          setPessoasReu((prev) => prev.map((item, i) => (i === idx ? novaPessoa : item)))
                        }
                        disabled={!dadosProcesso}
                      />
                      <CartaoParteResolvida
                        titulo={pessoasReu.length > 1 ? `Réu ${idx + 1}` : 'Réu'}
                        pessoa={pessoa}
                        resolvida={partesReu[idx] ?? null}
                        carregando={validandoProntidao && Boolean(pessoa?.id)}
                        erro=""
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
            {partesPendentes && pessoaAutor && pessoasReu.length > 0 ? (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                Corrija as pendências das partes antes de preparar.
              </p>
            ) : null}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">Anexos (.p7s)</h2>
            <p className="text-xs text-slate-600">
              Coloque os PDFs na subpasta <strong>«Assinar»</strong> do processo no Google Drive e use
              assinatura automática, ou envie os <span className="font-mono">.p7s</span> já assinados
              manualmente.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {dadosProcesso?.codigoCliente && dadosProcesso?.numeroInterno ? (
                <AssinaturaAutomaticaInicialPanel
                  credencialId={credencialId}
                  codigoCliente={dadosProcesso.codigoCliente}
                  numeroInterno={dadosProcesso.numeroInterno}
                  disabled={!dadosProcesso || operacao != null}
                  onArquivosAssinados={(linhas) => setLinhasP7s(linhas)}
                  onToast={setToast}
                  onErro={setApiError}
                />
              ) : null}
              <input
                id="inicial-p7s"
                type="file"
                accept=".p7s,.pdf.p7s,application/pkcs7-signature"
                multiple
                className="sr-only"
                onChange={(ev) => {
                  const files = Array.from(ev.target.files || []);
                  ev.target.value = '';
                  const invalidos = files.filter((f) => !isArquivoP7s(f));
                  if (invalidos.length) {
                    setApiError('Selecione apenas arquivos .p7s.');
                    return;
                  }
                  setLinhasP7s((rows) => [...rows, ...files.map((f) => linhaP7sComArquivo(f))]);
                }}
              />
              <label htmlFor="inicial-p7s" className={`${processosBtnPrimary} cursor-pointer text-sm`}>
                Escolher .p7s…
              </label>
              {linhasP7s.length > 0 ? (
                <span className="text-sm text-slate-600">{linhasP7s.length} arquivo(s)</span>
              ) : null}
            </div>
            {linhasP7s.length > 0 ? (
              <ul className="max-h-[min(24rem,50vh)] space-y-1 overflow-y-auto rounded-lg border border-slate-100 bg-slate-50/50 p-2">
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
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">Prioridade processual</h2>
            <p className="text-xs text-slate-600">
              Enviada ao PROJUDI no Passo 1. Quando o cadastro do autor traz data de nascimento, o sistema
              marca automaticamente se ele já completou 60 anos.
            </p>
            <label className="flex items-start gap-2 text-sm text-slate-800 cursor-pointer">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={prioridadeMaior60Anos}
                onChange={(ev) => setPrioridadeMaior60Anos(ev.target.checked)}
              />
              <span>
                <strong>Maior de 60 Anos</strong>
                {validacaoProntidao?.autorMaiorDe60Anos === true ? (
                  <span className="ml-1.5 inline-flex rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-900">
                    Detectado no autor
                  </span>
                ) : null}
                {validacaoProntidao?.autorMaiorDe60Anos === false ? (
                  <span className="block text-xs text-slate-500">
                    Autor com data de nascimento no cadastro — ainda não completou 60 anos.
                  </span>
                ) : null}
                {validacaoProntidao?.autorMaiorDe60Anos == null && pessoaAutor?.id ? (
                  <span className="block text-xs text-slate-500">
                    Sem data de nascimento no cadastro do autor — marque manualmente se aplicável.
                  </span>
                ) : null}
              </span>
            </label>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">Opções do Passo 3 (revisão PROJUDI)</h2>
            <p className="text-xs text-slate-600">
              Configure aqui as três opções da tela de confirmação do PROJUDI antes de distribuir. Ao clicar em{' '}
              <strong>Distribuir no PROJUDI</strong>, o sistema envia estas escolhas no POST final.
            </p>
            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={segredoJustica}
                  onChange={(ev) => setSegredoJustica(ev.target.checked)}
                />
                <span>
                  <strong>Segredo de Justiça</strong>
                  <span className="block text-xs text-slate-500">
                    Marque se o processo envolve segredo de justiça.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={naoMarcarAudiencia}
                  onChange={(ev) => setNaoMarcarAudiencia(ev.target.checked)}
                />
                <span>
                  <strong>Não Marcar Audiência</strong>
                  <span className="block text-xs text-slate-500">
                    Evita que o PROJUDI marque audiência automaticamente.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={juizo100Digital}
                  onChange={(ev) => setJuizo100Digital(ev.target.checked)}
                />
                <span>
                  <strong>Deseja aderir ao Juízo 100% Digital?</strong>
                  <span className="block text-xs text-slate-500">
                    Implica adesão às regras do Juízo 100% Digital (Decreto Judiciário 837/2021).
                  </span>
                </span>
              </label>
            </div>
          </section>

          {dadosProcesso && validandoProntidao ? (
            <p className="text-xs text-slate-500 flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />
              Verificando requisitos no servidor…
            </p>
          ) : null}

          {dadosProcesso &&
          validacaoProntidao &&
          !validacaoProntidao.pronta &&
          validacaoProntidao.bloqueios?.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <p className="font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
                Ainda não é possível preparar ou distribuir:
              </p>
              <ul className="list-disc pl-5 mt-1.5 space-y-0.5">
                {validacaoProntidao.bloqueios.map((bloqueio) => (
                  <li key={bloqueio}>{bloqueio}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className={`${processosBtnPrimary} w-full sm:w-auto`}
              disabled={!podePreparar || operacao === 'preparar' || operacao === 'distribuir'}
            >
              {operacao === 'preparar' ? (
                <Loader2 className="w-4 h-4 animate-spin inline mr-1" aria-hidden />
              ) : null}
              Preparar até revisão
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!podePreparar || operacao === 'preparar' || operacao === 'distribuir'}
              onClick={() => {
                setConfirmacaoIrreversivel(false);
                setModalDistribuirAberto(true);
              }}
            >
              {operacao === 'distribuir' ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              ) : (
                <AlertTriangle className="w-4 h-4" aria-hidden />
              )}
              Distribuir no PROJUDI
            </button>
          </div>
        </form>

        {modalDistribuirAberto ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-distribuir-titulo"
          >
            <div className="w-full max-w-md rounded-xl border border-rose-200 bg-white p-5 shadow-xl space-y-4">
              <h2 id="modal-distribuir-titulo" className="text-lg font-semibold text-rose-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden />
                Confirmar distribuição
              </h2>
              <p className="text-sm text-slate-700 leading-relaxed">
                Esta ação é <strong>irreversível</strong>: envia o POST final ao PROJUDI e{' '}
                <strong>cria o processo de verdade</strong> no tribunal. Não há como desfazer pelo sistema.
              </p>
              {dadosProcesso?.chaveProcesso ? (
                <p className="text-xs text-slate-600">
                  Processo interno: <span className="font-mono">{dadosProcesso.chaveProcesso}</span>
                  {dadosProcesso.processoApiId ? ' — o número gerado será gravado em Nº Processo Novo.' : ''}
                </p>
              ) : null}
              <label className="flex items-start gap-2 text-sm text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={confirmacaoIrreversivel}
                  onChange={(ev) => setConfirmacaoIrreversivel(ev.target.checked)}
                />
                Entendo que isto distribui a inicial no PROJUDI e não pode ser revertido.
              </label>
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setModalDistribuirAberto(false);
                    setConfirmacaoIrreversivel(false);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="px-3 py-1.5 text-sm rounded-md bg-rose-600 text-white font-medium hover:bg-rose-700 disabled:opacity-50"
                  disabled={!confirmacaoIrreversivel}
                  onClick={() => void onConfirmarDistribuir()}
                >
                  Distribuir agora
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {resultado ? (
          <section
            className={`rounded-xl border p-4 shadow-sm space-y-2 ${
              resultado.ok
                ? 'border-emerald-200 bg-emerald-50/50'
                : 'border-amber-200 bg-amber-50/50'
            }`}
          >
            <h2 className="text-sm font-semibold text-slate-800">Resultado</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-slate-500 text-xs">Status</dt>
                <dd className={resultado.ok ? 'text-emerald-800 font-medium' : 'text-amber-800 font-medium'}>
                  {resultado.ok ? 'OK' : 'Não concluído'}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">Passo alcançado</dt>
                <dd className="font-mono">{resultado.passoAlcancado || '—'}</dd>
              </div>
              {resultado.hashFluxo ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500 text-xs">Hash do fluxo</dt>
                  <dd className="font-mono text-xs break-all">{resultado.hashFluxo}</dd>
                </div>
              ) : null}
              {resultado.numeroProcessoGerado ? (
                <div className="sm:col-span-2">
                  <dt className="text-slate-500 text-xs">Nº Processo Novo (PROJUDI)</dt>
                  <dd className="font-mono text-base font-semibold text-emerald-900 break-all">
                    {resultado.numeroProcessoGerado}
                  </dd>
                  {resultado.numeroGravadoCadastro ? (
                    <p className="text-xs text-emerald-700 mt-1">Gravado no cadastro do processo.</p>
                  ) : dadosProcesso?.processoApiId ? (
                    <p className="text-xs text-amber-700 mt-1">
                      Número retornado — confira o campo Nº Processo Novo no cadastro.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </dl>
            {resultado.pendenciasPartes?.length > 0 ? (
              <div className="text-sm">
                <p className="font-medium text-amber-900 mb-1">Pendências de partes</p>
                <ul className="list-disc pl-4 space-y-1 text-amber-900">
                  {resultado.pendenciasPartes.map((p) => (
                    <li key={`${p.papel}-${p.pessoaId}`}>
                      {p.papel} (#{p.pessoaId}): {(p.pendencias || []).join('; ')}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {resultado.passos?.length > 0 ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">Trilha de execução</p>
                  <button
                    type="button"
                    className={`${processosBtnPrimary} text-xs py-1.5 px-2.5 inline-flex items-center gap-1.5`}
                    onClick={() => baixarLogJson(resultado)}
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden />
                    Baixar log (.json)
                  </button>
                </div>
                <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
                        <th className="px-2 py-1.5 font-medium w-8">#</th>
                        <th className="px-2 py-1.5 font-medium">Passo</th>
                        <th className="px-2 py-1.5 font-medium w-16">Status</th>
                        <th className="px-2 py-1.5 font-medium w-12">OK</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultado.passos.map((p) => (
                        <tr
                          key={p.ordem}
                          className={`border-b border-slate-100 last:border-0 ${
                            p.ok ? '' : 'bg-rose-50/60'
                          }`}
                          title={p.detalhe || undefined}
                        >
                          <td className="px-2 py-1.5 text-slate-500 font-mono">{p.ordem}</td>
                          <td className="px-2 py-1.5 text-slate-800">{p.passo}</td>
                          <td className="px-2 py-1.5 font-mono text-slate-600">
                            {p.httpStatus ?? '—'}
                          </td>
                          <td className="px-2 py-1.5">
                            {p.ok ? (
                              <CheckCircle2
                                className="w-4 h-4 text-emerald-600"
                                aria-label="OK"
                              />
                            ) : (
                              <XCircle className="w-4 h-4 text-rose-600" aria-label="Falha" />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
            {resultado.respostaBruta ? (
              <details className="text-xs">
                <summary className="cursor-pointer text-slate-600">Resposta bruta (trecho)</summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words rounded border border-slate-200 bg-white p-2 text-slate-700">
                  {resultado.respostaBruta}
                </pre>
              </details>
            ) : null}
            {resultado.ok && resultado.passoAlcancado === 'REVISAO' && !resultado.numeroProcessoGerado ? (
              <p className="text-xs text-emerald-800">
                Revisão pronta no PROJUDI. Use &quot;Distribuir no PROJUDI&quot; para criar o processo ou conclua
                manualmente no site do TJGO.
              </p>
            ) : null}
            {resultado.ok && resultado.numeroProcessoGerado ? (
              <p className="text-xs text-emerald-800">
                Processo criado no PROJUDI. Confira movimentações e recibo no portal do tribunal.
              </p>
            ) : null}
          </section>
        ) : null}
      </div>

      <ProcessosToast message={toast} onClose={() => setToast('')} />
    </div>
  );
}

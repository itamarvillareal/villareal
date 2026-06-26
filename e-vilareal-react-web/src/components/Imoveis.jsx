import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileSpreadsheet, X } from 'lucide-react';
import {
  enderecoUmaLinha,
  formatDocBrExibicao,
  imoveisBtnIconGhost,
  imoveisBtnPrimary,
  imoveisBtnSecondary,
  imoveisInputClass,
  imoveisInputReadOnlyClass,
} from './imoveis/ImoveisAdminLayout.jsx';
import { ImoveisCadastroView } from './imoveis/ImoveisCadastroView.jsx';
import { ModalVinculosProcessoImovel } from './imoveis/ModalVinculosProcessoImovel.jsx';
import { ModalGerarContratoLocacao } from './imoveis/ModalGerarContratoLocacao.jsx';
import { padCliente } from '../data/processosDadosRelatorio.js';
import { resolverAliasHojeEmTexto } from '../services/hjDateAliasService.js';
import {
  carregarImovelCadastro,
  carregarImovelCadastroParaPainel,
  listarImoveisApi,
  salvarImovelCadastro,
} from '../repositories/imoveisRepository.js';
import { buscarCliente } from '../api/clientesService.js';
import { featureFlags, FEATURE_IPTU_NOVO } from '../config/featureFlags.js';
import { buildRouterStateChaveClienteProcesso } from '../domain/camposProcessoCliente.js';
import { obterLinkPastaImovel } from '../repositories/driveRepository.js';
import { Field } from './ui/Field.jsx';
import { imovelCorrespondeBusca } from './imoveis/imovelBusca.js';
const inputClass = imoveisInputClass;
const inputReadOnlyClass = imoveisInputReadOnlyClass;
const btnPrimary = imoveisBtnPrimary;
const btnSecondary = imoveisBtnSecondary;
const btnIconGhost = imoveisBtnIconGhost;

export function Imoveis({ modoModal = false, imovelIdInicial, onFecharModal, onCadastroSalvo } = {}) {
  const location = useLocation();
  const navigate = useNavigate();
  const idInicial = Number(imovelIdInicial);
  const [imovelId, setImovelId] = useState(() => {
    if (Number.isFinite(idInicial) && idInicial > 0) return idInicial;
    return 43;
  });
  const [imovelOcupado, setImovelOcupado] = useState(true);
  const [codigo, setCodigo] = useState('938');
  const [proc, setProc] = useState(42);
  const [observacoesInquilino, setObservacoesInquilino] = useState('');
  const [endereco, setEndereco] = useState('Rua L-17, Quadra 06, Lote 01, Apartamento 1101, Bloco C, Residencial Veredas');
  const [condominio, setCondominio] = useState('Veredas do Bosque');
  const [unidade, setUnidade] = useState('Unidade 1101 C');
  const [garagens, setGaragens] = useState('2');
  const [garantia, setGarantia] = useState('Fiador');
  const [valorGarantia, setValorGarantia] = useState('0');
  const [valorLocacao, setValorLocacao] = useState('1700');
  const [taxaAdministracaoPercent, setTaxaAdministracaoPercent] = useState('10');
  const [diaPagAluguel, setDiaPagAluguel] = useState('04');
  const [dataPag1TxCond, setDataPag1TxCond] = useState('');
  const [inscricaoImobiliaria, setInscricaoImobiliaria] = useState('101.406.0332.243');
  const [existeDebIptu, setExisteDebIptu] = useState('NÃO');
  const [dataConsIptu, setDataConsIptu] = useState('16/09/2025');
  const [aguaNumero, setAguaNumero] = useState('2178297-0');
  const [dataConsAgua, setDataConsAgua] = useState('');
  const [existeDebAgua, setExisteDebAgua] = useState('');
  const [diaVencAgua, setDiaVencAgua] = useState('');
  const [energiaNumero, setEnergiaNumero] = useState('10020482610');
  const [dataConsEnergia, setDataConsEnergia] = useState('');
  const [existeDebEnergia, setExisteDebEnergia] = useState('');
  const [diaVencEnergia, setDiaVencEnergia] = useState('');
  const [gasNumero, setGasNumero] = useState('1091705 - 39');
  const [dataConsGas, setDataConsGas] = useState('');
  const [existeDebGas, setExisteDebGas] = useState('');
  const [diaVencGas, setDiaVencGas] = useState('');
  const [dataInicioContrato, setDataInicioContrato] = useState('04/03/2026');
  const [dataFimContrato, setDataFimContrato] = useState('12/02/2026');
  const [dataConsDebitoCond, setDataConsDebitoCond] = useState('');
  const [existeDebitoCond, setExisteDebitoCond] = useState('');
  const [diaRepasse, setDiaRepasse] = useState('20');
  const [banco, setBanco] = useState('');
  const [agencia, setAgencia] = useState('');
  const [numeroBanco, setNumeroBanco] = useState('');
  const [conta, setConta] = useState('');
  const [cpfBanco, setCpfBanco] = useState('');
  const [titular, setTitular] = useState('');
  const [chavePix, setChavePix] = useState('');
  const [proprietarioNumeroPessoa, setProprietarioNumeroPessoa] = useState('');
  const [proprietario, setProprietario] = useState('');
  const [proprietarioCpf, setProprietarioCpf] = useState('');
  const [proprietarioContato, setProprietarioContato] = useState('');
  const [proprietarioCadastroCarregando, setProprietarioCadastroCarregando] = useState(false);
  const [proprietarioCadastroErro, setProprietarioCadastroErro] = useState('');
  const [linkVistoria, setLinkVistoria] = useState('https://www.drop');
  const [inquilinoNumeroPessoa, setInquilinoNumeroPessoa] = useState('');
  const [inquilino, setInquilino] = useState('');
  const [inquilinoCpf, setInquilinoCpf] = useState('');
  const [inquilinoContato, setInquilinoContato] = useState('');
  const [inquilinoCadastroCarregando, setInquilinoCadastroCarregando] = useState(false);
  const [inquilinoCadastroErro, setInquilinoCadastroErro] = useState('');
  const [showModalIptu, setShowModalIptu] = useState(false);
  const [infoIptuTexto, setInfoIptuTexto] = useState('IPTU 2025 cinco parcelas em atraso + duas à vencer R$1.323,30');
  const [showModalVinculosProc, setShowModalVinculosProc] = useState(false);
  const [showModalContratoLocacao, setShowModalContratoLocacao] = useState(false);
  const [contratoAssinadoInquilino, setContratoAssinadoInquilino] = useState('nao');
  const [contratoAssinadoProprietario, setContratoAssinadoProprietario] = useState('nao');
  const [contratoAssinadoGarantidor, setContratoAssinadoGarantidor] = useState('nao');
  const [contratoAssinadoTestemunhas, setContratoAssinadoTestemunhas] = useState('nao');
  const [contratoArquivado, setContratoArquivado] = useState('nao');
  const [contratoIntermediacaoArquivado, setContratoIntermediacaoArquivado] = useState('nao');
  const [contratoIntermediacaoAssinadoProprietario, setContratoIntermediacaoAssinadoProprietario] = useState('nao');
  const [apiLoading, setApiLoading] = useState(false);
  const [apiError, setApiError] = useState('');
  const [apiSaving, setApiSaving] = useState(false);
  const [apiSuccess, setApiSuccess] = useState('');
  const [_apiImovelId, setApiImovelId] = useState(null);
  const [_apiContratoId, setApiContratoId] = useState(null);
  const [_apiClienteId, setApiClienteId] = useState(null);
  const [_apiProcessoId, setApiProcessoId] = useState(null);
  /** Preservados entre loads/saves para não apagar legado em JSON/contrato ao salvar. */
  const jsonExtrasOriginalRef = useRef({});
  const contratoObservacoesOriginalRef = useRef(null);
  const contratoSnapshotOriginalRef = useRef(null);
  const proprietarioFetchGenRef = useRef(0);
  const inquilinoFetchGenRef = useRef(0);
  /** Baseline cod+proc ao carregar — detecta edição deliberada vs. espelho N:N no save. */
  const vinculoCodigoOriginalRef = useRef('');
  const vinculoProcOriginalRef = useRef('');
  const cargaInicialFeitaRef = useRef(false);
  /** Invalida respostas de carga atrasadas após edição local (ex.: remover vínculo). */
  const cargaFormularioSeqRef = useRef(0);
  const unidadeAlvo =
    !modoModal && location.state && typeof location.state === 'object' ? location.state.unidade : null;

  useEffect(() => {
    if (!modoModal) return;
    const n = Number(imovelIdInicial);
    if (Number.isFinite(n) && n > 0) setImovelId(n);
  }, [modoModal, imovelIdInicial]);

  const [pesquisaCondUnidade, setPesquisaCondUnidade] = useState('');
  const [listaImoveisPesquisa, setListaImoveisPesquisa] = useState([]);

  const recarregarListaImoveisPesquisa = useCallback(() => {
    if (!featureFlags.useApiImoveis) return;
    void listarImoveisApi().then((list) => {
      setListaImoveisPesquisa(Array.isArray(list) ? list : []);
    });
  }, []);

  useEffect(() => {
    if (!featureFlags.useApiImoveis) return undefined;
    recarregarListaImoveisPesquisa();
  }, [recarregarListaImoveisPesquisa]);

  const resultadosPesquisaCondUnidade = useMemo(() => {
    if (!featureFlags.useApiImoveis || !pesquisaCondUnidade.trim()) return [];
    return listaImoveisPesquisa.filter((im) => imovelCorrespondeBusca(im, pesquisaCondUnidade));
  }, [listaImoveisPesquisa, pesquisaCondUnidade]);

  function popularFormulario(data) {
    if (!data) {
      // Sem cadastro para este nº de imóvel: formulário em branco (não marcar como desocupado por engano).
      setCodigo('');
      setProc('');
      setObservacoesInquilino('');
      setEndereco('');
      setCondominio('');
      setUnidade('');
      setGaragens('');
      setGarantia('');
      setValorGarantia('');
      setValorLocacao('');
      setDiaPagAluguel('');
      setDataPag1TxCond('');
      setInscricaoImobiliaria('');
      setExisteDebIptu('');
      setDataConsIptu('');
      setAguaNumero('');
      setDataConsAgua('');
      setExisteDebAgua('');
      setDiaVencAgua('');
      setEnergiaNumero('');
      setDataConsEnergia('');
      setExisteDebEnergia('');
      setDiaVencEnergia('');
      setGasNumero('');
      setDataConsGas('');
      setExisteDebGas('');
      setDiaVencGas('');
      setDataInicioContrato('');
      setDataFimContrato('');
      setDataConsDebitoCond('');
      setExisteDebitoCond('');
      setDiaRepasse('');
      setBanco('');
      setAgencia('');
      setNumeroBanco('');
      setConta('');
      setCpfBanco('');
      setTitular('');
      setChavePix('');
      setProprietario('');
      setProprietarioCpf('');
      setProprietarioContato('');
      setLinkVistoria('');
      setInquilino('');
      setInquilinoCpf('');
      setInquilinoContato('');
      setInfoIptuTexto('');
      setContratoAssinadoInquilino('nao');
      setContratoAssinadoProprietario('nao');
      setContratoAssinadoGarantidor('nao');
      setContratoAssinadoTestemunhas('nao');
      setContratoArquivado('nao');
      setContratoIntermediacaoArquivado('nao');
      setContratoIntermediacaoAssinadoProprietario('nao');
      setApiImovelId(null);
      setApiContratoId(null);
      setApiClienteId(null);
      setApiProcessoId(null);
      jsonExtrasOriginalRef.current = {};
      contratoObservacoesOriginalRef.current = null;
      vinculoCodigoOriginalRef.current = '';
      vinculoProcOriginalRef.current = '';
      return;
    }

    setImovelOcupado(!!data.imovelOcupado);
    setCodigo(String(data.codigo ?? ''));
    setProc(data.proc != null && data.proc !== '' ? String(data.proc) : '');
    setObservacoesInquilino(String(data.observacoesInquilino ?? ''));
    setEndereco(String(data.endereco ?? ''));
    setCondominio(String(data.condominio ?? ''));
    setUnidade(String(data.unidade ?? ''));
    if (unidadeAlvo != null) setUnidade(String(unidadeAlvo));
    setGaragens(String(data.garagens ?? ''));
    setGarantia(String(data.garantia ?? ''));
    setValorGarantia(String(data.valorGarantia ?? ''));
    setValorLocacao(String(data.valorLocacao ?? ''));
    setTaxaAdministracaoPercent(String(data.taxaAdministracaoPercent ?? '10'));
    setDiaPagAluguel(String(data.diaPagAluguel ?? ''));
    setDataPag1TxCond(String(data.dataPag1TxCond ?? ''));
    setInscricaoImobiliaria(String(data.inscricaoImobiliaria ?? ''));
    setExisteDebIptu(String(data.existeDebIptu ?? ''));
    setDataConsIptu(String(data.dataConsIptu ?? ''));
    setAguaNumero(String(data.aguaNumero ?? ''));
    setDataConsAgua(String(data.dataConsAgua ?? ''));
    setExisteDebAgua(String(data.existeDebAgua ?? ''));
    setDiaVencAgua(String(data.diaVencAgua ?? ''));
    setEnergiaNumero(String(data.energiaNumero ?? ''));
    setDataConsEnergia(String(data.dataConsEnergia ?? ''));
    setExisteDebEnergia(String(data.existeDebEnergia ?? ''));
    setDiaVencEnergia(String(data.diaVencEnergia ?? ''));
    setGasNumero(String(data.gasNumero ?? ''));
    setDataConsGas(String(data.dataConsGas ?? ''));
    setExisteDebGas(String(data.existeDebGas ?? ''));
    setDiaVencGas(String(data.diaVencGas ?? ''));
    setDataInicioContrato(String(data.dataInicioContrato ?? ''));
    setDataFimContrato(String(data.dataFimContrato ?? ''));
    setDataConsDebitoCond(String(data.dataConsDebitoCond ?? ''));
    setExisteDebitoCond(String(data.existeDebitoCond ?? ''));
    setDiaRepasse(String(data.diaRepasse ?? ''));
    setBanco(String(data.banco ?? ''));
    setAgencia(String(data.agencia ?? ''));
    setNumeroBanco(String(data.numeroBanco ?? ''));
    setConta(String(data.conta ?? ''));
    setCpfBanco(String(data.cpfBanco ?? ''));
    setTitular(String(data.titular ?? ''));
    setChavePix(String(data.chavePix ?? ''));
    setProprietarioNumeroPessoa(String(data.proprietarioNumeroPessoa ?? ''));
    setProprietario(String(data.proprietario ?? ''));
    setProprietarioCpf(String(data.proprietarioCpf ?? ''));
    setProprietarioContato(String(data.proprietarioContato ?? ''));
    setLinkVistoria(String(data.linkVistoria ?? ''));
    setInquilinoNumeroPessoa(String(data.inquilinoNumeroPessoa ?? ''));
    setInquilino(String(data.inquilino ?? ''));
    setInquilinoCpf(String(data.inquilinoCpf ?? ''));
    setInquilinoContato(String(data.inquilinoContato ?? ''));
    setInfoIptuTexto(String(data.infoIptuTexto ?? ''));
    setContratoAssinadoInquilino(String(data.contratoAssinadoInquilino ?? 'nao'));
    setContratoAssinadoProprietario(String(data.contratoAssinadoProprietario ?? 'nao'));
    setContratoAssinadoGarantidor(String(data.contratoAssinadoGarantidor ?? 'nao'));
    setContratoAssinadoTestemunhas(String(data.contratoAssinadoTestemunhas ?? 'nao'));
    setContratoArquivado(String(data.contratoArquivado ?? 'nao'));
    setContratoIntermediacaoArquivado(String(data.contratoIntermediacaoArquivado ?? 'nao'));
    setContratoIntermediacaoAssinadoProprietario(String(data.contratoIntermediacaoAssinadoProprietario ?? 'nao'));
    setApiImovelId(data._apiImovelId ?? null);
    setApiContratoId(data._apiContratoId ?? null);
    setApiClienteId(data._apiClienteId ?? null);
    setApiProcessoId(data._apiProcessoId ?? null);
    jsonExtrasOriginalRef.current =
      data._jsonExtrasOriginal && typeof data._jsonExtrasOriginal === 'object' ? data._jsonExtrasOriginal : {};
    contratoObservacoesOriginalRef.current = data._contratoObservacoesOriginal ?? null;
    contratoSnapshotOriginalRef.current =
      data._contratoSnapshotOriginal && typeof data._contratoSnapshotOriginal === 'object'
        ? data._contratoSnapshotOriginal
        : null;
    vinculoCodigoOriginalRef.current = String(
      data._vinculoCodigoOriginal ?? data.codigo ?? '',
    ).trim();
    vinculoProcOriginalRef.current = String(data._vinculoProcOriginal ?? data.proc ?? '').trim();
  }

  useEffect(() => {
    let ativo = true;
    const numero = Math.max(1, Number(imovelId) || 1);
    const seqCarga = ++cargaFormularioSeqRef.current;
    setApiError('');
    setApiSuccess('');
    setApiLoading(true);

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          if (featureFlags.useApiImoveis) {
            const r = await carregarImovelCadastroParaPainel({ imovelId: numero });
            if (!ativo || seqCarga !== cargaFormularioSeqRef.current) return;
            if (r.item) {
              popularFormulario(r.item);
              const sync = Number(r.item.imovelId);
              if (Number.isFinite(sync) && sync > 0 && sync !== numero) {
                setImovelId(sync);
              }
              return;
            }

            if (!cargaInicialFeitaRef.current) {
              cargaInicialFeitaRef.current = true;
              const lista = await listarImoveisApi();
              if (!ativo || seqCarga !== cargaFormularioSeqRef.current) return;
              if (lista.length > 0) {
                const comPlanilha = lista.find(
                  (im) => im.numeroPlanilha != null && Number(im.numeroPlanilha) >= 1,
                );
                const first = comPlanilha != null ? Number(comPlanilha.numeroPlanilha) : NaN;
                if (Number.isFinite(first) && first > 0 && first !== numero) {
                  setImovelId(first);
                  return;
                }
              }
            }

            popularFormulario(null);
            setApiError(
              cargaInicialFeitaRef.current
                ? `Nenhum imóvel cadastrado com o número ${numero}.`
                : 'Nenhum imóvel no banco. Rode o import do imoveis.xlsx (job Java) ou preencha e salve um novo cadastro.',
            );
            return;
          }

          const r = await carregarImovelCadastro({ imovelId: numero });
          if (!ativo || seqCarga !== cargaFormularioSeqRef.current) return;
          if (r.item) {
            popularFormulario(r.item);
            return;
          }
          popularFormulario(null);
        } catch (e) {
          if (!ativo || seqCarga !== cargaFormularioSeqRef.current) return;
          popularFormulario(null);
          setApiError(e?.message || 'Falha ao carregar imóvel.');
        } finally {
          if (ativo && seqCarga === cargaFormularioSeqRef.current) {
            cargaInicialFeitaRef.current = true;
            setApiLoading(false);
          }
        }
      })();
    }, 350);

    return () => {
      ativo = false;
      window.clearTimeout(timer);
    };
  }, [imovelId, unidadeAlvo, modoModal]);

  useEffect(() => {
    if (modoModal) return;
    const state = location.state && typeof location.state === 'object' ? location.state : null;
    const npNav = state?.numeroPlanilha != null ? Number(state.numeroPlanilha) : null;
    if (Number.isFinite(npNav) && npNav >= 1) {
      setImovelId(npNav);
      return;
    }
    const nextImovelId = state?.imovelId != null ? Number(state.imovelId) : null;
    if (!Number.isFinite(nextImovelId) || nextImovelId <= 0) return;
    setImovelId(nextImovelId);
  }, [location.key, location.state, modoModal]);

  useEffect(() => {
    const raw = String(proprietarioNumeroPessoa ?? '').trim();
    if (!raw) {
      setProprietario('');
      setProprietarioCpf('');
      setProprietarioContato('');
      setProprietarioCadastroErro('');
      setProprietarioCadastroCarregando(false);
      return undefined;
    }
    const id = Number.parseInt(raw.replace(/\D/g, ''), 10);
    if (!Number.isFinite(id) || id < 1) {
      setProprietario('');
      setProprietarioCpf('');
      setProprietarioContato('');
      setProprietarioCadastroErro('Número da pessoa inválido.');
      setProprietarioCadastroCarregando(false);
      return undefined;
    }

    let cancelado = false;
    const gen = ++proprietarioFetchGenRef.current;
    setProprietarioCadastroCarregando(true);
    setProprietarioCadastroErro('');
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const c = await buscarCliente(id);
          if (cancelado || gen !== proprietarioFetchGenRef.current) return;
          if (!c) {
            setProprietario('');
            setProprietarioCpf('');
            setProprietarioContato('');
            setProprietarioCadastroErro(`Nenhuma pessoa encontrada com o número ${id}.`);
          } else {
            setProprietario(String(c.nome ?? '').trim());
            setProprietarioCpf(formatDocBrExibicao(c.cpf));
            setProprietarioContato(String(c.telefone ?? '').trim() || '—');
            setProprietarioCadastroErro('');
          }
        } catch {
          if (cancelado || gen !== proprietarioFetchGenRef.current) return;
          setProprietario('');
          setProprietarioCpf('');
          setProprietarioContato('');
          setProprietarioCadastroErro('Não foi possível carregar o cadastro de pessoas.');
        } finally {
          if (!cancelado && gen === proprietarioFetchGenRef.current) setProprietarioCadastroCarregando(false);
        }
      })();
    }, 380);
    return () => {
      cancelado = true;
      window.clearTimeout(t);
    };
  }, [proprietarioNumeroPessoa]);

  useEffect(() => {
    const raw = String(inquilinoNumeroPessoa ?? '').trim();
    if (!raw) {
      setInquilino('');
      setInquilinoCpf('');
      setInquilinoContato('');
      setInquilinoCadastroErro('');
      setInquilinoCadastroCarregando(false);
      return undefined;
    }
    const id = Number.parseInt(raw.replace(/\D/g, ''), 10);
    if (!Number.isFinite(id) || id < 1) {
      setInquilino('');
      setInquilinoCpf('');
      setInquilinoContato('');
      setInquilinoCadastroErro('Número da pessoa inválido.');
      setInquilinoCadastroCarregando(false);
      return undefined;
    }

    let cancelado = false;
    const gen = ++inquilinoFetchGenRef.current;
    setInquilinoCadastroCarregando(true);
    setInquilinoCadastroErro('');
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const c = await buscarCliente(id);
          if (cancelado || gen !== inquilinoFetchGenRef.current) return;
          if (!c) {
            setInquilino('');
            setInquilinoCpf('');
            setInquilinoContato('');
            setInquilinoCadastroErro(`Nenhuma pessoa encontrada com o número ${id}.`);
          } else {
            setInquilino(String(c.nome ?? '').trim());
            setInquilinoCpf(formatDocBrExibicao(c.cpf));
            setInquilinoContato(String(c.telefone ?? '').trim() || '—');
            setInquilinoCadastroErro('');
          }
        } catch {
          if (cancelado || gen !== inquilinoFetchGenRef.current) return;
          setInquilino('');
          setInquilinoCpf('');
          setInquilinoContato('');
          setInquilinoCadastroErro('Não foi possível carregar o cadastro de pessoas.');
        } finally {
          if (!cancelado && gen === inquilinoFetchGenRef.current) setInquilinoCadastroCarregando(false);
        }
      })();
    }, 380);
    return () => {
      cancelado = true;
      window.clearTimeout(t);
    };
  }, [inquilinoNumeroPessoa]);

  function atualizarExtrasParteNoRef(tipo, dados) {
    const ex = { ...(jsonExtrasOriginalRef.current || {}) };
    if (tipo === 'proprietario') {
      if (dados?.id) {
        ex.proprietarioPessoaId = String(dados.id);
        ex.proprietario = String(dados.nome ?? '').trim();
        ex.proprietarioCpf = String(dados.cpf ?? '').trim();
        ex.proprietarioContato = String(dados.contato ?? '').trim();
      } else {
        delete ex.proprietarioPessoaId;
        delete ex.locadorPessoaId;
        ex.proprietario = '';
        ex.proprietarioCpf = '';
        ex.proprietarioContato = '';
      }
    } else if (dados?.id) {
      ex.inquilinoPessoaId = String(dados.id);
      ex.inquilino = String(dados.nome ?? '').trim();
      ex.inquilinoCpf = String(dados.cpf ?? '').trim();
      ex.inquilinoContato = String(dados.contato ?? '').trim();
    } else {
      delete ex.inquilinoPessoaId;
      delete ex.inquilinoNumeroPessoa;
      ex.inquilino = '';
      ex.inquilinoCpf = '';
      ex.inquilinoContato = '';
    }
    jsonExtrasOriginalRef.current = ex;
  }

  async function aplicarPessoaProprietario(p) {
    if (!p || p.id == null) return;
    cargaFormularioSeqRef.current += 1;
    proprietarioFetchGenRef.current += 1;
    const id = String(p.id);
    const nome = String(p.nome ?? '').trim();
    const cpf = formatDocBrExibicao(p.cpf);
    const contato = String(p.telefone ?? '').trim() || '—';
    setProprietarioNumeroPessoa(id);
    setProprietario(nome);
    setProprietarioCpf(cpf);
    setProprietarioContato(contato);
    setProprietarioCadastroErro('');
    setProprietarioCadastroCarregando(false);
    atualizarExtrasParteNoRef('proprietario', { id, nome, cpf, contato });
    const idApi = _apiImovelId != null ? Number(_apiImovelId) : null;
    if (featureFlags.useApiImoveis && Number.isFinite(idApi) && idApi >= 1) {
      await salvarCadastroAtual({
        proprietarioNumeroPessoa: id,
        proprietario: nome,
        proprietarioCpf: cpf,
        proprietarioContato: contato,
      });
    }
  }

  function limparExtrasParteNoRef(tipo) {
    atualizarExtrasParteNoRef(tipo, null);
  }

  async function limparPessoaProprietario() {
    cargaFormularioSeqRef.current += 1;
    proprietarioFetchGenRef.current += 1;
    setProprietarioNumeroPessoa('');
    setProprietario('');
    setProprietarioCpf('');
    setProprietarioContato('');
    setProprietarioCadastroErro('');
    setProprietarioCadastroCarregando(false);
    limparExtrasParteNoRef('proprietario');
    const idApi = _apiImovelId != null ? Number(_apiImovelId) : null;
    if (featureFlags.useApiImoveis && Number.isFinite(idApi) && idApi >= 1) {
      await salvarCadastroAtual({
        proprietarioNumeroPessoa: '',
        proprietario: '',
        proprietarioCpf: '',
        proprietarioContato: '',
      });
    }
  }

  async function limparPessoaInquilino() {
    cargaFormularioSeqRef.current += 1;
    inquilinoFetchGenRef.current += 1;
    setInquilinoNumeroPessoa('');
    setInquilino('');
    setInquilinoCpf('');
    setInquilinoContato('');
    setInquilinoCadastroErro('');
    setInquilinoCadastroCarregando(false);
    limparExtrasParteNoRef('inquilino');
    const idApi = _apiImovelId != null ? Number(_apiImovelId) : null;
    if (featureFlags.useApiImoveis && Number.isFinite(idApi) && idApi >= 1) {
      await salvarCadastroAtual({
        inquilinoNumeroPessoa: '',
        inquilino: '',
        inquilinoCpf: '',
        inquilinoContato: '',
      });
    }
  }

  async function aplicarPessoaInquilino(p) {
    if (!p || p.id == null) return;
    cargaFormularioSeqRef.current += 1;
    inquilinoFetchGenRef.current += 1;
    const id = String(p.id);
    const nome = String(p.nome ?? '').trim();
    const cpf = formatDocBrExibicao(p.cpf);
    const contato = String(p.telefone ?? '').trim() || '—';
    setInquilinoNumeroPessoa(id);
    setInquilino(nome);
    setInquilinoCpf(cpf);
    setInquilinoContato(contato);
    setInquilinoCadastroErro('');
    setInquilinoCadastroCarregando(false);
    atualizarExtrasParteNoRef('inquilino', { id, nome, cpf, contato });
    const idApi = _apiImovelId != null ? Number(_apiImovelId) : null;
    if (featureFlags.useApiImoveis && Number.isFinite(idApi) && idApi >= 1) {
      await salvarCadastroAtual({
        inquilinoNumeroPessoa: id,
        inquilino: nome,
        inquilinoCpf: cpf,
        inquilinoContato: contato,
      });
    }
  }

  function navegarParaProcesso(codigoCliente, numeroInterno) {
    navigate('/processos', {
      state: buildRouterStateChaveClienteProcesso(codigoCliente, numeroInterno, {
        imovelId: String(imovelId),
      }),
    });
  }

  function abrirProcessoDoImovel() {
    const np = Number(imovelId);
    if (featureFlags.useApiImoveis) {
      if (!Number.isFinite(np) || np < 1) {
        window.alert('Informe o nº do imóvel antes de abrir a lista de processos vinculados.');
        return;
      }
      setShowModalVinculosProc(true);
      return;
    }
    navegarParaProcesso(padCliente(codigo ?? ''), proc ?? '');
  }

  const vinculoClienteProcOk =
    String(codigo ?? '').trim() !== '' && String(proc ?? '').trim() !== '';

  async function salvarCadastroAtual(overrides = {}) {
    setApiError('');
    setApiSuccess('');
    setApiSaving(true);
    try {
      const r = await salvarImovelCadastro({
        imovelId,
        imovelOcupado,
        codigo,
        proc,
        observacoesInquilino,
        endereco,
        condominio,
        unidade,
        garagens,
        garantia,
        valorGarantia,
        valorLocacao,
        taxaAdministracaoPercent,
        diaPagAluguel,
        dataPag1TxCond,
        inscricaoImobiliaria,
        existeDebIptu,
        dataConsIptu,
        aguaNumero,
        dataConsAgua,
        existeDebAgua,
        diaVencAgua,
        energiaNumero,
        dataConsEnergia,
        existeDebEnergia,
        diaVencEnergia,
        gasNumero,
        dataConsGas,
        existeDebGas,
        diaVencGas,
        dataInicioContrato,
        dataFimContrato,
        dataConsDebitoCond,
        existeDebitoCond,
        diaRepasse,
        banco,
        agencia,
        numeroBanco,
        conta,
        cpfBanco,
        titular,
        chavePix,
        proprietarioNumeroPessoa,
        proprietario,
        proprietarioCpf,
        proprietarioContato,
        linkVistoria,
        inquilinoNumeroPessoa,
        inquilino,
        inquilinoCpf,
        inquilinoContato,
        infoIptuTexto,
        contratoAssinadoInquilino,
        contratoAssinadoProprietario,
        contratoAssinadoGarantidor,
        contratoAssinadoTestemunhas,
        contratoArquivado,
        contratoIntermediacaoArquivado,
        contratoIntermediacaoAssinadoProprietario,
        _apiImovelId,
        _apiContratoId,
        _jsonExtrasOriginal: jsonExtrasOriginalRef.current,
        _contratoObservacoesOriginal: contratoObservacoesOriginalRef.current,
        _contratoSnapshotOriginal: contratoSnapshotOriginalRef.current,
        _vinculoCodigoOriginal: vinculoCodigoOriginalRef.current,
        _vinculoProcOriginal: vinculoProcOriginalRef.current,
        ...overrides,
      });
      if (r?.item) {
        cargaFormularioSeqRef.current += 1;
        popularFormulario(r.item);
        setImovelId(Number(r.item.imovelId || imovelId));
      }
      if (featureFlags.useApiImoveis) {
        const msgPartes =
          Object.keys(overrides).length === 0
            ? 'Cadastro do imóvel salvo na API.'
            : overrides.proprietarioNumeroPessoa === '' && Object.hasOwn(overrides, 'proprietario')
              ? 'Vínculo do proprietário removido.'
              : overrides.inquilinoNumeroPessoa === '' && Object.hasOwn(overrides, 'inquilino')
                ? 'Vínculo do inquilino removido.'
                : overrides.proprietarioNumeroPessoa
                  ? `Proprietário vinculado (#${overrides.proprietarioNumeroPessoa}).`
                  : overrides.inquilinoNumeroPessoa
                    ? `Inquilino vinculado (#${overrides.inquilinoNumeroPessoa}).`
                    : 'Cadastro do imóvel salvo na API.';
        setApiSuccess(msgPartes);
        recarregarListaImoveisPesquisa();
      } else {
        setApiSuccess('Fluxo em fallback legado/mock (sem persistência real).');
      }
      onCadastroSalvo?.();
    } catch (e) {
      setApiError(e?.message || 'Falha ao salvar cadastro do imóvel.');
    } finally {
      setApiSaving(false);
    }
  }

  const mapsUrl = useMemo(() => {
    const q = [endereco, condominio, unidade].filter((s) => String(s ?? '').trim()).join(', ');
    if (!q.trim()) return null;
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
  }, [endereco, condominio, unidade]);

  function onCopiarEndereco() {
    const t = enderecoUmaLinha(endereco, condominio, unidade);
    if (!t) return;
    void navigator.clipboard?.writeText(t);
    setApiSuccess('Endereço copiado.');
  }

  async function abrirCatalogoImovel() {
    if (!featureFlags.useApiImoveis) return;
    setApiError('');
    setApiSuccess('');
    try {
      const idApi = _apiImovelId != null ? Number(_apiImovelId) : null;
      const np = Number(imovelId);
      const pasta = await obterLinkPastaImovel({
        imovelId: Number.isFinite(idApi) && idApi >= 1 ? idApi : null,
        numeroPlanilha: Number.isFinite(np) && np >= 1 ? np : null,
      });
      if (pasta?.webViewLink) {
        window.open(pasta.webViewLink, '_blank', 'noopener,noreferrer');
        return;
      }
      setApiError('Não foi possível abrir a pasta do imóvel no Drive.');
    } catch (e) {
      setApiError(e?.message || 'Falha ao abrir catálogo no Drive.');
    }
  }

  function onSelecionarImovelPesquisa(im) {
    const np = im.numeroPlanilha != null ? Number(im.numeroPlanilha) : NaN;
    if (Number.isFinite(np) && np >= 1) {
      setPesquisaCondUnidade('');
      setImovelId(np);
      return;
    }
    setApiError(
      'Este registro não tem número da planilha (col. A). Corrija o cadastro na API antes de abrir pelo nº do imóvel.',
    );
  }

  useEffect(() => {
    if (!apiSuccess) return undefined;
    const t = window.setTimeout(() => setApiSuccess(''), 3000);
    return () => window.clearTimeout(t);
  }, [apiSuccess]);

  const contaCorrenteDisabled = !vinculoClienteProcOk || (featureFlags.useApiImoveis && !_apiImovelId);
  const contaCorrenteTitle = !vinculoClienteProcOk
    ? 'Informe Código e Proc. para vincular ao Cliente e Processo'
    : featureFlags.useApiImoveis && !_apiImovelId
      ? 'Salve o cadastro do imóvel na API antes de abrir o financeiro (é necessário o id interno do registro).'
      : 'Movimentações do Financeiro com o mesmo Cod. cliente e Proc. (conta corrente do processo)';

  const overlayModalClass = modoModal
    ? 'fixed inset-0 z-[210] flex items-center justify-center bg-black/50 p-4'
    : 'fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4';

  return (
    <div
      className={
        modoModal
          ? 'bg-transparent'
          : 'min-h-full bg-slate-100 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d]'
      }
    >
      <div className={modoModal ? 'px-3 sm:px-4 py-4 pb-6' : 'max-w-[1600px] mx-auto px-4 sm:px-5 py-5 sm:py-7 pb-10'}>
        {!modoModal ? (
          <header className="flex items-start justify-between gap-4 mb-6 lg:mb-8">
            <div className="min-w-0 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-cyan-700 dark:text-cyan-400/90">
                Administração de imóveis
              </p>
              <h1 className="text-2xl sm:text-[1.65rem] font-bold text-slate-800 dark:text-slate-50 tracking-tight">
                Imóveis em Administração
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 max-w-3xl leading-relaxed mt-2">
                Cadastro do imóvel, locação, utilidades, conta para repasse e partes.
                {featureFlags.useApiImoveis ? (
                  <>
                    {' '}
                    Com a API ativa, o <strong className="text-slate-800 dark:text-slate-200 font-semibold">número do imóvel</strong> no topo é o{' '}
                    <strong className="text-slate-800 dark:text-slate-200 font-semibold">mesmo da coluna A</strong> da planilha de importação. O{' '}
                    <strong className="text-slate-800 dark:text-slate-200 font-semibold">nº Imóvel</strong> em Processos segue o vínculo por código de cliente e proc. Com{' '}
                  </>
                ) : (
                  <>
                    {' '}
                    O <strong className="text-slate-800 dark:text-slate-200 font-semibold">nº Imóvel</strong> é o mesmo usado na tela{' '}
                    <strong className="text-slate-800 dark:text-slate-200 font-semibold">Processos</strong> (vínculo por código de cliente e proc.). Com{' '}
                  </>
                )}
                <strong className="text-slate-800 dark:text-slate-200 font-semibold">Código</strong> e <strong className="text-slate-800 dark:text-slate-200 font-semibold">Proc.</strong> preenchidos, use{' '}
                <strong className="text-slate-800 dark:text-slate-200 font-semibold">Conta Corrente</strong> para ver lançamentos do Financeiro, consolidação mensal e alertas de aluguel/repasse.
              </p>
            </div>
            <div className="flex flex-col gap-2 shrink-0 items-end">
              {featureFlags.useApiImoveis ? (
                <button
                  type="button"
                  onClick={() => navigate('/relatorio-imoveis')}
                  className={`${btnSecondary} inline-flex items-center gap-1.5 text-xs py-2 px-3`}
                >
                  <FileSpreadsheet className="w-4 h-4 shrink-0" aria-hidden />
                  Relatório de imóveis
                </button>
              ) : null}
              <button type="button" onClick={() => window.history.back()} className={btnIconGhost} aria-label="Fechar">
                <X className="w-5 h-5" />
              </button>
            </div>
          </header>
        ) : null}

        <div className="imoveis-admin-sheet overflow-visible">
          <ImoveisCadastroView
            apiLoading={apiLoading}
            apiError={apiError}
            apiSuccess={apiSuccess}
            setApiSuccess={setApiSuccess}
            apiSaving={apiSaving}
            imovelId={imovelId}
            setImovelId={setImovelId}
            imovelOcupado={imovelOcupado}
            setImovelOcupado={setImovelOcupado}
            codigo={codigo}
            setCodigo={setCodigo}
            proc={proc}
            setProc={setProc}
            _apiImovelId={_apiImovelId}
            _apiContratoId={_apiContratoId}
            _apiClienteId={_apiClienteId}
            _apiProcessoId={_apiProcessoId}
            pesquisaCondUnidade={pesquisaCondUnidade}
            setPesquisaCondUnidade={setPesquisaCondUnidade}
            resultadosPesquisaCondUnidade={resultadosPesquisaCondUnidade}
            onSelecionarImovelPesquisa={onSelecionarImovelPesquisa}
            endereco={endereco}
            setEndereco={setEndereco}
            condominio={condominio}
            setCondominio={setCondominio}
            unidade={unidade}
            setUnidade={setUnidade}
            garagens={garagens}
            setGaragens={setGaragens}
            onCopiarEndereco={onCopiarEndereco}
            mapsUrl={mapsUrl}
            garantia={garantia}
            setGarantia={setGarantia}
            valorGarantia={valorGarantia}
            setValorGarantia={setValorGarantia}
            valorLocacao={valorLocacao}
            setValorLocacao={setValorLocacao}
            taxaAdministracaoPercent={taxaAdministracaoPercent}
            setTaxaAdministracaoPercent={setTaxaAdministracaoPercent}
            diaPagAluguel={diaPagAluguel}
            setDiaPagAluguel={setDiaPagAluguel}
            dataPag1TxCond={dataPag1TxCond}
            setDataPag1TxCond={setDataPag1TxCond}
            inscricaoImobiliaria={inscricaoImobiliaria}
            setInscricaoImobiliaria={setInscricaoImobiliaria}
            existeDebIptu={existeDebIptu}
            setExisteDebIptu={setExisteDebIptu}
            dataConsIptu={dataConsIptu}
            setDataConsIptu={setDataConsIptu}
            aguaNumero={aguaNumero}
            setAguaNumero={setAguaNumero}
            dataConsAgua={dataConsAgua}
            setDataConsAgua={setDataConsAgua}
            existeDebAgua={existeDebAgua}
            setExisteDebAgua={setExisteDebAgua}
            diaVencAgua={diaVencAgua}
            setDiaVencAgua={setDiaVencAgua}
            energiaNumero={energiaNumero}
            setEnergiaNumero={setEnergiaNumero}
            dataConsEnergia={dataConsEnergia}
            setDataConsEnergia={setDataConsEnergia}
            existeDebEnergia={existeDebEnergia}
            setExisteDebEnergia={setExisteDebEnergia}
            diaVencEnergia={diaVencEnergia}
            setDiaVencEnergia={setDiaVencEnergia}
            gasNumero={gasNumero}
            setGasNumero={setGasNumero}
            dataConsGas={dataConsGas}
            setDataConsGas={setDataConsGas}
            existeDebGas={existeDebGas}
            setExisteDebGas={setExisteDebGas}
            diaVencGas={diaVencGas}
            setDiaVencGas={setDiaVencGas}
            dataInicioContrato={dataInicioContrato}
            setDataInicioContrato={setDataInicioContrato}
            dataFimContrato={dataFimContrato}
            setDataFimContrato={setDataFimContrato}
            dataConsDebitoCond={dataConsDebitoCond}
            setDataConsDebitoCond={setDataConsDebitoCond}
            existeDebitoCond={existeDebitoCond}
            setExisteDebitoCond={setExisteDebitoCond}
            diaRepasse={diaRepasse}
            setDiaRepasse={setDiaRepasse}
            banco={banco}
            setBanco={setBanco}
            agencia={agencia}
            setAgencia={setAgencia}
            numeroBanco={numeroBanco}
            setNumeroBanco={setNumeroBanco}
            conta={conta}
            setConta={setConta}
            cpfBanco={cpfBanco}
            setCpfBanco={setCpfBanco}
            titular={titular}
            setTitular={setTitular}
            chavePix={chavePix}
            setChavePix={setChavePix}
            proprietarioNumeroPessoa={proprietarioNumeroPessoa}
            setProprietarioNumeroPessoa={setProprietarioNumeroPessoa}
            proprietario={proprietario}
            proprietarioCpf={proprietarioCpf}
            proprietarioContato={proprietarioContato}
            proprietarioCadastroCarregando={proprietarioCadastroCarregando}
            proprietarioCadastroErro={proprietarioCadastroErro}
            inquilinoNumeroPessoa={inquilinoNumeroPessoa}
            setInquilinoNumeroPessoa={setInquilinoNumeroPessoa}
            inquilino={inquilino}
            inquilinoCpf={inquilinoCpf}
            inquilinoContato={inquilinoContato}
            inquilinoCadastroCarregando={inquilinoCadastroCarregando}
            inquilinoCadastroErro={inquilinoCadastroErro}
            observacoesInquilino={observacoesInquilino}
            setObservacoesInquilino={setObservacoesInquilino}
            linkVistoria={linkVistoria}
            setLinkVistoria={setLinkVistoria}
            onSalvar={salvarCadastroAtual}
            onAbrirProc={abrirProcessoDoImovel}
            onContaCorrente={() => {
              const np = Number(imovelId);
              const idApi = _apiImovelId != null ? Number(_apiImovelId) : null;
              if (modoModal && onFecharModal) onFecharModal();
              navigate({
                pathname: '/imoveis/financeiro',
                hash: '#reconciliacao-imoveis',
                search:
                  Number.isFinite(np) && np >= 1
                    ? `?imovel=${np}${Number.isFinite(idApi) && idApi >= 1 ? `&imovelApi=${idApi}` : ''}`
                    : '',
                state: {
                  imovelId: np,
                  imovelIdApi: Number.isFinite(idApi) && idApi >= 1 ? idApi : null,
                  focoReconciliacao: true,
                },
              });
            }}
            contaCorrenteDisabled={contaCorrenteDisabled}
            contaCorrenteTitle={contaCorrenteTitle}
            onGerenciarIptu={() => navigate(`/iptu/${_apiImovelId}`)}
            onCatalogo={abrirCatalogoImovel}
            onRelatorio={() => navigate('/relatorio-imoveis')}
            onGerarContratoLocacao={() => setShowModalContratoLocacao(true)}
            onFechar={modoModal && onFecharModal ? onFecharModal : () => window.history.back()}
            onAbrirIptu={() => setShowModalIptu(true)}
            onSelecionarPessoaProprietario={aplicarPessoaProprietario}
            onLimparPessoaProprietario={limparPessoaProprietario}
            onSelecionarPessoaInquilino={aplicarPessoaInquilino}
            onLimparPessoaInquilino={limparPessoaInquilino}
          />
        </div>
      </div>

      <ModalGerarContratoLocacao
        open={showModalContratoLocacao}
        onClose={() => setShowModalContratoLocacao(false)}
        contratoLocacaoId={_apiContratoId}
        codigoCliente={codigo}
        numeroInterno={proc}
        locadorNome={proprietario}
        locatarioNome={inquilino}
        onErro={(msg) => setApiError(msg)}
      />

      <ModalVinculosProcessoImovel
        open={showModalVinculosProc}
        onClose={() => setShowModalVinculosProc(false)}
        numeroPlanilha={Number(imovelId) >= 1 ? Number(imovelId) : 0}
        imovelIdApi={_apiImovelId}
        codigoCadastro={codigo}
        procCadastro={proc}
        onAbrirProcesso={(codigoCliente, numeroInterno) => {
          setShowModalVinculosProc(false);
          navegarParaProcesso(codigoCliente, numeroInterno);
        }}
        onPrincipalAlterado={recarregarListaImoveisPesquisa}
      />

      {/* Modal Informações sobre o IPTU (legado; desligado quando FEATURE_IPTU_NOVO) */}
      {!FEATURE_IPTU_NOVO && showModalIptu && (
        <div
          className={overlayModalClass}
          onClick={() => setShowModalIptu(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-iptu-titulo"
        >
          <div
            className="bg-slate-100 dark:bg-[#161e2e] rounded-2xl shadow-2xl border border-slate-300/90 dark:border-white/[0.1] max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#1a2436] rounded-t-2xl">
              <h2 id="modal-iptu-titulo" className="text-base font-semibold text-slate-800 dark:text-slate-100">
                Informações sobre o IPTU
              </h2>
              <button
                type="button"
                onClick={() => setShowModalIptu(false)}
                className={btnIconGhost}
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto flex-1">
              <Field label="Informações Sobre IPTU">
                <textarea
                  value={infoIptuTexto}
                  onChange={(e) => setInfoIptuTexto(e.target.value)}
                  rows={5}
                  className={`${inputClass} resize-y bg-white`}
                  placeholder="Informações sobre o IPTU..."
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Existe débito IPTU">
                  <input type="text" value={existeDebIptu} onChange={(e) => setExisteDebIptu(e.target.value)} className={inputClass} />
                </Field>
                <Field label="Data Consulta débito IPTU">
                  <input
                    type="text"
                    value={dataConsIptu}
                    onChange={(e) => {
                      const v = e.target.value;
                      setDataConsIptu(resolverAliasHojeEmTexto(v, 'br') ?? v);
                    }}
                    className={inputClass}
                    placeholder="dd/mm/aaaa ou hj"
                  />
                </Field>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#151d2c] rounded-b-2xl flex justify-center">
              <button type="button" onClick={() => setShowModalIptu(false)} className={btnSecondary}>
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

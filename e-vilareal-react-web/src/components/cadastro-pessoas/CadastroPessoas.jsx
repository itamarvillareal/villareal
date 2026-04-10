import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  FileText,
  MapPin,
  Phone,
  Plus,
  Search,
  FileUp,
  FileCheck2,
  ClipboardPaste,
  Loader2,
  Link2,
} from 'lucide-react';
import {
  listarClientes,
  buscarCliente,
  criarCliente,
  atualizarCliente,
  obterProximoIdCadastroPessoas,
} from '../../api/clientesService';
import { analisarDocumentoPessoa } from '../../services/personAutoFillService.js';
import { listarPessoasComDocumento, salvarDocumentoPessoa } from '../../services/pessoaDocumentoService.js';
import { ModalEnderecos } from './ModalEnderecos';
import { ModalContatos } from './ModalContatos';
import { extrairDadosDeTextoLivre } from '../../services/personTextAutofillService.js';
import { validateCPF } from '../../services/cpfValidatorService.js';
import { listarCodigosClientePorIdPessoa } from '../../data/clienteCodigoHelpers.js';
import { listarClientesCadastro } from '../../repositories/clientesRepository.js';
import { listarProcessosPorIdPessoa } from '../../data/processosHistoricoData.js';
import { resolverAliasHojeEmTexto } from '../../services/hjDateAliasService.js';
import { esbocoQualificacaoComResponsavel } from '../../services/qualificacaoContratualHelper.js';
import { SeletorResponsavelPessoa } from './SeletorResponsavelPessoa.jsx';
import { getContextoAuditoriaUsuario, registrarAuditoria } from '../../services/auditoriaCliente.js';
import { padCliente8Nav } from './cadastroPessoasNavUtils.js';
import { buildRouterStateChaveClienteProcesso } from '../../domain/camposProcessoCliente.js';
import {
  carregarPessoaComplementar,
  salvarPessoaComplementar,
} from '../../repositories/pessoasComplementaresRepository.js';
import {
  carregarEnderecosPessoa,
  carregarContatosPessoa,
  salvarEnderecosPessoa,
  salvarContatosPessoa,
  enderecosApiParaUi,
  contatosApiParaUi,
} from '../../repositories/pessoasEnderecosContatosRepository.js';
import { featureFlags } from '../../config/featureFlags.js';

let __ultimoAcessoListaPessoas = 0;

const GENEROS = [
  { value: '', label: 'Selecione' },
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Feminino' },
  { value: 'O', label: 'Outro' },
];

const ESTADOS_CIVIS = [
  { value: '', label: 'Selecione' },
  { value: 'solteiro', label: 'Solteiro(a)' },
  { value: 'casado', label: 'Casado(a)' },
  { value: 'divorciado', label: 'Divorciado(a)' },
  { value: 'viuvo', label: 'Viúvo(a)' },
  { value: 'uniao_estavel', label: 'União estável' },
];

/** Padrão quando não há nacionalidade gravada — o usuário confirma ao sair do campo (blur). */
const NACIONALIDADE_PADRAO_BR = 'Brasileira';

function normalizarDigitosCpfCnpj(s) {
  return String(s ?? '').replace(/\D/g, '');
}

/** Converte data de nascimento da API (string ISO ou LocalDate serializado) para yyyy-mm-dd no PUT. */
function dataNascimentoParaPayloadApi(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'string') {
    return val.includes('T') ? val.split('T')[0] : val;
  }
  return null;
}

/** Primeira pessoa na lista com o mesmo documento; ignora excluirId (edição da própria ficha). */
function buscarPessoaComMesmoDocumento(lista, digitos, excluirId) {
  if (!digitos) return null;
  for (const p of lista || []) {
    if (excluirId != null && Number(p.id) === Number(excluirId)) continue;
    const d = normalizarDigitosCpfCnpj(p.cpf);
    if (d && d === digitos) return p;
  }
  return null;
}

/** Ao sair da tela Cadastro de Pessoas, reabrir com edição travada (checkbox marcado). */
const SESSION_PESSOAS_EDICAO_AO_SAIR = 'vilareal:cadastro-pessoas:edicao-ao-sair:v1';

async function resolverProximoCodigoNovaPessoa() {
  try {
    const id = await obterProximoIdCadastroPessoas();
    return String(id);
  } catch {
    return '1';
  }
}

const emptyPessoa = {
  codigo: '',
  nome: '',
  genero: '',
  cpf: '',
  rg: '',
  orgaoExpedidor: '',
  profissao: '',
  dataNascimento: '',
  nacionalidade: '',
  estadoCivil: '',
  email: '',
  contato: '',
  ativo: true,
  /** Marca pessoa para a aba Processos → Monitoramento (DataJud). */
  marcadoMonitoramento: false,
  edicaoDesabilitada: false,
  /** @type {number|null} */
  responsavelId: null,
  /** @type {{ id: number, nome: string, cpf?: string, tipoPessoa?: string }|null} */
  responsavel: null,
};

export function CadastroPessoas() {
  const location = useLocation();
  const navigate = useNavigate();
  const pathPessoasNorm = (location.pathname || '').replace(/\/+$/, '') || '/';
  const isRotaListaTodasPessoas = pathPessoasNorm === '/clientes/lista';
  const [lista, setLista] = useState([]);
  /** Carregamento da ficha em /clientes/editar/:id quando a lista ainda não foi trazida (evita carregar o relatório completo). */
  const [carregandoFicha, setCarregandoFicha] = useState(false);
  const [loading] = useState(false);
  const [error, setError] = useState(null);
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [apenasAtivos] = useState(false);
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [modo, setModo] = useState('listar'); // listar | criar | editar
  const [form, setForm] = useState(emptyPessoa);
  const [editId, setEditId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [enderecos, setEnderecos] = useState([]);
  const [contatos, setContatos] = useState([]);
  const [modalEnderecos, setModalEnderecos] = useState(false);
  const [modalContatos, setModalContatos] = useState(false);
  const [modalVinculosSistema, setModalVinculosSistema] = useState(false);
  /** CPF/CNPJ já cadastrado: oferece abrir a ficha existente. */
  const [modalCpfDuplicado, setModalCpfDuplicado] = useState(null);
  /** Enquanto true, o campo Nacionalidade fica em vermelho até o usuário entrar e sair (blur), validando a sugestão. */
  const [nacionalidadeSugestaoNaoValidada, setNacionalidadeSugestaoNaoValidada] = useState(false);
  const [numeroPessoa, setNumeroPessoa] = useState('');
  const [listaClientesCodigo, setListaClientesCodigo] = useState([]);
  const [, setPessoasComDocumento] = useState([]);
  const [docPreview, setDocPreview] = useState(null);
  const [docStatus, setDocStatus] = useState({ kind: 'idle', message: '' });
  const [docProcessando, setDocProcessando] = useState(false);
  const [docErroDetalhe, setDocErroDetalhe] = useState('');
  const [erroComplementar, setErroComplementar] = useState('');
  const inputDocRef = useRef(null);
  /** Evita reabrir o modal de contatos logo ao fechar, quando o foco volta ao campo Contato. */
  const ignorarProximoFocusContatoRef = useRef(false);
  const [textoColagemPessoa, setTextoColagemPessoa] = useState('');
  const [extracaoAvisos, setExtracaoAvisos] = useState([]);
  const [extracaoResumo, setExtracaoResumo] = useState('');
  const [extracaoDebug, setExtracaoDebug] = useState(null);
  const [extracaoEndereco, setExtracaoEndereco] = useState(null);
  const [modoDebugExtracao, setModoDebugExtracao] = useState(false);
  const [extracaoProcessando, setExtracaoProcessando] = useState(false);
  /** Evita repetir log de auditoria ao mesmo cadastro na lista. */
  const ultimoCadastroLogadoRef = useRef(null);
  const [camposPreenchidosPorTexto, setCamposPreenchidosPorTexto] = useState({
    nome: false,
    cpf: false,
    rg: false,
    dataNascimento: false,
    nacionalidade: false,
    profissao: false,
    estadoCivil: false,
    email: false,
  });

  useEffect(() => {
    return () => {
      try {
        window.sessionStorage.setItem(SESSION_PESSOAS_EDICAO_AO_SAIR, '1');
      } catch {
        /* ignore */
      }
    };
  }, []);

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SESSION_PESSOAS_EDICAO_AO_SAIR) === '1') {
        window.sessionStorage.removeItem(SESSION_PESSOAS_EDICAO_AO_SAIR);
        setForm((f) => ({ ...f, edicaoDesabilitada: true }));
      }
    } catch {
      /* ignore */
    }
  }, []);

  function limparTextoColagem() {
    setTextoColagemPessoa('');
    setExtracaoAvisos([]);
    setExtracaoResumo('');
    setExtracaoDebug(null);
    setExtracaoEndereco(null);
  }

  function handleExtrairDadosTextoLivre() {
    setExtracaoProcessando(true);
    setExtracaoResumo('');
    setExtracaoDebug(null);
    window.setTimeout(() => {
      try {
        const r = extrairDadosDeTextoLivre(textoColagemPessoa, { debug: modoDebugExtracao });
        setExtracaoAvisos(r.avisos || []);
        if (modoDebugExtracao && r.debug) setExtracaoDebug(r.debug);
        setExtracaoEndereco(r.endereco || null);
        const t = String(textoColagemPessoa || '').trim();
        if (!t) {
          setExtracaoResumo('');
          setCamposPreenchidosPorTexto({
            nome: false,
            cpf: false,
            rg: false,
            dataNascimento: false,
            nacionalidade: false,
            profissao: false,
            estadoCivil: false,
            email: false,
          });
          setExtracaoEndereco(null);
          return;
        }
        setTextoColagemPessoa(r.textoNormalizado ?? '');
        if (!r.sucesso) {
          setExtracaoResumo(
            'Nenhum dado identificado neste texto. Ajuste o trecho ou preencha manualmente.'
          );
          return;
        }
        const cpfSeguro =
          r.cpf && validateCPF(r.cpf).valido ? validateCPF(r.cpf).normalizado : null;
        const avisosExtra = [];
        if (r.cpf && !cpfSeguro) {
          avisosExtra.push(
            'Número no formato CPF encontrado, mas inválido (dígitos verificadores); CPF não foi preenchido.'
          );
        }
        if (avisosExtra.length) {
          setExtracaoAvisos((prev) => [...(prev || []), ...avisosExtra]);
        }
        const marcados = {
          nome: !!r.nomeCompleto,
          cpf: !!cpfSeguro,
          rg: !!r.rg,
          dataNascimento: !!r.dataNascimento,
          nacionalidade: !!r.nacionalidade,
          profissao: !!r.profissao,
          estadoCivil: !!r.estadoCivil,
          email: !!r.email,
        };
        setCamposPreenchidosPorTexto(marcados);
        setForm((f) => ({
          ...f,
          ...(r.nomeCompleto ? { nome: r.nomeCompleto } : {}),
          ...(cpfSeguro ? { cpf: cpfSeguro } : {}),
          ...(r.rg ? { rg: r.rg } : {}),
          ...(r.dataNascimento ? { dataNascimento: r.dataNascimento } : {}),
          ...(r.nacionalidade ? { nacionalidade: r.nacionalidade } : {}),
          ...(r.profissao ? { profissao: r.profissao } : {}),
          ...(r.estadoCivil ? { estadoCivil: r.estadoCivil } : {}),
          ...(r.email ? { email: r.email } : {}),
        }));

        const ok = [];
        if (r.nomeCompleto) ok.push('nome');
        if (cpfSeguro) ok.push('CPF');
        if (r.rg) ok.push('RG');
        if (r.dataNascimento) ok.push('data de nascimento');
        if (r.nacionalidade) ok.push('nacionalidade');
        if (r.profissao) ok.push('profissão');
        if (r.estadoCivil) ok.push('estado civil');
        if (r.email) ok.push('e-mail');
        const temSugestaoEndereco =
          r.endereco && (r.endereco.rua || r.endereco.cep || r.endereco.cidade);
        const partesResumo = [];
        if (ok.length) partesResumo.push(`Campos preenchidos automaticamente: ${ok.join(', ')}.`);
        if (temSugestaoEndereco) {
          partesResumo.push(
            'Sugestão de endereço: abra o botão Endereços, confira os campos e clique em Incluir para adicionar à lista.'
          );
        }
        setExtracaoResumo(
          partesResumo.length ? `${partesResumo.join(' ')} Revise antes de salvar.` : ''
        );
      } finally {
        setExtracaoProcessando(false);
      }
    }, 80);
  }

  useEffect(() => {
    setPessoasComDocumento(listarPessoasComDocumento());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listarClientesCadastro()
      .then((list) => {
        if (!cancelled) setListaClientesCodigo(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (!cancelled) setListaClientesCodigo([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const listaExibida = lista;
  const pessoaAtual = listaExibida[indiceAtual];

  const idPessoaParaVinculos = useMemo(() => {
    if (modo === 'criar') return null;
    if (modo === 'editar' && editId != null) return Number(editId);
    if (modo === 'listar' && pessoaAtual?.id != null) return Number(pessoaAtual.id);
    return null;
  }, [modo, editId, pessoaAtual]);

  const nomeParaVinculos = useMemo(() => {
    if (modo === 'editar' || modo === 'criar') return String(form.nome || '').trim();
    return String(pessoaAtual?.nome || form.nome || '').trim();
  }, [modo, form.nome, pessoaAtual]);

  const vinculosClienteProc = useMemo(() => {
    if (idPessoaParaVinculos == null || !Number.isFinite(idPessoaParaVinculos)) {
      return { codigosCliente: [], processos: [] };
    }
    return {
      codigosCliente: listarCodigosClientePorIdPessoa(idPessoaParaVinculos, listaClientesCodigo),
      processos: listarProcessosPorIdPessoa(idPessoaParaVinculos, nomeParaVinculos),
    };
  }, [idPessoaParaVinculos, nomeParaVinculos, listaClientesCodigo]);

  useEffect(() => {
    if (modo !== 'listar') return;
    // Garante índice dentro dos limites quando a lista é filtrada.
    setIndiceAtual((i) => Math.min(i, Math.max(0, listaExibida.length - 1)));
  }, [modo, listaExibida.length]);

  async function localizarPorNumeroPessoa() {
    const n = String(numeroPessoa ?? '').trim();
    if (!n) {
      setError('Digite o número da pessoa.');
      return;
    }
    const id = Number.parseInt(n, 10);
    if (!Number.isFinite(id) || id < 1) {
      setError('Número da pessoa inválido.');
      return;
    }
    setError(null);
    try {
      const c = await buscarCliente(id);
      if (!c) {
        setError(`Nenhuma pessoa encontrada com o número ${id}.`);
        return;
      }
      navigate(`/clientes/editar/${id}`);
    } catch (err) {
      setError(err.message || 'Erro ao localizar.');
    }
  }

  /** Lista leve só para o seletor de responsável (nova/edição), sem abrir o relatório completo. */
  useEffect(() => {
    if (modo !== 'criar' && modo !== 'editar') return;
    if (lista.length > 0) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await listarClientes(false);
        if (!cancelled) {
          setLista(Array.isArray(res) ? res : []);
        }
      } catch {
        if (!cancelled) {
          setLista([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [modo, lista.length]);

  useEffect(() => {
    if (!isRotaListaTodasPessoas || modo !== 'listar') return;
    const now = Date.now();
    if (now - __ultimoAcessoListaPessoas < 1500) return;
    __ultimoAcessoListaPessoas = now;
    const { usuarioNome } = getContextoAuditoriaUsuario();
    registrarAuditoria({
      modulo: 'Pessoas',
      tela: pathPessoasNorm,
      tipoAcao: 'ACESSO_LISTA',
      descricao: `Usuário ${usuarioNome} acessou a lista de cadastros (Pessoas).`,
    });
  }, [isRotaListaTodasPessoas, modo, pathPessoasNorm]);

  useEffect(() => {
    if (modo !== 'listar') {
      ultimoCadastroLogadoRef.current = null;
      return;
    }
    if (loading || !pessoaAtual?.id) return;
    const id = Number(pessoaAtual.id);
    if (!Number.isFinite(id)) return;
    if (ultimoCadastroLogadoRef.current === id) return;
    ultimoCadastroLogadoRef.current = id;
    const { usuarioNome } = getContextoAuditoriaUsuario();
    const nome = String(pessoaAtual.nome ?? '').trim() || `cadastro ${id}`;
    registrarAuditoria({
      modulo: 'Pessoas',
      tela: pathPessoasNorm,
      tipoAcao: 'ACESSO_CADASTRO',
      descricao: `Usuário ${usuarioNome} abriu o cadastro de ${nome} (id ${id}).`,
      registroAfetadoId: String(id),
      registroAfetadoNome: nome,
    });
  }, [loading, modo, pessoaAtual?.id, pessoaAtual?.nome]);

  /** Links antigos com state (pessoaId): passa para a rota de edição. */
  useEffect(() => {
    const s = location.state;
    if (!s || typeof s !== 'object') return;
    const raw = s.pessoaId ?? s.idPessoa;
    if (raw == null || raw === '') return;
    const id = Number.parseInt(String(raw).replace(/\D/g, ''), 10);
    if (!Number.isFinite(id) || id < 1) return;
    navigate(`/clientes/editar/${id}`, { replace: true, state: {} });
  }, [location.state, navigate]);

  useEffect(() => {
    if (modo !== 'listar') return;
    /** Evita esvaziar o formulário no 1º paint quando a URL já é edição (o efeito da rota /clientes/editar/:id preenche em seguida). */
    if (/^\/clientes\/editar\/\d+$/.test(pathPessoasNorm)) return;
    if (!pessoaAtual) {
      setForm(emptyPessoa);
      setEditId(null);
      setNacionalidadeSugestaoNaoValidada(false);
      return;
    }
    setNumeroPessoa(String(pessoaAtual.id ?? ''));
    const nacSalva = String(pessoaAtual.nacionalidade ?? '').trim();
    setForm({
        ...emptyPessoa,
        edicaoDesabilitada: true,
        codigo: String(pessoaAtual.id ?? ''),
        nome: pessoaAtual.nome ?? '',
        genero: '',
        cpf: pessoaAtual.cpf ?? '',
        rg: '',
        orgaoExpedidor: '',
        profissao: '',
        dataNascimento: formatDate(pessoaAtual.dataNascimento) ?? '',
        nacionalidade: nacSalva || NACIONALIDADE_PADRAO_BR,
        estadoCivil: '',
        email: pessoaAtual.email ?? '',
        contato: pessoaAtual.telefone ?? '',
        ativo: pessoaAtual.ativo !== false,
        marcadoMonitoramento: pessoaAtual.marcadoMonitoramento === true,
        responsavelId:
          pessoaAtual.responsavelId != null
            ? Number(pessoaAtual.responsavelId)
            : pessoaAtual.responsavel?.id != null
              ? Number(pessoaAtual.responsavel.id)
              : null,
        responsavel: pessoaAtual.responsavel ?? null,
      });
    setNacionalidadeSugestaoNaoValidada(!nacSalva);
      setEditId(pessoaAtual.id);
      setEnderecos([]);
      setContatos([]);
  }, [modo, indiceAtual, pessoaAtual, pathPessoasNorm]);

  function formatDate(v) {
    if (!v) return '';
    return typeof v === 'string' ? v.split('T')[0] : v;
  }

  async function aplicarFormNovaPessoa() {
    let codigoProximo = '';
    try {
      codigoProximo = await resolverProximoCodigoNovaPessoa();
    } catch {
      codigoProximo = '1';
    }
    setForm({
      ...emptyPessoa,
      codigo: codigoProximo,
      nacionalidade: NACIONALIDADE_PADRAO_BR,
      responsavelId: null,
      responsavel: null,
    });
    setNacionalidadeSugestaoNaoValidada(true);
    setEditId(null);
    setEnderecos([]);
    setContatos([]);
    setModo('criar');
    {
      const { usuarioNome } = getContextoAuditoriaUsuario();
      registrarAuditoria({
        modulo: 'Pessoas',
        tela: '/clientes/nova',
        tipoAcao: 'ACESSO_TELA',
        descricao: `Usuário ${usuarioNome} abriu o formulário de nova pessoa (inclusão).`,
      });
    }
    setError(null);
    setTextoColagemPessoa('');
    setExtracaoAvisos([]);
    setExtracaoResumo('');
    setExtracaoDebug(null);
    setCamposPreenchidosPorTexto({
      nome: false,
      cpf: false,
      rg: false,
      dataNascimento: false,
      nacionalidade: false,
      profissao: false,
      estadoCivil: false,
      email: false,
    });
  }

  const abrirNovo = () => {
    if (modo === 'editar') {
      cancelarForm();
    }
    navigate('/clientes/nova');
  };

  function aplicarEdicaoPessoa(item) {
    setEditId(item.id);
    const nacSalva = String(item.nacionalidade ?? '').trim();
    setForm({
      ...emptyPessoa,
      codigo: String(item.id ?? ''),
      nome: item.nome ?? '',
      genero: item.genero ?? '',
      cpf: item.cpf ?? '',
      rg: item.rg ?? '',
      orgaoExpedidor: item.orgaoExpedidor ?? '',
      profissao: item.profissao ?? '',
      email: item.email ?? '',
      contato: item.telefone ?? '',
      dataNascimento: formatDate(item.dataNascimento) ?? '',
      nacionalidade: nacSalva || NACIONALIDADE_PADRAO_BR,
      estadoCivil: item.estadoCivil ?? '',
      ativo: item.ativo !== false,
      marcadoMonitoramento: item.marcadoMonitoramento === true,
      responsavelId:
        item.responsavelId != null
          ? Number(item.responsavelId)
          : item.responsavel?.id != null
            ? Number(item.responsavel.id)
            : null,
      responsavel: item.responsavel ?? null,
    });
    setNacionalidadeSugestaoNaoValidada(!nacSalva);
    setEnderecos([]);
    setContatos([]);
    setModo('editar');
    {
      const { usuarioNome } = getContextoAuditoriaUsuario();
      const nome = String(item.nome ?? '').trim() || `id ${item.id}`;
      registrarAuditoria({
        modulo: 'Pessoas',
        tela: pathPessoasNorm,
        tipoAcao: 'ACESSO_CADASTRO',
        descricao: `Usuário ${usuarioNome} abriu o cadastro de ${nome} para edição (id ${item.id}).`,
        registroAfetadoId: String(item.id),
        registroAfetadoNome: nome,
      });
    }
    setError(null);
    setTextoColagemPessoa('');
    setExtracaoAvisos([]);
    setExtracaoResumo('');
    setExtracaoDebug(null);
    setCamposPreenchidosPorTexto({
      nome: false,
      cpf: false,
      rg: false,
      dataNascimento: false,
      nacionalidade: false,
      profissao: false,
      estadoCivil: false,
      email: false,
    });
  }

  const cancelarForm = () => {
    setModo('listar');
    setForm(emptyPessoa);
    setNacionalidadeSugestaoNaoValidada(false);
    setEditId(null);
    setError(null);
    if (lista.length) setIndiceAtual(0);
    setTextoColagemPessoa('');
    setExtracaoAvisos([]);
    setExtracaoResumo('');
    setExtracaoDebug(null);
    if (pathPessoasNorm === '/clientes/nova' || /^\/clientes\/editar\/\d+$/.test(pathPessoasNorm)) {
      navigate('/clientes/lista', { replace: true });
    }
  };

  useEffect(() => {
    const p = (location.pathname || '').replace(/\/+$/, '') || '/';
    if (p === '/clientes/nova') {
      if (modo === 'listar') {
        void aplicarFormNovaPessoa();
      }
    } else if (p === '/clientes/lista') {
      if (modo === 'criar' || modo === 'editar') {
        cancelarForm();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sincroniza rota com modo (evita loop com deps de setters)
  }, [location.pathname, modo]);

  useEffect(() => {
    if (isRotaListaTodasPessoas && modo === 'listar') {
      setForm((f) => ({ ...f, edicaoDesabilitada: true }));
    }
  }, [isRotaListaTodasPessoas, modo]);

  useEffect(() => {
    const m = /^\/clientes\/editar\/(\d+)$/.exec(pathPessoasNorm);
    if (!m) return;
    const id = Number(m[1]);
    if (!Number.isFinite(id) || id < 1) return;
    if (modo === 'editar' && Number(editId) === id) return;

    const itemLista = lista.find((p) => Number(p.id) === id);
    if (itemLista) {
      aplicarEdicaoPessoa(itemLista);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setCarregandoFicha(true);
        const c = await buscarCliente(id);
        if (cancelled) return;
        if (!c) {
          setError(`Pessoa nº ${id} não encontrada.`);
          navigate('/clientes/lista', { replace: true });
          return;
        }
        aplicarEdicaoPessoa({
          id: c.id,
          nome: c.nome,
          nacionalidade: c.nacionalidade,
          cpf: c.cpf,
          email: c.email,
          telefone: c.telefone,
          dataNascimento: c.dataNascimento,
          ativo: c.ativo,
          marcadoMonitoramento: c.marcadoMonitoramento,
          responsavelId: c.responsavelId,
          responsavel: c.responsavel,
        });
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Erro ao abrir cadastro.');
        }
      } finally {
        if (!cancelled) setCarregandoFicha(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fluxo da rota de edição
  }, [lista, pathPessoasNorm, modo, editId, navigate]);

  useEffect(() => {
    if (modo !== 'editar' || !editId) return;
    let cancelado = false;
    (async () => {
      try {
        setErroComplementar('');
        const id = editId;
        const compPromise = carregarPessoaComplementar(id);
        const extrasPromise = featureFlags.useApiPessoasComplementares
          ? Promise.all([carregarEnderecosPessoa(id), carregarContatosPessoa(id)])
          : Promise.resolve([null, null]);
        const [comp, ec] = await Promise.all([compPromise, extrasPromise]);
        if (cancelado) return;
        if (comp) {
          setForm((f) => ({
            ...f,
            rg: comp.rg ?? f.rg,
            orgaoExpedidor: comp.orgaoExpedidor ?? f.orgaoExpedidor,
            profissao: comp.profissao ?? f.profissao,
            nacionalidade: comp.nacionalidade ?? f.nacionalidade,
            estadoCivil: comp.estadoCivil ?? f.estadoCivil,
            genero: comp.genero ?? f.genero,
          }));
        }
        if (featureFlags.useApiPessoasComplementares && ec) {
          const [ends, conts] = ec;
          if (ends != null) setEnderecos(enderecosApiParaUi(ends));
          if (conts != null) setContatos(contatosApiParaUi(conts));
        }
      } catch (e) {
        if (!cancelado) {
          setErroComplementar(
            e?.message || 'Erro ao carregar dados complementares, endereços ou contatos.'
          );
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [modo, editId]);

  const inputClassComAutofill = (campo, opts = {}) => {
    const base = opts.flex
      ? 'flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100'
      : 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100';
    return camposPreenchidosPorTexto[campo]
      ? `${base} ring-2 ring-amber-400 border-amber-500/70 bg-amber-50/60`
      : base;
  };

  /** Colagem/extração: basta entrar e sair do campo para considerar o valor revisado (não exige alterar o texto). */
  const marcarAutofillRevisado = useCallback((campo) => {
    setCamposPreenchidosPorTexto((c) => ({ ...c, [campo]: false }));
  }, []);

  const handleClickUploadDocumento = () => {
    if (docProcessando) return;
    if (inputDocRef.current) {
      inputDocRef.current.click();
    }
  };

  const fecharModalContatos = useCallback(() => {
    ignorarProximoFocusContatoRef.current = true;
    setModalContatos(false);
  }, []);

  const abrirModalContatosDesdeContato = useCallback(() => {
    if (form.edicaoDesabilitada) return;
    if (ignorarProximoFocusContatoRef.current) {
      ignorarProximoFocusContatoRef.current = false;
      return;
    }
    setModalContatos(true);
  }, [form.edicaoDesabilitada]);

  const salvar = async () => {
    if (!form.nome?.trim() || !form.cpf?.trim()) {
      setError('Preencha nome e CPF.');
      return;
    }
    const docDigitos = normalizarDigitosCpfCnpj(form.cpf);
    const excluirDupCheck = modo === 'editar' ? editId : null;
    let listaParaDup = lista;
    if (listaParaDup.length === 0) {
      try {
        const fresh = await listarClientes(apenasAtivos);
        listaParaDup = Array.isArray(fresh) ? fresh : [];
      } catch {
        listaParaDup = [];
      }
    }
    const duplicataNaLista = buscarPessoaComMesmoDocumento(listaParaDup, docDigitos, excluirDupCheck);
    if (duplicataNaLista) {
      setError(null);
      setModalCpfDuplicado(duplicataNaLista);
      return;
    }

    const previewDoc = docPreview;
    const modoSalvar = modo;
    const editIdSalvar = editId;
    setSalvando(true);
    setError(null);
    setMensagemSucesso('');
    try {
      const payload = {
        nome: form.nome.trim(),
        email: form.email?.trim() ? form.email.trim() : null,
        cpf: form.cpf.trim().replace(/\D/g, ''),
        telefone: form.contato?.trim() || null,
        dataNascimento: form.dataNascimento || null,
        ativo: form.ativo,
        marcadoMonitoramento: form.marcadoMonitoramento === true,
        responsavelId:
          form.responsavelId != null && form.responsavelId !== ''
            ? Number(form.responsavelId)
            : null,
      };
      let idParaDocumento = null;
      if (modoSalvar === 'criar') {
        const criado = await criarCliente(payload);
        idParaDocumento =
          criado && (criado.id != null || criado.Id != null)
            ? Number(criado.id ?? criado.Id)
            : null;
      } else {
        await atualizarCliente(editIdSalvar, payload);
        idParaDocumento = Number(editIdSalvar);
      }
      if (idParaDocumento && Number.isFinite(Number(idParaDocumento))) {
        await salvarPessoaComplementar(idParaDocumento, {
          rg: form.rg,
          orgaoExpedidor: form.orgaoExpedidor,
          profissao: form.profissao,
          nacionalidade: form.nacionalidade,
          estadoCivil: form.estadoCivil,
          genero: form.genero,
        });
        if (featureFlags.useApiPessoasComplementares) {
          const { usuarioNome } = getContextoAuditoriaUsuario();
          await salvarEnderecosPessoa(idParaDocumento, enderecos);
          await salvarContatosPessoa(idParaDocumento, contatos, usuarioNome);
        }
      }
      if (previewDoc?.file && idParaDocumento && Number.isFinite(idParaDocumento)) {
        try {
          await salvarDocumentoPessoa(idParaDocumento, previewDoc.file, {
            dadosExtraidos: previewDoc.dados,
          });
          setPessoasComDocumento(listarPessoasComDocumento());
        } catch {
          setDocStatus({
            kind: 'error',
            message:
              'Pessoa salva, mas houve falha ao armazenar o documento localmente (navegador ou limite de espaço).',
          });
        }
      }
      setDocPreview(null);
      cancelarForm();
    } catch (err) {
      const msg = String(err.message || '');
      const pareceDuplicataCpf =
        /cpf/i.test(msg) && (/já existe|ja existe|duplic/i.test(msg) || /cadastro com o CPF/i.test(msg));
      if (pareceDuplicataCpf) {
        try {
          const fresh = await listarClientes(apenasAtivos);
          const arr = Array.isArray(fresh) ? fresh : [];
          const dup = buscarPessoaComMesmoDocumento(
            arr,
            docDigitos,
            modoSalvar === 'editar' ? editIdSalvar : null
          );
          if (dup) {
            setLista(arr);
            setModalCpfDuplicado(dup);
            return;
          }
        } catch {
          /* segue para mensagem genérica */
        }
      }
      setError(err.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  function confirmarAbrirCadastroPessoaExistente() {
    if (!modalCpfDuplicado) return;
    const item = { ...modalCpfDuplicado };
    setModalCpfDuplicado(null);
    setLista((prev) => {
      const id = Number(item.id);
      if (!Number.isFinite(id)) return prev;
      if (prev.some((p) => Number(p.id) === id)) return prev;
      return [...prev, item];
    });
    aplicarEdicaoPessoa(item);
    navigate(`/clientes/editar/${item.id}`, { replace: true });
  }

  function cancelarModalCpfDuplicado() {
    setModalCpfDuplicado(null);
  }

  const alternarMonitoramentoPessoaAtual = async () => {
    const id = Number(modo === 'editar' && editId != null ? editId : pessoaAtual?.id);
    if (!Number.isFinite(id) || id < 1) return;
    const proximoStatus = !form.marcadoMonitoramento;
    setSalvando(true);
    setError(null);
    try {
      const atual = await buscarCliente(id);
      if (!atual) {
        setError('Não foi possível carregar os dados da pessoa no servidor.');
        return;
      }
      const payload = {
        nome: String(atual.nome ?? '').trim(),
        email: String(atual.email ?? '').trim(),
        cpf: String(atual.cpf ?? '').replace(/\D/g, ''),
        telefone: atual.telefone?.trim() || null,
        dataNascimento: dataNascimentoParaPayloadApi(atual.dataNascimento),
        ativo: atual.ativo !== false,
        marcadoMonitoramento: proximoStatus,
        responsavelId:
          atual.responsavelId != null && atual.responsavelId !== ''
            ? Number(atual.responsavelId)
            : null,
      };
      const updated = await atualizarCliente(id, payload);
      const marcado = Boolean(updated?.marcadoMonitoramento ?? proximoStatus);
      setForm((f) => ({ ...f, marcadoMonitoramento: marcado }));
    } catch (err) {
      setError(err.message || 'Erro ao atualizar monitoramento.');
    } finally {
      setSalvando(false);
    }
  };

  const contagemContatos = {
    telefone: (contatos || []).filter((c) => c.tipo === 'telefone').length,
    email: (contatos || []).filter((c) => c.tipo === 'email').length,
    website: (contatos || []).filter((c) => c.tipo === 'website').length,
  };
  const totalContatos = contagemContatos.telefone + contagemContatos.email + contagemContatos.website;

  /** Em listagem: só mostra o formulário completo se "Edição desabilitada" estiver desmarcada (exceto em /clientes/lista, onde edição é só na rota /clientes/editar/:id). */
  const mostrarFormularioEdicao =
    modo === 'criar' ||
    modo === 'editar' ||
    (modo === 'listar' && !form.edicaoDesabilitada && !isRotaListaTodasPessoas);

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/35 to-emerald-50/45 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d]">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <header className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Cadastro de Pessoas</h1>
              <p className="text-slate-600 mt-1">Gerencie dados pessoais, endereços e contatos</p>
              {mensagemSucesso ? (
                <p className="text-emerald-700 text-sm mt-2 font-medium">{mensagemSucesso}</p>
              ) : null}
              {erroComplementar ? (
                <p className="text-red-700 text-sm mt-2">{erroComplementar}</p>
              ) : null}
            </div>
            {isRotaListaTodasPessoas && modo === 'listar' && (
              <div className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm text-sm text-slate-600 max-w-md">
                Totais e tabela com <strong className="text-slate-800">todas as pessoas</strong> ficam no menu{' '}
                <span className="font-medium text-blue-700">Relatório de pessoas</span>.
              </div>
            )}
          </div>
        </header>

        {isRotaListaTodasPessoas && modo === 'listar' && (
          <section className="bg-white rounded-xl shadow-sm border border-slate-200/80 p-4 mb-6">
            <div className="flex flex-wrap items-end gap-4">
              <div className="flex flex-wrap items-end gap-2 border-r border-slate-200 pr-4 mr-1">
                <div>
                  <label htmlFor="numero-pessoa-busca" className="block text-sm font-medium text-slate-700 mb-1">
                    Número da pessoa
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="numero-pessoa-busca"
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={numeroPessoa}
                      onChange={(e) => setNumeroPessoa(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          localizarPorNumeroPessoa();
                        }
                      }}
                      placeholder="Ex.: 2374"
                      className="w-28 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      type="button"
                      onClick={localizarPorNumeroPessoa}
                      disabled={carregandoFicha}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 disabled:opacity-50 focus:ring-2 focus:ring-slate-500 focus:ring-offset-1"
                    >
                      <Search className="w-4 h-4" />
                      Localizar
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">Abre a ficha pelo código (sem carregar o relatório completo).</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 ml-auto">
                <button
                  type="button"
                  onClick={() => navigate('/clientes/relatorio')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50"
                >
                  <FileText className="w-4 h-4" />
                  Relatório de pessoas
                </button>
                <button
                  type="button"
                  onClick={abrirNovo}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                >
                  <Plus className="w-4 h-4" />
                  Nova pessoa
                </button>
              </div>
            </div>
          </section>
        )}

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {carregandoFicha && /^\/clientes\/editar\/\d+$/.test(pathPessoasNorm) && (
          <p className="mb-4 text-sm text-slate-600">Carregando ficha…</p>
        )}

        {/* Painel principal */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="p-6">
            {mostrarFormularioEdicao ? (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold text-slate-800">
                    {modo === 'criar' ? 'Nova pessoa' : 'Editar pessoa'}
                  </h2>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleClickUploadDocumento}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                        disabled={docProcessando}
                      >
                        <FileUp className="w-4 h-4" />
                        Anexar documento pessoal
                      </button>
                      <input
                        ref={inputDocRef}
                        id="upload-doc-pessoal"
                        type="file"
                        accept="application/pdf,image/jpeg,image/png,image/webp"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files && e.target.files[0];
                          e.target.value = '';
                          if (!file) return;
                          try {
                            setDocErroDetalhe('');
                            setDocStatus({ kind: 'info', message: 'Lendo documento (OCR + análise)...' });
                            setDocProcessando(true);
                            const resultado = await analisarDocumentoPessoa(file);
                            setDocPreview({
                              file,
                              texto: resultado.textoExtraidoBruto,
                              dados: {
                                nomeCompleto: resultado.nomeCompleto,
                                cpf: resultado.cpf,
                                dataNascimento: resultado.dataNascimento,
                                rg: resultado.rg,
                                tipoDocumentoDetectado: resultado.tipoDocumentoDetectado,
                                confiancaPorCampo: resultado.confiancaPorCampo,
                              },
                            });
                            const atual = {};
                            if (resultado.nomeCompleto) atual.nome = resultado.nomeCompleto;
                            if (resultado.cpf) atual.cpf = resultado.cpf;
                            if (resultado.dataNascimento) atual.dataNascimento = resultado.dataNascimento;
                            setForm((f) => ({
                              ...f,
                              ...(atual.nome ? { nome: atual.nome } : {}),
                              ...(atual.cpf ? { cpf: atual.cpf } : {}),
                              ...(atual.dataNascimento ? { dataNascimento: atual.dataNascimento } : {}),
                            }));
                            const msgBase = resultado.sucesso
                              ? 'Leitura concluída com sucesso. Revise os dados preenchidos.'
                              : 'Leitura concluída parcialmente. Revise e complete os dados.';
                            const msgAvisos = resultado.avisos.length
                              ? ` Avisos: ${resultado.avisos.join(' | ')}`
                              : '';
                            setDocStatus({
                              kind: resultado.sucesso ? 'success' : 'error',
                              message: `${msgBase}${msgAvisos}`,
                            });
                          } catch (err) {
                            const mensagem = err?.message || String(err);
                            const detalhe = err?.stack || mensagem;
                            console.error('Erro ao processar documento pessoal (OCR):', err);
                            setDocErroDetalhe(detalhe);
                            setDocStatus({
                              kind: 'error',
                              message: mensagem,
                            });
                            setDocPreview(null);
                            window.alert(
                              `Falha ao processar o documento pessoal.\n\nMensagem: ${mensagem}\n\nAbra o Console (F12 → aba Console), copie o erro completo em vermelho e envie para o suporte/cursor.`
                            );
                          } finally {
                            setDocProcessando(false);
                          }
                        }}
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.edicaoDesabilitada}
                        onChange={(e) => setForm((f) => ({ ...f, edicaoDesabilitada: e.target.checked }))}
                        className="rounded border-slate-300 text-blue-600"
                      />
                      Edição desabilitada
                    </label>
                  </div>
                </div>
                {docPreview && (
                  <div className="mb-4 p-4 rounded-lg border border-emerald-200 bg-emerald-50 text-sm text-emerald-900">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div>
                        <p className="font-semibold flex items-center gap-1.5">
                          <FileCheck2 className="w-4 h-4" />
                          Dados sugeridos pelo OCR
                        </p>
                        <p className="text-xs text-emerald-800 mt-0.5">
                          Revise os campos abaixo. Você pode editar manualmente antes de salvar.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-emerald-900/80 hover:underline"
                        onClick={() => setDocPreview(null)}
                      >
                        Fechar
                      </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                      <div>
                        <span className="font-medium">Nome:</span>{' '}
                        <span>{docPreview.dados?.nomeCompleto || '—'}</span>
                      </div>
                      <div>
                        <span className="font-medium">CPF:</span>{' '}
                        <span>{docPreview.dados?.cpf || '—'}</span>
                      </div>
                      <div>
                        <span className="font-medium">Data nasc.:</span>{' '}
                        <span>{docPreview.dados?.dataNascimento || '—'}</span>
                      </div>
                      <div>
                        <span className="font-medium">RG:</span>{' '}
                        <span>{docPreview.dados?.rg || '—'}</span>
                      </div>
                      <div>
                        <span className="font-medium">Tipo doc.:</span>{' '}
                        <span>{docPreview.dados?.tipoDocumentoDetectado || '—'}</span>
                      </div>
                    </div>
                  </div>
                )}

                {docStatus.kind !== 'idle' && (
                  <div
                    className={`mb-4 text-xs px-3 py-2 rounded-lg border ${
                      docStatus.kind === 'error'
                        ? 'bg-red-50 border-red-200 text-red-700'
                        : docStatus.kind === 'success'
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}
                  >
                    <span>{docStatus.message}</span>
                    {docStatus.kind === 'error' && docErroDetalhe && (
                      <>
                        <button
                          type="button"
                          className="ml-2 underline text-[11px]"
                          onClick={() => {
                            window.alert(`Detalhes técnicos do erro:\n\n${docErroDetalhe}`);
                          }}
                        >
                          Ver detalhes
                        </button>
                      </>
                    )}
                  </div>
                )}

                <div className="mb-6 p-4 rounded-xl border border-indigo-200 bg-indigo-50/40">
                  <div className="flex items-center gap-2 mb-2">
                    <ClipboardPaste className="w-5 h-5 text-indigo-600 shrink-0" />
                    <h3 className="text-sm font-semibold text-indigo-900">
                      Colar dados para preenchimento automático
                    </h3>
                  </div>
                  <p className="text-xs text-indigo-800/90 mb-2">
                    Cole trechos de cadastro, qualificação de partes ou contratos. O sistema tenta extrair
                    nome, CPF, RG, data de nascimento, nacionalidade, estado civil e profissão.
                  </p>
                  <textarea
                    value={textoColagemPessoa}
                    onChange={(e) => setTextoColagemPessoa(e.target.value)}
                    disabled={form.edicaoDesabilitada}
                    rows={5}
                    placeholder="Ex.: Nome completo: ... CPF: ... ou texto jurídico corrido."
                    className="w-full px-3 py-2 border border-indigo-200 rounded-lg text-sm bg-white text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 disabled:bg-slate-100 resize-y min-h-[100px]"
                  />
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleExtrairDadosTextoLivre}
                      disabled={form.edicaoDesabilitada || extracaoProcessando}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {extracaoProcessando ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <ClipboardPaste className="w-4 h-4" />
                      )}
                      Extrair dados
                    </button>
                    <button
                      type="button"
                      onClick={limparTextoColagem}
                      disabled={form.edicaoDesabilitada}
                      className="px-3 py-2 rounded-lg border border-indigo-300 bg-white text-indigo-800 text-sm hover:bg-indigo-50 disabled:opacity-50"
                    >
                      Limpar texto
                    </button>
                    <label className="flex items-center gap-2 text-xs text-indigo-900 cursor-pointer ml-1">
                      <input
                        type="checkbox"
                        checked={modoDebugExtracao}
                        onChange={(e) => setModoDebugExtracao(e.target.checked)}
                        className="rounded border-indigo-300 text-indigo-600"
                      />
                      Modo debug (candidatos e texto normalizado)
                    </label>
                  </div>
                  {extracaoResumo && (
                    <p className="mt-2 text-sm text-emerald-800 font-medium">{extracaoResumo}</p>
                  )}
                  {extracaoAvisos.length > 0 && (
                    <ul className="mt-2 text-xs text-slate-600 list-disc list-inside space-y-0.5">
                      {extracaoAvisos.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  )}
                  {modoDebugExtracao && extracaoDebug && (
                    <details className="mt-3 text-xs border border-indigo-100 rounded-lg p-2 bg-white max-h-64 overflow-auto">
                      <summary className="cursor-pointer font-medium text-indigo-800">Debug extração</summary>
                      <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-slate-700">
                        {JSON.stringify(
                          {
                            normalizado: extracaoDebug.normalizado?.slice(0, 2000),
                            candidatos: extracaoDebug.candidatos,
                          },
                          null,
                          2
                        )}
                      </pre>
                    </details>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Código</label>
                      <input
                        type="text"
                        value={form.codigo}
                        readOnly
                        className="w-full px-3 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-600 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nome *</label>
                      <input
                        type="text"
                        value={form.nome}
                        onChange={(e) => {
                          setCamposPreenchidosPorTexto((c) => ({ ...c, nome: false }));
                          setForm((f) => ({ ...f, nome: e.target.value }));
                        }}
                        onBlur={() => marcarAutofillRevisado('nome')}
                        disabled={form.edicaoDesabilitada}
                        placeholder="Nome completo"
                        className={inputClassComAutofill('nome')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Gênero</label>
                      <select
                        value={form.genero}
                        onChange={(e) => setForm((f) => ({ ...f, genero: e.target.value }))}
                        disabled={form.edicaoDesabilitada}
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
                      >
                        {GENEROS.map((g) => (
                          <option key={g.value} value={g.value}>{g.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">CPF *</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={form.cpf}
                          onChange={(e) => {
                            setCamposPreenchidosPorTexto((c) => ({ ...c, cpf: false }));
                            setForm((f) => ({ ...f, cpf: e.target.value }));
                          }}
                          onBlur={() => marcarAutofillRevisado('cpf')}
                          disabled={form.edicaoDesabilitada}
                          placeholder="000.000.000-00"
                          className={`flex-1 ${inputClassComAutofill('cpf')}`}
                        />
                        <button
                          type="button"
                          onClick={handleClickUploadDocumento}
                          disabled={docProcessando}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-emerald-500 bg-emerald-50 text-emerald-800 text-xs font-medium hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <FileUp className="w-3 h-3" />
                          Doc. pessoal
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                      >
                        Adm. PJ
                      </button>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">RG</label>
                      <input
                        type="text"
                        value={form.rg}
                        onChange={(e) => {
                          setCamposPreenchidosPorTexto((c) => ({ ...c, rg: false }));
                          setForm((f) => ({ ...f, rg: e.target.value }));
                        }}
                        onBlur={() => marcarAutofillRevisado('rg')}
                        disabled={form.edicaoDesabilitada}
                        className={inputClassComAutofill('rg')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Órgão expedidor</label>
                      <input
                        type="text"
                        value={form.orgaoExpedidor}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            orgaoExpedidor: e.target.value.toLocaleUpperCase('pt-BR'),
                          }))
                        }
                        disabled={form.edicaoDesabilitada}
                        placeholder="Ex: SSP-SP"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Contato</label>
                      <input
                        type="text"
                        value={form.contato}
                        onChange={(e) => setForm((f) => ({ ...f, contato: e.target.value }))}
                        onFocus={abrirModalContatosDesdeContato}
                        disabled={form.edicaoDesabilitada}
                        placeholder="Telefone"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
                      />
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Profissão</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={form.profissao}
                          onChange={(e) => {
                            setCamposPreenchidosPorTexto((c) => ({ ...c, profissao: false }));
                            setForm((f) => ({ ...f, profissao: e.target.value }));
                          }}
                          onBlur={() => marcarAutofillRevisado('profissao')}
                          disabled={form.edicaoDesabilitada}
                          placeholder="Profissão"
                          className={inputClassComAutofill('profissao', { flex: true })}
                        />
                        <button
                          type="button"
                          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 whitespace-nowrap"
                          onClick={() => {
                            const texto = esbocoQualificacaoComResponsavel({ nome: form.nome }, form.responsavel);
                            const { usuarioNome } = getContextoAuditoriaUsuario();
                            const nome = String(form.nome ?? '').trim() || 'cadastro sem nome';
                            registrarAuditoria({
                              modulo: 'Pessoas',
                              tela: pathPessoasNorm,
                              tipoAcao: 'DOCUMENTO',
                              descricao: `Usuário ${usuarioNome} gerou qualificação contratual de ${nome}.`,
                              registroAfetadoId: editId != null ? String(editId) : null,
                              registroAfetadoNome: nome,
                            });
                            if (navigator.clipboard?.writeText) {
                              navigator.clipboard.writeText(texto).catch(() => {});
                            }
                          }}
                        >
                          Qualificação
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Data de nascimento</label>
                      <input
                        type="text"
                        inputMode="text"
                        placeholder="aaaa-mm-dd ou hj"
                        value={form.dataNascimento}
                        onChange={(e) => {
                          setCamposPreenchidosPorTexto((c) => ({ ...c, dataNascimento: false }));
                          const v = e.target.value;
                          const r = resolverAliasHojeEmTexto(v, 'iso');
                          setForm((f) => ({ ...f, dataNascimento: r ?? v }));
                        }}
                        onBlur={() => marcarAutofillRevisado('dataNascimento')}
                        disabled={form.edicaoDesabilitada}
                        className={inputClassComAutofill('dataNascimento')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nacionalidade</label>
                      <input
                        type="text"
                        value={form.nacionalidade}
                        onChange={(e) => {
                          setCamposPreenchidosPorTexto((c) => ({ ...c, nacionalidade: false }));
                          setForm((f) => ({ ...f, nacionalidade: e.target.value }));
                        }}
                        onBlur={() => {
                          setNacionalidadeSugestaoNaoValidada(false);
                          marcarAutofillRevisado('nacionalidade');
                        }}
                        disabled={form.edicaoDesabilitada}
                        placeholder="Ex: Brasileira"
                        title={
                          nacionalidadeSugestaoNaoValidada && !form.edicaoDesabilitada
                            ? 'Sugestão padrão (brasileira). Entre e saia do campo para confirmar ou altere se for outra nacionalidade.'
                            : undefined
                        }
                        className={`${inputClassComAutofill('nacionalidade')}${
                          nacionalidadeSugestaoNaoValidada && !form.edicaoDesabilitada
                            ? ' !text-red-600 !border-red-400 !ring-2 !ring-red-200'
                            : ''
                        }`}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Estado civil</label>
                      <select
                        value={form.estadoCivil}
                        onChange={(e) => {
                          setCamposPreenchidosPorTexto((c) => ({ ...c, estadoCivil: false }));
                          setForm((f) => ({ ...f, estadoCivil: e.target.value }));
                        }}
                        onBlur={() => marcarAutofillRevisado('estadoCivil')}
                        disabled={form.edicaoDesabilitada}
                        className={inputClassComAutofill('estadoCivil')}
                      >
                        {ESTADOS_CIVIS.map((e) => (
                          <option key={e.value} value={e.value}>{e.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">E-mail</label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => {
                            setCamposPreenchidosPorTexto((c) => ({ ...c, email: false }));
                            setForm((f) => ({ ...f, email: e.target.value }));
                          }}
                          onBlur={() => marcarAutofillRevisado('email')}
                          disabled={form.edicaoDesabilitada}
                          placeholder="email@exemplo.com"
                          className={inputClassComAutofill('email', { flex: true })}
                        />
                        <button
                          type="button"
                          onClick={() => setModalEnderecos(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                          <MapPin className="w-4 h-4" />
                          Endereços
                        </button>
                      </div>
                    </div>
                    <div className="flex items-start gap-2 pt-1">
                      <input
                        type="checkbox"
                        id="marcadoMonitoramento"
                        checked={!!form.marcadoMonitoramento}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setForm((f) => ({ ...f, marcadoMonitoramento: checked }));
                        }}
                        disabled={form.edicaoDesabilitada}
                        className="mt-1 rounded border-slate-300 text-blue-600"
                      />
                      <label
                        htmlFor="marcadoMonitoramento"
                        className="text-sm text-slate-700 cursor-pointer leading-snug"
                      >
                        Incluir em <strong>Monitoramento de Pessoas</strong> (DataJud/CNJ). Configure
                        frequência e chaves em Processos → Monitoramento.
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Contatos</label>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => setModalContatos(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                          <Phone className="w-4 h-4" />
                          Abrir contatos
                        </button>
                        {totalContatos > 0 && (
                          <span className="text-xs text-slate-500">
                            {contagemContatos.telefone} tel. · {contagemContatos.email} e-mail · {contagemContatos.website} site{totalContatos !== 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {!form.edicaoDesabilitada && (
                  <div className="mt-6 space-y-3">
                    <SeletorResponsavelPessoa
                      pessoas={lista}
                      valueId={form.responsavelId}
                      onChange={(id, snap) =>
                        setForm((f) => ({ ...f, responsavelId: id, responsavel: snap }))
                      }
                      excluirId={editId}
                      disabled={form.edicaoDesabilitada}
                    />
                    {form.responsavel && String(form.nome ?? '').trim() ? (
                      <p className="text-xs text-slate-600 border border-dashed border-slate-200 rounded-lg p-3 bg-slate-50/90 leading-relaxed">
                        <span className="font-medium text-slate-700">Esboço para documentos: </span>
                        {esbocoQualificacaoComResponsavel({ nome: form.nome }, form.responsavel)}
                      </p>
                    ) : null}
                  </div>
                )}

                <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => salvar()}
                    disabled={salvando}
                    className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    {salvando ? 'Salvando...' : 'Salvar'}
                  </button>
                  {modo === 'editar' && editId != null && (
                    <button
                      type="button"
                      onClick={alternarMonitoramentoPessoaAtual}
                      disabled={salvando || form.edicaoDesabilitada}
                      className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm border ${
                        form.marcadoMonitoramento
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
                      } disabled:opacity-50`}
                    >
                      {form.marcadoMonitoramento ? 'Parar monitoramento' : 'Iniciar monitoramento'}
                    </button>
                  )}
                  {modo === 'editar' && editId != null && (
                    <button
                      type="button"
                      onClick={() => setModalVinculosSistema(true)}
                      disabled={salvando}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50"
                    >
                      <Link2 className="w-4 h-4" />
                      Vínculos no sistema
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={cancelarForm}
                    disabled={salvando}
                    className="px-5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-medium text-sm hover:bg-slate-50"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-lg font-semibold text-slate-800 mb-2">Início</h2>
                <p className="text-slate-600 text-sm mb-4">
                  Para ver a tabela com todas as pessoas, use o menu <strong>Relatório de pessoas</strong>. Você pode
                  localizar uma ficha pelo número acima ou criar uma nova pessoa.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/clientes/relatorio')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50"
                >
                  <FileText className="w-4 h-4" />
                  Abrir relatório de pessoas
                </button>
              </>
            )}
          </div>

          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
            >
              Fechar
            </button>
          </div>
        </section>
      </div>

      <ModalEnderecos
        open={modalEnderecos}
        onClose={() => setModalEnderecos(false)}
        nomePessoa={form.nome}
        codigoPessoa={form.codigo}
        enderecos={enderecos}
        onChange={setEnderecos}
        sugestaoEndereco={extracaoEndereco}
      />
      <ModalContatos
        open={modalContatos}
        onClose={fecharModalContatos}
        contatos={contatos}
        onChange={setContatos}
      />

      {modalCpfDuplicado && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/40"
          role="presentation"
          onClick={cancelarModalCpfDuplicado}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-cpf-dup-titulo"
            className="bg-white rounded-xl shadow-xl border border-amber-200 max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="modal-cpf-dup-titulo" className="text-lg font-semibold text-slate-800">
              CPF já cadastrado
            </h2>
            <p className="text-sm text-slate-600 mt-3">
              Já existe uma pessoa com este CPF no cadastro:{' '}
              <span className="font-medium text-slate-800">
                {modalCpfDuplicado.nome || '—'} (código {modalCpfDuplicado.id})
              </span>
              . Deseja abrir o cadastro dessa pessoa?
            </p>
            <div className="flex flex-wrap justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={cancelarModalCpfDuplicado}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
              >
                Não, continuar aqui
              </button>
              <button
                type="button"
                onClick={confirmarAbrirCadastroPessoaExistente}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
              >
                Sim, abrir cadastro
              </button>
            </div>
          </div>
        </div>
      )}

      {modalVinculosSistema && idPessoaParaVinculos != null && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40"
          role="presentation"
          onClick={() => setModalVinculosSistema(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-vinculos-titulo"
            className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <h2 id="modal-vinculos-titulo" className="text-lg font-semibold text-slate-800">
                  Vínculos no sistema
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Pessoa nº <span className="font-semibold text-slate-800">{idPessoaParaVinculos}</span>
                  {nomeParaVinculos ? (
                    <>
                      {' '}
                      — <span className="font-medium">{nomeParaVinculos}</span>
                    </>
                  ) : null}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Códigos de cliente vêm da API de clientes; processos do histórico local e da API quando ativa.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalVinculosSistema(false)}
                className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Códigos de cliente</h3>
                {vinculosClienteProc.codigosCliente.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum código de cliente vinculado a esta pessoa no cadastro.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {vinculosClienteProc.codigosCliente.map((cod) => (
                      <li key={cod}>
                        <button
                          type="button"
                          onClick={() => {
                            setModalVinculosSistema(false);
                            navigate('/pessoas', { state: buildRouterStateChaveClienteProcesso(padCliente8Nav(cod), '') });
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-sm font-medium hover:bg-blue-100"
                        >
                          {padCliente8Nav(cod)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Processos (parte cliente / oposta)</h3>
                {vinculosClienteProc.processos.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhum processo encontrado com esta pessoa nas partes vinculadas ou nos nomes.
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Cod. cliente</th>
                          <th className="text-left px-3 py-2 font-medium">Proc.</th>
                          <th className="text-left px-3 py-2 font-medium">Papéis</th>
                          <th className="text-right px-3 py-2 font-medium">Abrir</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {vinculosClienteProc.processos.map((row, idx) => (
                          <tr key={`${row.codCliente}-${row.proc}-${idx}`} className="hover:bg-slate-50/80">
                            <td className="px-3 py-2 text-slate-700">{row.codCliente}</td>
                            <td className="px-3 py-2 text-slate-700">{row.proc}</td>
                            <td className="px-3 py-2 text-slate-600">{row.papeis}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setModalVinculosSistema(false);
                                  navigate('/processos', {
                                    state: buildRouterStateChaveClienteProcesso(
                                      padCliente8Nav(row.codCliente),
                                      row.proc ?? ''
                                    ),
                                  });
                                }}
                                className="text-blue-600 hover:underline text-sm font-medium"
                              >
                                Processos
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CampoReadOnly({ label, value }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-500 mb-0.5">{label}</label>
      <p className="text-slate-800 text-sm">{value || '—'}</p>
    </div>
  );
}

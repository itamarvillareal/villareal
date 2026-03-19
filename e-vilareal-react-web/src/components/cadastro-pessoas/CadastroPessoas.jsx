import { useState, useEffect, useRef } from 'react';
import {
  ChevronUp,
  ChevronDown,
  FileText,
  MapPin,
  Phone,
  Plus,
  Pencil,
  Search,
  Trash2,
  FileUp,
  FileCheck2,
  ClipboardPaste,
  Loader2,
} from 'lucide-react';
import {
  listarClientes,
  criarCliente,
  atualizarCliente,
  excluirCliente,
} from '../../api/clientesService';
import { getCadastroPessoasMock } from '../../data/cadastroPessoasMock.js';
import { analisarDocumentoPessoa } from '../../services/personAutoFillService.js';
import {
  listarPessoasComDocumento,
  obterDocumentoPessoa,
  salvarDocumentoPessoa,
  criarUrlParaDocumento,
} from '../../services/pessoaDocumentoService.js';
import { ModalEnderecos } from './ModalEnderecos';
import { ModalContatos } from './ModalContatos';
import { extrairDadosDeTextoLivre } from '../../services/personTextAutofillService.js';
import { validateCPF } from '../../services/cpfValidatorService.js';

const FORCA_MOCK_CADASTRO =
  import.meta.env.VITE_USE_MOCK_CADASTRO_PESSOAS === 'true';

const CRITERIOS_BUSCA = [
  { value: 'nome', label: 'Nome' },
  { value: 'codigo', label: 'Código' },
  { value: 'cpf', label: 'CPF/CNPJ' },
];

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
  edicaoDesabilitada: false,
};

export function CadastroPessoas() {
  const [lista, setLista] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apenasAtivos, setApenasAtivos] = useState(false);
  const [indiceAtual, setIndiceAtual] = useState(0);
  const [modo, setModo] = useState('listar'); // listar | criar | editar
  const [form, setForm] = useState(emptyPessoa);
  const [editId, setEditId] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [enderecos, setEnderecos] = useState([]);
  const [contatos, setContatos] = useState([]);
  const [modalEnderecos, setModalEnderecos] = useState(false);
  const [modalContatos, setModalContatos] = useState(false);
  const [criterioBusca, setCriterioBusca] = useState('nome');
  const [valorBusca, setValorBusca] = useState('');
  const [valorBuscaCpf, setValorBuscaCpf] = useState('');
  const [numeroPessoa, setNumeroPessoa] = useState('');
  const [listaEhMock, setListaEhMock] = useState(FORCA_MOCK_CADASTRO);
  const [pessoasComDocumento, setPessoasComDocumento] = useState([]);
  const [docPreview, setDocPreview] = useState(null);
  const [docStatus, setDocStatus] = useState({ kind: 'idle', message: '' });
  const [docProcessando, setDocProcessando] = useState(false);
  const [docErroDetalhe, setDocErroDetalhe] = useState('');
  const inputDocRef = useRef(null);
  const [textoColagemPessoa, setTextoColagemPessoa] = useState('');
  const [extracaoAvisos, setExtracaoAvisos] = useState([]);
  const [extracaoResumo, setExtracaoResumo] = useState('');
  const [extracaoDebug, setExtracaoDebug] = useState(null);
  const [extracaoEndereco, setExtracaoEndereco] = useState(null);
  const [modoDebugExtracao, setModoDebugExtracao] = useState(false);
  const [extracaoProcessando, setExtracaoProcessando] = useState(false);
  const [camposPreenchidosPorTexto, setCamposPreenchidosPorTexto] = useState({
    nome: false,
    cpf: false,
    rg: false,
    dataNascimento: false,
    nacionalidade: false,
    profissao: false,
    estadoCivil: false,
  });

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
          });
          setExtracaoEndereco(null);
          return;
        }
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
        }));

        if (r.endereco && (r.endereco.rua || r.endereco.cep || r.endereco.cidade)) {
          const sugerido = {
            numero: (Array.isArray(enderecos) ? enderecos.length : 0) + 1,
            rua: String(r.endereco.rua || '').trim(),
            bairro: String(r.endereco.bairro || '').trim(),
            estado: String(r.endereco.estado || '').trim(),
            cidade: String(r.endereco.cidade || '').trim(),
            cep: String(r.endereco.cep || '').replace(/\D/g, '').slice(0, 8),
            autoPreenchido: true,
          };
          const chaveSug = `${sugerido.rua}|${sugerido.bairro}|${sugerido.cidade}|${sugerido.estado}|${sugerido.cep}`
            .toUpperCase()
            .replace(/\s+/g, ' ')
            .trim();
          const listaAtual = Array.isArray(enderecos) ? enderecos : [];
          const jaExiste = listaAtual.some((e) => {
            const chave = `${e.rua || ''}|${e.bairro || ''}|${e.cidade || ''}|${e.estado || ''}|${e.cep || ''}`
              .toUpperCase()
              .replace(/\s+/g, ' ')
              .trim();
            return chave && chave === chaveSug;
          });
          if (!jaExiste && (sugerido.rua || sugerido.cep)) setEnderecos([...listaAtual, sugerido]);
        }
        const ok = [];
        if (r.nomeCompleto) ok.push('nome');
        if (cpfSeguro) ok.push('CPF');
        if (r.rg) ok.push('RG');
        if (r.dataNascimento) ok.push('data de nascimento');
        if (r.nacionalidade) ok.push('nacionalidade');
        if (r.profissao) ok.push('profissão');
        if (r.estadoCivil) ok.push('estado civil');
        if (r.endereco && (r.endereco.rua || r.endereco.cep || r.endereco.cidade)) ok.push('endereço');
        setExtracaoResumo(
          ok.length
            ? `Campos preenchidos automaticamente: ${ok.join(', ')}. Revise antes de salvar.`
            : ''
        );
      } finally {
        setExtracaoProcessando(false);
      }
    }, 80);
  }

  useEffect(() => {
    setPessoasComDocumento(listarPessoasComDocumento());
  }, []);

  const filtrarLista = () => {
    if (!valorBusca.trim() && !valorBuscaCpf.trim()) return lista;
    const v = valorBusca.trim().toLowerCase();
    const vCpf = valorBuscaCpf.trim().replace(/\D/g, '');
    return lista.filter((p) => {
      if (v && criterioBusca === 'nome' && !(p.nome || '').toLowerCase().includes(v)) return false;
      if (v && criterioBusca === 'codigo' && String(p.id) !== v) return false;
      if (vCpf && !(p.cpf || '').replace(/\D/g, '').includes(vCpf)) return false;
      return true;
    });
  };

  const listaFiltrada = filtrarLista();
  const listaExibida = listaFiltrada;
  const pessoaAtual = listaExibida[indiceAtual];

  useEffect(() => {
    if (modo !== 'listar') return;
    // Ao alterar critério/termo, vamos para o primeiro resultado para o usuário ver match imediato.
    if (valorBusca.trim() || valorBuscaCpf.trim()) setIndiceAtual(0);
  }, [modo, criterioBusca, valorBusca, valorBuscaCpf]);

  useEffect(() => {
    if (modo !== 'listar') return;
    // Garante índice dentro dos limites quando a lista é filtrada.
    setIndiceAtual((i) => Math.min(i, Math.max(0, listaExibida.length - 1)));
  }, [modo, listaExibida.length]);

  function localizarPorNumeroPessoa() {
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
    const idx = lista.findIndex((p) => Number(p.id) === id);
    if (idx === -1) {
      setError(`Nenhuma pessoa encontrada com o número ${id}.`);
      return;
    }
    setError(null);
    setModo('listar');
    setIndiceAtual(idx);
    setValorBusca('');
    setValorBuscaCpf('');
    setCriterioBusca('nome');
  }

  const carregarLista = async () => {
    setLoading(true);
    setError(null);
    if (FORCA_MOCK_CADASTRO) {
      setLista(getCadastroPessoasMock(apenasAtivos));
      setListaEhMock(true);
      setLoading(false);
      return;
    }
    try {
      const res = await listarClientes(apenasAtivos);
      setLista(Array.isArray(res) ? res : []);
      setListaEhMock(false);
    } catch (err) {
      setLista(getCadastroPessoasMock(apenasAtivos));
      setListaEhMock(true);
      setError(
        err.message
          ? `${err.message} — exibindo lista mock (cadastro PDF).`
          : 'API indisponível — exibindo lista mock (cadastro PDF).'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarLista();
  }, [apenasAtivos]);

  const total = lista.length;

  useEffect(() => {
    if (modo !== 'listar') return;
    if (!pessoaAtual) {
      setForm(emptyPessoa);
      setEditId(null);
      return;
    }
    setNumeroPessoa(String(pessoaAtual.id ?? ''));
    setForm({
        ...emptyPessoa,
        codigo: String(pessoaAtual.id ?? ''),
        nome: pessoaAtual.nome ?? '',
        genero: '',
        cpf: pessoaAtual.cpf ?? '',
        rg: '',
        orgaoExpedidor: '',
        profissao: '',
        dataNascimento: formatDate(pessoaAtual.dataNascimento) ?? '',
        nacionalidade: '',
        estadoCivil: '',
        email: pessoaAtual.email ?? '',
        contato: pessoaAtual.telefone ?? '',
        ativo: pessoaAtual.ativo !== false,
      });
      setEditId(pessoaAtual.id);
      setEnderecos([]);
      setContatos([]);
  }, [modo, indiceAtual, pessoaAtual]);

  function formatDate(v) {
    if (!v) return '';
    return typeof v === 'string' ? v.split('T')[0] : v;
  }

  const abrirNovo = () => {
    setForm(emptyPessoa);
    setEditId(null);
    setEnderecos([]);
    setContatos([]);
    setModo('criar');
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
    });
  };

  const abrirEditar = (item) => {
    setEditId(item.id);
    setForm({
      ...emptyPessoa,
      codigo: String(item.id ?? ''),
      nome: item.nome ?? '',
      cpf: item.cpf ?? '',
      email: item.email ?? '',
      contato: item.telefone ?? '',
      dataNascimento: formatDate(item.dataNascimento) ?? '',
      ativo: item.ativo !== false,
    });
    setEnderecos([]);
    setContatos([]);
    setModo('editar');
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
    });
  };

  const cancelarForm = () => {
    setModo('listar');
    setForm(emptyPessoa);
    setEditId(null);
    setError(null);
    if (lista.length) setIndiceAtual(0);
    setTextoColagemPessoa('');
    setExtracaoAvisos([]);
    setExtracaoResumo('');
    setExtracaoDebug(null);
  };

  const inputClassComAutofill = (campo, opts = {}) => {
    const base = opts.flex
      ? 'flex-1 min-w-0 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100'
      : 'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100';
    return camposPreenchidosPorTexto[campo]
      ? `${base} ring-2 ring-amber-400 border-amber-500/70 bg-amber-50/60`
      : base;
  };

  const handleClickUploadDocumento = () => {
    if (docProcessando) return;
    if (inputDocRef.current) {
      inputDocRef.current.click();
    }
  };

  const salvar = async () => {
    if (listaEhMock) {
      setError('Lista mock (PDF): gravação só com a API ativa. Defina VITE_USE_MOCK_CADASTRO_PESSOAS=false e backend.');
      return;
    }
    if (!form.nome?.trim() || !form.email?.trim() || !form.cpf?.trim()) {
      setError('Preencha nome, e-mail e CPF.');
      return;
    }
    const previewDoc = docPreview;
    const modoSalvar = modo;
    const editIdSalvar = editId;
    setSalvando(true);
    setError(null);
    try {
      const payload = {
        nome: form.nome.trim(),
        email: form.email.trim(),
        cpf: form.cpf.trim().replace(/\D/g, ''),
        telefone: form.contato?.trim() || null,
        dataNascimento: form.dataNascimento || null,
        ativo: form.ativo,
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
      await carregarLista();
      cancelarForm();
    } catch (err) {
      setError(err.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id, nome) => {
    if (listaEhMock) {
      setError('Lista mock (PDF): exclusão só com a API ativa.');
      return;
    }
    if (!window.confirm(`Excluir "${nome}"?`)) return;
    setError(null);
    try {
      await excluirCliente(id);
      await carregarLista();
      if (modo === 'editar' && editId === id) cancelarForm();
    } catch (err) {
      setError(err.message || 'Erro ao excluir.');
    }
  };

  const proximoNome = pessoaAtual?.id ?? (listaExibida.length > 0 ? listaExibida[0]?.id : '—');

  const totalPessoasCadastradas = total;
  const proximoCodigoPessoa =
    total > 0 ? Math.max(...lista.map((p) => p.id ?? 0), 0) + 1 : 1;

  const contagemContatos = {
    telefone: (contatos || []).filter((c) => c.tipo === 'telefone').length,
    email: (contatos || []).filter((c) => c.tipo === 'email').length,
    website: (contatos || []).filter((c) => c.tipo === 'website').length,
  };
  const totalContatos = contagemContatos.telefone + contagemContatos.email + contagemContatos.website;

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <header className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Cadastro de Pessoas</h1>
              <p className="text-slate-600 mt-1">Gerencie dados pessoais, endereços e contatos</p>
              {listaEhMock && !loading && (
                <p className="text-amber-700 text-sm mt-2 font-medium">
                  Dados de demonstração (exportação do PDF Cadastro de pessoas). Para API real:{' '}
                  <code className="bg-amber-50 px-1 rounded">VITE_USE_MOCK_CADASTRO_PESSOAS=false</code>
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                <span className="text-slate-500 block">Pessoas cadastradas</span>
                <span className="text-xl font-semibold text-slate-800">
                  {loading ? '—' : totalPessoasCadastradas}
                </span>
                {apenasAtivos && totalPessoasCadastradas > 0 && (
                  <span className="text-xs text-slate-500">(ativas)</span>
                )}
              </div>
              <div className="px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                <span className="text-slate-500 block">Próxima pessoa (código)</span>
                <span className="text-xl font-semibold text-blue-600">
                  {loading ? '—' : proximoCodigoPessoa}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Barra de busca e ações */}
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
                    disabled={loading || lista.length === 0}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-900 disabled:opacity-50 focus:ring-2 focus:ring-slate-500 focus:ring-offset-1"
                  >
                    <Search className="w-4 h-4" />
                    Localizar
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">Digite o código e pressione Enter ou Localizar</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Localizar por</label>
              <select
                value={criterioBusca}
                onChange={(e) => setCriterioBusca(e.target.value)}
                className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {CRITERIOS_BUSCA.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
              <input
                type="text"
                value={valorBusca}
                onChange={(e) => setValorBusca(e.target.value)}
                placeholder={criterioBusca === 'cpf' ? 'CPF' : criterioBusca === 'codigo' ? 'Código' : 'Nome'}
                className="w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Localizar por CPF/CNPJ</label>
              <input
                type="text"
                value={valorBuscaCpf}
                onChange={(e) => setValorBuscaCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="w-40 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex-1 flex justify-end gap-2">
              <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={apenasAtivos}
                  onChange={(e) => setApenasAtivos(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Apenas ativos
              </label>
              <button
                type="button"
                onClick={abrirNovo}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                <Plus className="w-4 h-4" />
                Nova pessoa
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
              >
                <FileText className="w-4 h-4" />
                Gerar Documentos
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Painel principal */}
        <section className="bg-white rounded-xl shadow-sm border border-slate-200/80 overflow-hidden">
          <div className="p-6">
            {(modo === 'criar' || modo === 'editar') ? (
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
                        disabled={form.edicaoDesabilitada}
                        className={inputClassComAutofill('rg')}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Órgão expedidor</label>
                      <input
                        type="text"
                        value={form.orgaoExpedidor}
                        onChange={(e) => setForm((f) => ({ ...f, orgaoExpedidor: e.target.value }))}
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
                          disabled={form.edicaoDesabilitada}
                          placeholder="Profissão"
                          className={inputClassComAutofill('profissao', { flex: true })}
                        />
                        <button
                          type="button"
                          className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 whitespace-nowrap"
                        >
                          Qualificação
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Data de nascimento</label>
                      <input
                        type="date"
                        value={form.dataNascimento}
                        onChange={(e) => {
                          setCamposPreenchidosPorTexto((c) => ({ ...c, dataNascimento: false }));
                          setForm((f) => ({ ...f, dataNascimento: e.target.value }));
                        }}
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
                        disabled={form.edicaoDesabilitada}
                        placeholder="Ex: Brasileira"
                        className={inputClassComAutofill('nacionalidade')}
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
                        disabled={form.edicaoDesabilitada}
                        className={inputClassComAutofill('estadoCivil')}
                      >
                        {ESTADOS_CIVIS.map((e) => (
                          <option key={e.value} value={e.value}>{e.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">E-mail *</label>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={form.email}
                          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                          disabled={form.edicaoDesabilitada}
                          placeholder="email@exemplo.com"
                          className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-100"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (extracaoEndereco && (extracaoEndereco.rua || extracaoEndereco.cep)) {
                              const sugerido = {
                                numero: (Array.isArray(enderecos) ? enderecos.length : 0) + 1,
                                rua: String(extracaoEndereco.rua || '').trim(),
                                bairro: String(extracaoEndereco.bairro || '').trim(),
                                estado: String(extracaoEndereco.estado || '').trim(),
                                cidade: String(extracaoEndereco.cidade || '').trim(),
                                cep: String(extracaoEndereco.cep || '').replace(/\D/g, '').slice(0, 8),
                                autoPreenchido: true,
                              };
                              const chaveSug = `${sugerido.rua}|${sugerido.bairro}|${sugerido.cidade}|${sugerido.estado}|${sugerido.cep}`
                                .toUpperCase()
                                .replace(/\s+/g, ' ')
                                .trim();
                              const listaAtual = Array.isArray(enderecos) ? enderecos : [];
                              const jaExiste = listaAtual.some((e) => {
                                const chave = `${e.rua || ''}|${e.bairro || ''}|${e.cidade || ''}|${e.estado || ''}|${e.cep || ''}`
                                  .toUpperCase()
                                  .replace(/\s+/g, ' ')
                                  .trim();
                                return chave && chave === chaveSug;
                              });
                              if (!jaExiste && (sugerido.rua || sugerido.cep)) {
                                setEnderecos([...listaAtual, sugerido]);
                              }
                            }
                            setModalEnderecos(true);
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                        >
                          <MapPin className="w-4 h-4" />
                          Endereços
                        </button>
                      </div>
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
                <div className="flex gap-3 mt-6 pt-6 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => salvar()}
                    disabled={salvando}
                    className="px-5 py-2.5 rounded-lg bg-blue-600 text-white font-medium text-sm hover:bg-blue-700 disabled:opacity-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                  >
                    {salvando ? 'Salvando...' : 'Salvar'}
                  </button>
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
                <div className="flex items-center gap-4 mb-6 flex-wrap">
                  <div className="flex border border-slate-300 rounded-lg overflow-hidden bg-white">
                    <button
                      type="button"
                      onClick={() => setIndiceAtual((i) => Math.max(0, i - 1))}
                      disabled={indiceAtual <= 0}
                      className="p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                      aria-label="Anterior"
                    >
                      <ChevronUp className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setIndiceAtual((i) => Math.min(listaExibida.length - 1, i + 1))}
                      disabled={indiceAtual >= listaExibida.length - 1 || listaExibida.length === 0}
                      className="p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-40"
                      aria-label="Próximo"
                    >
                      <ChevronDown className="w-5 h-5" />
                    </button>
                  </div>
                  <span className="text-sm text-slate-600">
                    Próximo nome: <strong>{total > 0 ? proximoNome : '—'}</strong>
                  </span>
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

                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5 mb-6">
                  <p className="font-semibold text-slate-800">{form.nome || '—'}</p>
                  <p className="text-slate-600 text-sm mt-0.5">{form.cpf || '—'}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="space-y-4">
                    <CampoReadOnly label="Código" value={form.codigo} />
                    <CampoReadOnly label="Nome" value={form.nome} />
                    <CampoReadOnly label="Gênero" value={form.genero || '—'} />
                    <CampoReadOnly label="CPF" value={form.cpf} />
                    <CampoReadOnly label="RG" value={form.rg} />
                    <CampoReadOnly label="Órgão expedidor" value={form.orgaoExpedidor} />
                    <CampoReadOnly label="Contato" value={form.contato} />
                  </div>
                  <div className="space-y-4">
                    <CampoReadOnly label="Profissão" value={form.profissao} />
                    <CampoReadOnly label="Data de nascimento" value={form.dataNascimento} />
                    <CampoReadOnly label="Nacionalidade" value={form.nacionalidade} />
                    <CampoReadOnly label="Estado civil" value={form.estadoCivil} />
                    <CampoReadOnly label="E-mail" value={form.email} />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setModalEnderecos(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-700 hover:bg-slate-50"
                      >
                        <MapPin className="w-4 h-4" />
                        Endereços
                      </button>
                      <button
                        type="button"
                        onClick={() => setModalContatos(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white text-slate-700 hover:bg-slate-50"
                      >
                        <Phone className="w-4 h-4" />
                        Contatos
                        {totalContatos > 0 && (
                          <span className="text-slate-500 font-normal">
                            ({contagemContatos.telefone} tel., {contagemContatos.email} e-mail, {contagemContatos.website} site)
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {loading ? (
                  <p className="text-slate-500 text-sm">Carregando...</p>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 text-slate-700 font-medium">
                        <tr>
                          <th className="text-left px-4 py-3">ID</th>
                          <th className="text-left px-4 py-3">Nome</th>
                          <th className="text-left px-4 py-3">E-mail</th>
                          <th className="text-left px-4 py-3">CPF</th>
                          <th className="text-center px-4 py-3">Doc.</th>
                          <th className="text-left px-4 py-3">Ativo</th>
                          <th className="text-right px-4 py-3">Ações</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {listaExibida.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                              Nenhuma pessoa cadastrada.
                            </td>
                          </tr>
                        ) : (
                          listaExibida.map((p) => (
                            <tr key={p.id} className="hover:bg-slate-50/50">
                              <td className="px-4 py-3 text-slate-600">{p.id}</td>
                              <td className="px-4 py-3 font-medium text-slate-800">{p.nome}</td>
                              <td className="px-4 py-3 text-slate-600">{p.email}</td>
                              <td className="px-4 py-3 text-slate-600">{p.cpf}</td>
                              <td className="px-4 py-3 text-center">
                                {pessoasComDocumento.includes(String(p.id)) ? (
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center p-1.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                    title="Documento pessoal disponível"
                                    onClick={() => {
                                      try {
                                        const doc = obterDocumentoPessoa(p.id);
                                        if (!doc) {
                                          setDocStatus({
                                            kind: 'error',
                                            message:
                                              'Registro de documento não encontrado. Ele pode ter sido removido do armazenamento local.',
                                          });
                                          return;
                                        }
                                        const url = criarUrlParaDocumento(doc);
                                        if (!url) {
                                          setDocStatus({
                                            kind: 'error',
                                            message:
                                              'Não foi possível abrir o documento armazenado localmente.',
                                          });
                                          return;
                                        }
                                        window.open(url, '_blank', 'noopener,noreferrer');
                                      } catch (err) {
                                        setDocStatus({
                                          kind: 'error',
                                          message:
                                            err?.message ||
                                            'Falha ao abrir o documento armazenado localmente.',
                                        });
                                      }
                                    }}
                                  >
                                    <FileText className="w-4 h-4" />
                                  </button>
                                ) : (
                                  <span className="inline-flex items-center justify-center text-xs text-slate-400">
                                    —
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3">{p.ativo ? 'Sim' : 'Não'}</td>
                              <td className="px-4 py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => abrirEditar(p)}
                                  className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 inline-flex items-center justify-center"
                                  title="Editar"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => excluir(p.id, p.nome)}
                                  className="p-2 rounded-lg text-red-600 hover:bg-red-50 inline-flex items-center justify-center ml-1"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Rodapé de ações */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.history.back()}
              className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
            >
              Fechar
            </button>
            {modo === 'listar' && (
              <>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                  onClick={() => pessoaAtual && abrirEditar(pessoaAtual)}
                >
                  Usar esse
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
                  onClick={() => setIndiceAtual((i) => Math.min(listaExibida.length - 1, i + 1))}
                >
                  Pular
                </button>
              </>
            )}
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
      />
      <ModalContatos
        open={modalContatos}
        onClose={() => setModalContatos(false)}
        contatos={contatos}
        onChange={setContatos}
      />
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

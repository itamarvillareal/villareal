import { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, FolderOpen, ChevronLeft, ChevronRight, Settings, SlidersHorizontal } from 'lucide-react';
import { ModalConfiguracoesCalculoCliente } from './ModalConfiguracoesCalculoCliente.jsx';
import { clienteMock, processosClienteMock } from '../data/mockData';
import { getMockProcesso10x10 } from '../data/processosMock';
import { getIdPessoaPorCodCliente } from '../data/clientesCadastradosMock';
import { getPessoaPorId } from '../data/cadastroPessoasMock';

function formatDocBR(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return d || '—';
}

function dadosClientePorCodigo(n) {
  const idPessoa = getIdPessoaPorCodCliente(n);
  const pes = idPessoa != null ? getPessoaPorId(idPessoa) : null;
  if (pes) {
    return {
      pessoa: String(idPessoa),
      nomeRazao: pes.nome,
      cnpjCpf: formatDocBR(pes.cpf),
    };
  }
  if (idPessoa != null) {
    return {
      pessoa: String(idPessoa),
      nomeRazao: `Pessoa nº ${idPessoa} (fora do cadastro local)`,
      cnpjCpf: '—',
    };
  }
  return {
    pessoa: '',
    nomeRazao: `CLIENTE ${String(n).padStart(4, '0')}`,
    cnpjCpf: '—',
  };
}

const inputClass = 'w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white';

function normalizarCodigoCliente(val) {
  const s = String(val ?? '').trim();
  if (!s) return '1';
  const n = Number(s);
  if (Number.isNaN(n) || n < 1) return '1';
  return String(Math.floor(n));
}

function padCliente8(val) {
  const n = Number(normalizarCodigoCliente(val));
  return String(n).padStart(8, '0');
}

function apenasDigitos(val) {
  return String(val ?? '').replace(/\D/g, '');
}

/** Exportado para busca de cliente/proc no Financeiro sem sair da tela. */
export function normalizarTextoBusca(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

/** Exportado para busca de cliente/proc no Financeiro sem sair da tela. */
export function normalizarNumeroBusca(s) {
  return String(s ?? '').replace(/\D/g, '');
}

/** Exportado para o mesmo mock de processos do cadastro (busca no Financeiro). */
export function gerarMockClienteEProcessos(codigo) {
  const n = Number(normalizarCodigoCliente(codigo));
  if (!Number.isFinite(n) || n < 1 || n > 1000) return null;
  const codigoCliente = padCliente8(n);
  const base = dadosClientePorCodigo(n);
  const procRows = [];

  // Clientes 1–10: usa o mock especializado (getMockProcesso10x10)
  if (n >= 1 && n <= 10) {
    for (let p = 1; p <= 10; p++) {
      const mockProc = getMockProcesso10x10(n, p);
      if (!mockProc) continue;
      const baseTipoAcao = processosClienteMock[p - 1]?.descricao;
      procRows.push({
        id: `${n}-${p}`,
        procNumero: p,
        processoVelho: mockProc.numeroProcessoVelho || '-',
        processoNovo: mockProc.numeroProcessoNovo,
        autor: mockProc.autor,
        reu: mockProc.reu,
        parteOposta: mockProc.reu,
        tipoAcao: baseTipoAcao ?? 'AÇÃO (MOCK)',
        descricao: baseTipoAcao ?? `AÇÃO (MOCK) PROC ${String(p).padStart(2, '0')}`,
      });
    }
    const cnpjCpf =
      base.cnpjCpf !== '—'
        ? base.cnpjCpf
        : `00.${String(n).padStart(3, '0')}.000/0001-00`;
    return {
      codigoCliente,
      pessoa: base.pessoa,
      nomeRazao: base.nomeRazao,
      cnpjCpf,
      processos: procRows,
    };
  }

  // Clientes 11–1000: gera mock genérico com processos 1–10
  for (let p = 1; p <= 10; p++) {
    const seq = 5600000 + n * 37 + p * 11;
    const dv = String(10 + ((n + p) % 90)).padStart(2, '0');
    const foro = String(1000 + ((n * 13 + p * 7) % 900)).slice(-4);
    const numeroProcessoNovo = `${String(seq).slice(0, 7)}-${dv}.2025.8.09.${foro}`;
    const parteOposta = `RÉU MOCK C${String(n).padStart(3, '0')}/P${String(p).padStart(2, '0')}`;
    const autor = `AUTOR MOCK C${String(n).padStart(3, '0')}/P${String(p).padStart(2, '0')}`;
    const baseTipoAcao = processosClienteMock[p - 1]?.descricao;
    procRows.push({
      id: `${n}-${p}`,
      procNumero: p,
      processoVelho: '-',
      processoNovo: numeroProcessoNovo,
      autor,
      reu: parteOposta,
      parteOposta,
      tipoAcao: baseTipoAcao ?? 'AÇÃO (MOCK)',
      descricao: baseTipoAcao ?? `AÇÃO MOCK CLIENTE ${String(n).padStart(3, '0')} — PROC ${String(p).padStart(2, '0')}`,
    });
  }

  return {
    codigoCliente,
    pessoa: base.pessoa,
    nomeRazao: base.nomeRazao,
    cnpjCpf: base.cnpjCpf,
    processos: procRows,
  };
}

function somenteDigitos(v) {
  return String(v ?? '').replace(/\D/g, '');
}

function joinComVirgula(partes) {
  return (partes || []).map((x) => String(x ?? '').trim()).filter(Boolean).join(', ');
}

function montarQualificacaoTexto({ nomeRazao, cnpjCpf, pessoaData }) {
  const nome = String(pessoaData?.nome ?? nomeRazao ?? '').trim() || 'QUALIFICAÇÃO NÃO INFORMADA';
  const docDigits = somenteDigitos(pessoaData?.cpf ?? cnpjCpf);
  const email = String(pessoaData?.email ?? '').trim();

  const isPJ = docDigits.length === 14;
  if (isPJ) {
    const cnpjFmt = formatDocBR(docDigits);
    const corpo = [
      `${nome}, pessoa jurídica de direito privado`,
      cnpjFmt !== '—' ? `inscrita no CNPJ sob o nº ${cnpjFmt}` : '',
      'com sede em endereço a ser complementado',
      'neste ato representada na forma de seus atos constitutivos',
    ];
    return `${joinComVirgula(corpo)}.`;
  }

  const cpfFmt = docDigits.length === 11 ? formatDocBR(docDigits) : '';
  const blocos = [
    `${nome}`,
    'brasileiro(a)',
    cpfFmt ? `inscrito(a) no CPF sob o nº ${cpfFmt}` : '',
    'residente e domiciliado(a) em endereço a ser complementado',
    email ? `endereço eletrônico ${email}` : 'não utiliza endereço eletrônico',
  ];
  return `${joinComVirgula(blocos)}.`;
}

export function CadastroClientes() {
  const location = useLocation();
  const navigate = useNavigate();
  const stateFromFinanceiro = location.state && typeof location.state === 'object' ? location.state : null;
  const codClienteFromState = stateFromFinanceiro?.codCliente ?? '';
  const procFromState = stateFromFinanceiro?.proc ?? '';

  const [proximoCliente, _setProximoCliente] = useState(clienteMock.proximoCliente);
  const [codigo, setCodigo] = useState(padCliente8(clienteMock.codigo));
  const [pessoa, setPessoa] = useState(clienteMock.pessoa);
  const [nomeRazao, setNomeRazao] = useState(clienteMock.nomeRazao);
  const [cnpjCpf, setCnpjCpf] = useState(clienteMock.cnpjCpf);
  const [edicaoDesabilitada, setEdicaoDesabilitada] = useState(clienteMock.edicaoDesabilitada);
  const [clienteInativo, setClienteInativo] = useState(clienteMock.clienteInativo);
  const [observacao, setObservacao] = useState(clienteMock.observacao);
  const [pesquisaProcesso, setPesquisaProcesso] = useState('');
  const [modalQualificacaoAberto, setModalQualificacaoAberto] = useState(false);
  const [modalConfigCalculoAberto, setModalConfigCalculoAberto] = useState(false);
  const [processos, setProcessos] = useState(() => {
    const mock = gerarMockClienteEProcessos(clienteMock.codigo);
    return mock?.processos ?? processosClienteMock.slice(0, 10);
  });

  useEffect(() => {
    if (codClienteFromState) {
      const mock = gerarMockClienteEProcessos(codClienteFromState);
      if (mock) {
        setCodigo(mock.codigoCliente);
        setPessoa(mock.pessoa ?? '');
        setNomeRazao(mock.nomeRazao);
        setCnpjCpf(mock.cnpjCpf);
        setProcessos(mock.processos);
      } else {
        setCodigo(codClienteFromState);
      }
    }
    if (procFromState) setPesquisaProcesso(procFromState);
  }, [codClienteFromState, procFromState]);

  function aplicarCodigoCliente(value) {
    const padded = padCliente8(value);
    setCodigo(padded);
    const mock = gerarMockClienteEProcessos(padded);
    if (mock) {
      setCodigo(mock.codigoCliente);
      setPessoa(mock.pessoa ?? '');
      setNomeRazao(mock.nomeRazao);
      setCnpjCpf(mock.cnpjCpf);
      setProcessos(mock.processos);
    }
  }

  function handleCodigoInputChange(value) {
    const digits = apenasDigitos(value);
    // Durante digitação, permite vazio para não “travar” o backspace e
    // não reaplica padding/normalização antes do usuário terminar.
    if (!digits) {
      setCodigo('');
      return;
    }
    setCodigo(digits);
  }

  function handleCodigoInputBlur(value) {
    const digits = apenasDigitos(value);
    aplicarCodigoCliente(digits || '1');
  }

  function abrirProcessos(procNumero) {
    navigate('/processos', { state: { codCliente: padCliente8(codigo), proc: String(procNumero ?? '') } });
  }

  const processosFiltrados = useMemo(() => {
    const termoRaw = String(pesquisaProcesso ?? '');
    const termo = normalizarTextoBusca(termoRaw);
    const termoNumero = normalizarNumeroBusca(termoRaw);
    if (!termo) return processos;

    // Se o usuário digitou algo curto e numérico, tratamos como busca pelo “Proc.” (1–10).
    const buscaProcCurta = termoNumero.length > 0 && termoNumero.length <= 2;

    return (processos || []).filter((proc) => {
      const procNumeroStr = String(proc.procNumero ?? '');
      const numeroNovo = normalizarNumeroBusca(proc.processoNovo ?? '');

      const numeroMatch = (() => {
        if (!termoNumero) return false;
        if (buscaProcCurta) return procNumeroStr.includes(termoNumero);
        return numeroNovo.includes(termoNumero);
      })();

      const autorStr = normalizarTextoBusca(proc.autor ?? '');
      const reuStr = normalizarTextoBusca(proc.reu ?? proc.parteOposta ?? '');
      const tipoAcaoStr = normalizarTextoBusca(proc.tipoAcao ?? proc.descricao ?? '');

      return (
        numeroMatch ||
        autorStr.includes(termo) ||
        reuStr.includes(termo) ||
        tipoAcaoStr.includes(termo) ||
        // fallback: procura genérica em campos de texto já visíveis
        normalizarTextoBusca(proc.parteOposta ?? '').includes(termo) ||
        normalizarTextoBusca(proc.descricao ?? '').includes(termo)
      );
    });
  }, [processos, pesquisaProcesso]);

  const pessoaSelecionada = useMemo(() => {
    const id = Number(String(pessoa ?? '').replace(/\D/g, ''));
    if (!Number.isFinite(id) || id <= 0) return null;
    return getPessoaPorId(id);
  }, [pessoa]);

  const textoQualificacao = useMemo(
    () => montarQualificacaoTexto({ nomeRazao, cnpjCpf, pessoaData: pessoaSelecionada }),
    [nomeRazao, cnpjCpf, pessoaSelecionada]
  );

  return (
    <div className="min-h-full bg-slate-200 flex flex-col">
      <header className="flex items-center justify-between px-3 py-2 bg-white border-b border-slate-300 shrink-0">
        <h1 className="text-lg font-bold text-slate-800">Cadastro de Clientes</h1>
      </header>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        <div className="flex-1 min-w-0 overflow-auto p-4 space-y-4">
          <section className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-0.5">Próximo cliente:</label>
              <p className="text-sm text-slate-800 px-1 py-1.5 bg-transparent">
                {proximoCliente}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-0.5">Código:</label>
              <div className="flex border border-slate-300 rounded overflow-hidden bg-white w-56">
                <button
                  type="button"
                  className="w-8 py-1.5 border-r border-slate-300 hover:bg-slate-100 text-slate-700 flex items-center justify-center"
                  onClick={() => {
                    const n = Number(normalizarCodigoCliente(codigo));
                    const next = Math.max(1, n - 1);
                    aplicarCodigoCliente(String(next));
                  }}
                  title="Anterior"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <input
                  type="text"
                  value={codigo}
                  onChange={(e) => handleCodigoInputChange(e.target.value)}
                  onBlur={(e) => handleCodigoInputBlur(e.target.value)}
                  className="flex-1 px-2 py-1.5 text-sm font-mono text-center border-0 bg-white"
                />
                <button
                  type="button"
                  className="w-8 py-1.5 border-l border-slate-300 hover:bg-slate-100 text-slate-700 flex items-center justify-center"
                  onClick={() => {
                    const n = Number(normalizarCodigoCliente(codigo));
                    const next = n + 1;
                    aplicarCodigoCliente(String(next));
                  }}
                  title="Próximo"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-0.5">Pessoa:</label>
              <div className="flex gap-1">
                <input type="text" value={pessoa} onChange={(e) => setPessoa(e.target.value)} disabled={edicaoDesabilitada} className={`${inputClass} w-24 bg-slate-50`} />
                <button type="button" className="p-2 rounded border border-slate-300 bg-white hover:bg-slate-50" title="Pesquisar"><Search className="w-4 h-4 text-slate-600" /></button>
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm font-medium text-slate-700 mb-0.5">Nome / Razão Social</label>
              <input type="text" value={nomeRazao} onChange={(e) => setNomeRazao(e.target.value)} disabled={edicaoDesabilitada} className={`${inputClass} ${edicaoDesabilitada ? 'bg-slate-50' : ''}`} />
            </div>
            <div className="w-44">
              <label className="block text-sm font-medium text-slate-700 mb-0.5">CNPJ / CPF</label>
              <input type="text" value={cnpjCpf} onChange={(e) => setCnpjCpf(e.target.value)} disabled={edicaoDesabilitada} className={`${inputClass} ${edicaoDesabilitada ? 'bg-slate-50' : ''}`} />
            </div>
            <div className="flex gap-2 items-end">
              <button type="button" className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">Cadastro de Pessoas</button>
              <button
                type="button"
                onClick={() => setModalQualificacaoAberto(true)}
                className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                Qualificação
              </button>
              <button type="button" className="p-2 rounded border border-slate-300 bg-white hover:bg-slate-50" title="Documentos"><FolderOpen className="w-4 h-4 text-slate-600" /></button>
              <button
                type="button"
                onClick={() => setModalConfigCalculoAberto(true)}
                className="inline-flex items-center gap-2 px-3 py-2 rounded border border-indigo-200 bg-indigo-50 text-indigo-900 text-sm hover:bg-indigo-100"
                title="Padrões de juros, multa, honorários, índice e periodicidade para os cálculos deste cliente"
              >
                <SlidersHorizontal className="w-4 h-4 shrink-0" aria-hidden />
                Configurações de cálculo
              </button>
              <button
                type="button"
                onClick={() => navigate('/configuracoes')}
                className="inline-flex items-center gap-2 px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
                title="Preferências gerais do aplicativo"
              >
                <Settings className="w-4 h-4 text-slate-600 shrink-0" aria-hidden />
                Config. aplicativo
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={edicaoDesabilitada} onChange={(e) => setEdicaoDesabilitada(e.target.checked)} className="rounded border-slate-300" />
              Edição Desabilitada
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={clienteInativo} onChange={(e) => setClienteInativo(e.target.checked)} className="rounded border-slate-300" />
              Cliente Inativo
            </label>
          </section>

          <section>
            <label className="block text-sm font-medium text-slate-700 mb-0.5">Observação:</label>
            <textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} className={`${inputClass} resize-y`} />
          </section>

          <section className="border-t border-slate-200 pt-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Processo:</p>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <label className="text-sm text-slate-700">Pesquisar:</label>
              <input type="text" value={pesquisaProcesso} onChange={(e) => setPesquisaProcesso(e.target.value)} className={`${inputClass} w-64`} placeholder="Buscar processo..." />
              <button type="button" className="p-2 rounded border border-slate-300 bg-white hover:bg-slate-50"><Search className="w-4 h-4 text-slate-600" /></button>
              <button type="button" className="px-3 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50">Pesquisa</button>
            </div>
            <div className="overflow-x-auto border border-slate-300 rounded bg-white">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100">
                    <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 w-24 whitespace-nowrap">Proc.</th>
                    <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[100px]">N.º Processo Velho:</th>
                    <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[180px]">N.º Processo Novo:</th>
                    <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[180px]">Parte Oposta:</th>
                    <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[180px]">Descrição da Ação:</th>
                    <th className="border border-slate-300 px-2 py-1.5 w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {processosFiltrados.map((proc, idx) => (
                    <tr
                      key={proc.id}
                      className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} cursor-pointer hover:bg-blue-50`}
                      title="Duplo clique: abrir este processo"
                      onDoubleClick={() => abrirProcessos(proc.procNumero ?? (idx + 1))}
                    >
                      <td className="border border-slate-200 px-2 py-1 text-slate-700 whitespace-nowrap tabular-nums">Proc. {String(proc.procNumero ?? (idx + 1)).padStart(2, '0')}:</td>
                      <td className="border border-slate-200 px-2 py-1">{proc.processoVelho}</td>
                      <td className="border border-slate-200 px-2 py-1">{proc.processoNovo}</td>
                      <td className="border border-slate-200 px-2 py-1">{proc.parteOposta}</td>
                      <td className="border border-slate-200 px-2 py-1">{proc.descricao}</td>
                      <td className="border border-slate-200 px-2 py-1">
                        <button
                          type="button"
                          className="p-1 rounded hover:bg-slate-100"
                          title="Abrir processo"
                          onClick={(e) => { e.stopPropagation(); abrirProcessos(proc.procNumero ?? (idx + 1)); }}
                        >
                          <FolderOpen className="w-4 h-4 text-slate-600" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="flex justify-center pt-2">
            <button type="button" className="px-6 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50" onClick={() => window.history.back()}>
              Fechar
            </button>
          </div>
        </div>

        {/* Seção “Controle” removida para eliminar o painel lateral solicitado. */}
      </div>

      <ModalConfiguracoesCalculoCliente
        open={modalConfigCalculoAberto}
        codigoCliente={codigo}
        nomeCliente={nomeRazao}
        onClose={() => setModalConfigCalculoAberto(false)}
      />

      {modalQualificacaoAberto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-qualificacao-titulo"
          onClick={() => setModalQualificacaoAberto(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-4xl max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h2 id="modal-qualificacao-titulo" className="text-base font-semibold text-slate-800">Texto</h2>
              <button
                type="button"
                onClick={() => setModalQualificacaoAberto(false)}
                className="px-3 py-1.5 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
              >
                Fechar
              </button>
            </div>
            <div className="p-4 flex-1 min-h-0">
              <textarea
                value={textoQualificacao}
                readOnly
                className="w-full h-full min-h-[300px] px-3 py-2 border border-slate-300 rounded text-sm bg-white resize-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

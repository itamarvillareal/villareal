import { useState, useRef, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  getExtratosIniciais,
  getTransacoesConsolidadas,
  cloneExtratos,
  LETRA_TO_CONTA,
  BANCO_TO_NUMERO,
  parearCompensacaoInterbancaria,
  parearCompensacaoAposImportacaoOfx,
  somasPorParCompensacao,
  detectarParesCompensacao,
  loadPersistedExtratosFinanceiro,
  savePersistedExtratosFinanceiro,
  getContasContabeisDerivadasExtratos,
} from '../data/financeiroData';
import { parseOfxToExtrato, mergeExtratoBancario, contarLancamentosNovos } from '../utils/ofx';
import { OFX_ITAU_REAL_EXEMPLO, OFX_CORA_REAL_EXEMPLO } from '../data/ofxItauCoraReal';

const REF_CONSTANTE = 675;

const OPCOES_LIMITE_LANCAMENTOS_EXTRATO = [
  { v: 25, label: '25' },
  { v: 50, label: '50' },
  { v: 100, label: '100' },
  { v: 200, label: '200' },
  { v: 500, label: '500' },
  { v: 0, label: 'Todos' },
];
const LETRAS_VALIDAS = Object.keys(LETRA_TO_CONTA);
function getTransacoesBanco(extratosPorBanco, nomeBanco) {
  return extratosPorBanco[nomeBanco] ?? [];
}

function formatValor(v) {
  if (v === 0) return '0,00';
  const s = Math.abs(v).toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return v < 0 ? `-${s}` : s;
}

/** Converte data DD/MM/YYYY (com ou sem zeros) para YYYY-MM-DD — ordenação correta. */
function dataParaOrdenar(data) {
  const s = String(data ?? '').trim();
  const parts = s.split('/').map((p) => String(p).trim());
  if (parts.length !== 3) return '';
  const d = parts[0].padStart(2, '0');
  const m = parts[1].padStart(2, '0');
  let a = parts[2].replace(/\D/g, '');
  if (a.length === 2) a = `20${a}`;
  if (a.length !== 4) return '';
  return `${a}-${m}-${d}`;
}

/** Ordena lista de transações do extrato bancário por coluna e direção. */
function ordenarTransacoesBanco(lista, col, dir) {
  if (!col || !lista.length) return lista;
  const asc = dir === 'asc';
  const cmp = (a, b) => {
    let va = a[col];
    let vb = b[col];
    if (col === 'data') {
      va = dataParaOrdenar(va);
      vb = dataParaOrdenar(vb);
      return va.localeCompare(vb);
    }
    if (col === 'valor' || col === 'saldo') {
      return (Number(va) || 0) - (Number(vb) || 0);
    }
    const sa = String(va ?? '');
    const sb = String(vb ?? '');
    return sa.localeCompare(sb, 'pt-BR');
  };
  const sorted = [...lista].sort((a, b) => {
    let r = cmp(a, b);
    if (r === 0 && col === 'data') {
      r = String(a.numero ?? '').localeCompare(String(b.numero ?? ''), undefined, { numeric: true });
    }
    return asc ? r : -r;
  });
  return sorted;
}

/** Ordena lista do extrato consolidado por coluna e direção. */
function ordenarTransacoesConsolidado(lista, col, dir) {
  if (!col || !lista.length) return lista;
  const asc = dir === 'asc';
  const cmp = (a, b) => {
    let va = a[col];
    let vb = b[col];
    if (col === 'data') {
      va = dataParaOrdenar(va);
      vb = dataParaOrdenar(vb);
      return va.localeCompare(vb);
    }
    if (col === 'valor') return (Number(va) || 0) - (Number(vb) || 0);
    if (col === 'numeroBanco') return (Number(va) || 0) - (Number(vb) || 0);
    const sa = String(va ?? '');
    const sb = String(vb ?? '');
    return sa.localeCompare(sb, 'pt-BR');
  };
  const sorted = [...lista].sort((a, b) => {
    const r = cmp(a, b);
    return asc ? r : -r;
  });
  return sorted;
}

const INSTITUICOES_LINHA_1 = [
  'CEF',
  'CEF Poupança',
  'BB',
  'Itaú',
  'Itaú Empresas',
  'CORA',
  'BTG',
  'BTG JA',
  'BTG RACHEL',
  'BTG (2)',
  'BTG Banking',
  'ITI',
  'Itaú Poupança',
];

const INSTITUICOES_LINHA_2 = [
  'Sicoob VRV',
  'Sicoob',
  'Bradesco',
  'Poupança Bradesco',
  'Nubank',
  'PicPay',
  'PicPay Rachel',
];

export function Financeiro() {
  const navigate = useNavigate();
  const location = useLocation();
  const [extratosPorBanco, setExtratosPorBanco] = useState(() => {
    const persisted = loadPersistedExtratosFinanceiro();
    const merged = persisted ? { ...getExtratosIniciais(), ...persisted } : getExtratosIniciais();
    return parearCompensacaoInterbancaria(merged);
  });

  const [instituicaoSelecionada, setInstituicaoSelecionada] = useState('CEF');
  const [contaContabilSelecionada, setContaContabilSelecionada] = useState('Conta Escritório');
  const [linhaConsolidadoFoco, setLinhaConsolidadoFoco] = useState(null);
  const [linhaConsolidadoAlvo, setLinhaConsolidadoAlvo] = useState(null);
  const [linhaBancoAlvo, setLinhaBancoAlvo] = useState(null);
  const [sortExtratoBanco, setSortExtratoBanco] = useState({ col: null, dir: 'asc' });
  const [limiteLancamentosExtratoBanco, setLimiteLancamentosExtratoBanco] = useState(100);
  const [limiteLancamentosConsolidado, setLimiteLancamentosConsolidado] = useState(100);
  const [sortConsolidado, setSortConsolidado] = useState({ col: null, dir: 'asc' });
  const linhaConsolidadoRef = useRef(null);
  const linhaBancoRef = useRef(null);
  const fileInputOfxRef = useRef(null);
  const [ofxStatus, setOfxStatus] = useState({ kind: 'idle', message: '' });
  const [substituirExtratoOfxCompleto, setSubstituirExtratoOfxCompleto] = useState(false);
  const [modalParearCompensacao, setModalParearCompensacao] = useState(null);
  const saveTimerRef = useRef(null);

  const transacoesConsolidadas = getTransacoesConsolidadas(extratosPorBanco, contaContabilSelecionada);
  const saldoConsolidado = transacoesConsolidadas.reduce((s, t) => s + t.valor, 0);
  const isContaCompensacao = contaContabilSelecionada === 'Conta Compensação';
  const somasParComp = isContaCompensacao ? somasPorParCompensacao(extratosPorBanco) : {};
  const paresCompensacaoDesbalanceados = isContaCompensacao
    ? Object.entries(somasParComp).filter(([proc, somaCent]) => /^\d+$/.test(String(proc)) && somaCent !== 0)
    : [];
  const orfaosCompensacao = isContaCompensacao
    ? Object.keys(somasParComp).filter((p) => String(p).startsWith('?')).length
    : 0;

  const listaExtratoBancoOrdenada = useMemo(() => {
    if (!instituicaoSelecionada) return [];
    return ordenarTransacoesBanco(
      getTransacoesBanco(extratosPorBanco, instituicaoSelecionada),
      sortExtratoBanco.col,
      sortExtratoBanco.dir
    );
  }, [extratosPorBanco, instituicaoSelecionada, sortExtratoBanco.col, sortExtratoBanco.dir]);

  const listaConsolidadaOrdenada = useMemo(() => {
    const txs = getTransacoesConsolidadas(extratosPorBanco, contaContabilSelecionada);
    return ordenarTransacoesConsolidado(txs, sortConsolidado.col, sortConsolidado.dir);
  }, [extratosPorBanco, contaContabilSelecionada, sortConsolidado.col, sortConsolidado.dir]);

  /** Contas ordenadas pelo uso real nos extratos (quantidade e soma dos valores por letra). */
  const contasDerivadasDosExtratos = useMemo(
    () => getContasContabeisDerivadasExtratos(extratosPorBanco),
    [extratosPorBanco]
  );
  const meioContas = Math.ceil(contasDerivadasDosExtratos.length / 2) || 1;
  const contasLinha1 = contasDerivadasDosExtratos.slice(0, meioContas);
  const contasLinha2 = contasDerivadasDosExtratos.slice(meioContas);

  /** Altera a letra (conta contábil) do lançamento; o lançamento sai da conta original e passa para a nova. */
  function updateLetraLancamento(nomeBanco, numero, data, novaLetra) {
    setExtratosPorBanco((prev) => {
      const next = cloneExtratos(prev);
      const list = next[nomeBanco];
      if (!list) return prev;
      const idx = list.findIndex((t) => t.numero === numero && t.data === data);
      if (idx === -1) return prev;
      list[idx] = {
        ...list[idx],
        letra: novaLetra,
        ...(novaLetra === 'E' ? { codCliente: '', proc: '' } : {}),
      };
      return next;
    });
  }

  function updateCampoLancamento(nomeBanco, numero, data, field, value) {
    setExtratosPorBanco((prev) => {
      const next = cloneExtratos(prev);
      const list = next[nomeBanco];
      if (!list) return prev;
      const idx = list.findIndex((t) => t.numero === numero && t.data === data);
      if (idx === -1) return prev;
      list[idx] = { ...list[idx], [field]: value };
      return next;
    });
  }

  /** Duplo clique na linha do extrato bancário: abre a conta contábil da letra e posiciona nessa linha no consolidado. */
  function handleDuploCliqueLinhaBanco(transacao) {
    const conta = LETRA_TO_CONTA[transacao.letra];
    if (!conta) return;
    const rowKey = `${instituicaoSelecionada}-${transacao.numero}-${transacao.data}`;
    setContaContabilSelecionada(conta);
    setLinhaConsolidadoAlvo(rowKey);
    setLinhaConsolidadoFoco(rowKey);
  }

  /** Duplo clique no título da coluna do extrato bancário: ordena por essa coluna (asc ↔ desc). Data: 1.º clique = mais recente primeiro. */
  function handleDuploCliqueTituloExtratoBanco(col) {
    setSortExtratoBanco((prev) => {
      if (prev.col !== col) {
        if (col === 'data') return { col, dir: 'desc' };
        return { col, dir: 'asc' };
      }
      return { col, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
    });
  }

  /** Duplo clique no título da coluna do extrato consolidado: ordena por essa coluna (asc ↔ desc). */
  function handleDuploCliqueTituloConsolidado(col) {
    setSortConsolidado((prev) => ({
      col,
      dir: prev.col === col ? (prev.dir === 'asc' ? 'desc' : 'asc') : 'asc',
    }));
  }

  /** Duplo clique na coluna Cod. Cliente: abre o cadastro de clientes com esse código e processo. */
  function handleDuploCliqueCodCliente(codCliente, proc) {
    navigate('/pessoas', { state: { codCliente: String(codCliente ?? ''), proc: String(proc ?? '') } });
  }

  /** Duplo clique na coluna Proc.: abre Processos e leva o lançamento da linha para a Conta Corrente. */
  function handleDuploCliqueProc(codCliente, proc, transacao) {
    const t = transacao && typeof transacao === 'object' ? transacao : null;
    navigate('/processos', {
      state: {
        codCliente: String(codCliente ?? ''),
        proc: String(proc ?? ''),
        contaCorrenteLinha: t
          ? {
              data: t.data,
              descricao: t.descricao,
              valor: t.valor,
              numero: t.numero,
              nomeBanco: t.nomeBanco,
              codCliente: String(t.codCliente ?? codCliente ?? ''),
              proc: String(t.proc ?? proc ?? ''),
              descricaoDetalhada: t.descricaoDetalhada || '',
              letra: t.letra,
            }
          : undefined,
      },
    });
  }

  /** Duplo clique no Nº do consolidado: abre o extrato do banco e posiciona na linha desse lançamento. */
  function handleDuploCliqueNºConsolidado(transacao) {
    setInstituicaoSelecionada(transacao.nomeBanco);
    setLinhaBancoAlvo({ nomeBanco: transacao.nomeBanco, numero: transacao.numero, data: transacao.data });
  }

  function readFileAsText(file) {
    if (file && typeof file.text === 'function') return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.readAsText(file);
    });
  }

  function aplicarExtratoNoBanco(prev, nomeBanco, listaNova, modo) {
    const atual = prev[nomeBanco] ?? [];
    const finalLista =
      modo === 'substituir' ? listaNova : mergeExtratoBancario(atual, listaNova);
    const comNovoExtrato = { ...prev, [nomeBanco]: finalLista };
    /* Após OFX: varrer todos os bancos por novos pares (N + órfãos Proc. ?n × demais extratos). */
    return parearCompensacaoAposImportacaoOfx(comNovoExtrato);
  }

  async function importarOfxArquivo(file) {
    try {
      setOfxStatus({ kind: 'loading', message: `Importando OFX para ${instituicaoSelecionada}...` });
      const text = await readFileAsText(file);
      const extrato = parseOfxToExtrato(text, { nomeBanco: instituicaoSelecionada });
      if (!extrato.length) {
        setOfxStatus({ kind: 'error', message: 'Arquivo OFX não contém lançamentos (<STMTTRN>).' });
        return;
      }
      const modo = substituirExtratoOfxCompleto ? 'substituir' : 'mesclar';
      let novosContados = 0;
      setExtratosPorBanco((prev) => {
        const atual = prev[instituicaoSelecionada] ?? [];
        novosContados = modo === 'mesclar' ? contarLancamentosNovos(atual, extrato) : extrato.length;
        return aplicarExtratoNoBanco(prev, instituicaoSelecionada, extrato, modo);
      });
      const base =
        modo === 'mesclar'
          ? `OFX: +${novosContados} lanç. novos em ${instituicaoSelecionada} (${extrato.length - novosContados} duplicados ignorados). Extrato anterior mantido.`
          : `OFX: extrato de ${instituicaoSelecionada} substituído (${extrato.length} lanç.).`;
      setOfxStatus({
        kind: 'success',
        message: `${base} Compensação: busca automática em todos os extratos concluída.`,
      });
    } catch (e) {
      setOfxStatus({ kind: 'error', message: `Falha ao importar OFX: ${e?.message || String(e)}` });
    }
  }

  function carregarOfxExemploItau() {
    const extrato = parseOfxToExtrato(OFX_ITAU_REAL_EXEMPLO, { nomeBanco: 'Itaú' });
    if (!extrato.length) {
      setOfxStatus({ kind: 'error', message: 'OFX exemplo Itaú inválido.' });
      return;
    }
    let novos = 0;
    setInstituicaoSelecionada('Itaú');
    setExtratosPorBanco((prev) => {
      novos = contarLancamentosNovos(prev['Itaú'] ?? [], extrato);
      return aplicarExtratoNoBanco(prev, 'Itaú', extrato, 'mesclar');
    });
    setOfxStatus({
      kind: 'success',
      message: `Itaú: +${novos} lanç. novos (OFX real). Demais bancos preservados. Compensação buscada em todos os extratos.`,
    });
  }

  function carregarOfxExemploCora() {
    const extrato = parseOfxToExtrato(OFX_CORA_REAL_EXEMPLO, { nomeBanco: 'CORA' });
    if (!extrato.length) {
      setOfxStatus({ kind: 'error', message: 'OFX exemplo Cora inválido.' });
      return;
    }
    let novos = 0;
    setInstituicaoSelecionada('CORA');
    setExtratosPorBanco((prev) => {
      novos = contarLancamentosNovos(prev.CORA ?? [], extrato);
      return aplicarExtratoNoBanco(prev, 'CORA', extrato, 'mesclar');
    });
    setOfxStatus({
      kind: 'success',
      message: `CORA: +${novos} lanç. novos (OFX real). Demais bancos preservados. Compensação buscada em todos os extratos.`,
    });
  }

  // Persistência robusta: salva extratos (incluindo mocks importados e edições) no localStorage.
  useEffect(() => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      savePersistedExtratosFinanceiro(extratosPorBanco);
    }, 250);
    return () => {
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
  }, [extratosPorBanco]);

  useEffect(() => {
    if (linhaConsolidadoAlvo && linhaConsolidadoRef.current) {
      linhaConsolidadoRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [linhaConsolidadoAlvo, contaContabilSelecionada]);

  useEffect(() => {
    if (linhaBancoAlvo && linhaBancoRef.current && instituicaoSelecionada === linhaBancoAlvo.nomeBanco) {
      linhaBancoRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [linhaBancoAlvo, instituicaoSelecionada]);

  /** Vindo de Processos (duplo clique na Conta Corrente): abre consolidado + extrato na linha exata. */
  useEffect(() => {
    const alvo = location.state?.financeiroContaCorrenteLinha;
    if (!alvo?.nomeBanco || alvo.numero == null || alvo.numero === '' || !alvo.data) return;
    const nomeBanco = alvo.nomeBanco;
    const numero = String(alvo.numero);
    const data = alvo.data;
    setInstituicaoSelecionada(nomeBanco);
    setContaContabilSelecionada('Conta Escritório');
    const rowKey = `${nomeBanco}-${numero}-${data}`;
    setLinhaConsolidadoAlvo(rowKey);
    setLinhaConsolidadoFoco(rowKey);
    setLinhaBancoAlvo({ nomeBanco, numero, data });
    navigate(location.pathname, { replace: true, state: {} });
  }, [location.state, location.pathname, navigate]);

  return (
    <div className="min-h-full bg-slate-100 flex flex-col">
      <header className="px-4 py-3 bg-white border-b border-slate-200 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-800">Financeiro</h1>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <button
              type="button"
              onClick={() => fileInputOfxRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm"
              title={`Importar OFX em ${instituicaoSelecionada} (mescla por padrão)`}
            >
              Importar OFX ({instituicaoSelecionada})
            </button>
            <label className="flex items-center gap-2 text-xs text-slate-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={substituirExtratoOfxCompleto}
                onChange={(e) => setSubstituirExtratoOfxCompleto(e.target.checked)}
              />
              Substituir todo o extrato deste banco
            </label>
            <button
              type="button"
              onClick={carregarOfxExemploItau}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50"
              title="Mescla OFX real (estrutura Itaú, anonimizado) — não apaga mock"
            >
              + OFX real Itaú
            </button>
            <button
              type="button"
              onClick={carregarOfxExemploCora}
              className="px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50"
              title="Mescla OFX real (estrutura Cora, anonimizado) — não apaga mock"
            >
              + OFX real Cora
            </button>
            <button
              type="button"
              onClick={() => {
                const pares = detectarParesCompensacao(extratosPorBanco);
                setModalParearCompensacao({ pares });
              }}
              className="px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-900 text-sm font-medium hover:bg-amber-100"
              title="1) Identifica pares entre extratos; 2) Aplica Elo 0001… na Conta Compensação"
            >
              Parear compensações
            </button>
            {ofxStatus.kind !== 'idle' && (
              <span
                className={`text-xs ${
                  ofxStatus.kind === 'error'
                    ? 'text-red-700'
                    : ofxStatus.kind === 'success'
                      ? 'text-green-700'
                      : 'text-slate-600'
                }`}
              >
                {ofxStatus.message}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 p-6 space-y-8 overflow-auto">
        {/* Extratos bancários (OFX) */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Extratos bancários (OFX)</h2>
          <p className="text-xs text-slate-500 mb-3">
            Por padrão, cada importação <strong>acrescenta</strong> lançamentos (sem apagar mock nem OFX já
            importados). Duplicatas (mesmo FITID + data + valor) são ignoradas. Os dados são salvos no navegador.
            Após <strong>cada</strong> OFX, o sistema busca automaticamente <strong>novos pares de compensação</strong> em{' '}
            <strong>todos</strong> os extratos (mesmo dia, valor oposto exato, bancos diferentes). Use{' '}
            <strong>Substituir todo o extrato deste banco</strong> só se quiser trocar o extrato inteiro da instituição
            selecionada.
          </p>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <button
              type="button"
              onClick={() => fileInputOfxRef.current?.click()}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 shadow-sm"
              title={`Importar OFX e atualizar o extrato de ${instituicaoSelecionada}`}
            >
              Importar OFX ({instituicaoSelecionada})
            </button>
            <input
              ref={fileInputOfxRef}
              type="file"
              accept=".ofx,application/x-ofx,text/ofx,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) importarOfxArquivo(file);
              }}
            />
            {ofxStatus.kind !== 'idle' && (
              <span
                className={`text-xs ${
                  ofxStatus.kind === 'error'
                    ? 'text-red-700'
                    : ofxStatus.kind === 'success'
                      ? 'text-green-700'
                      : 'text-slate-600'
                }`}
              >
                {ofxStatus.message}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {INSTITUICOES_LINHA_1.map((nome) => (
              <button
                key={nome}
                type="button"
                onClick={() => setInstituicaoSelecionada(nome)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  instituicaoSelecionada === nome
                    ? 'bg-slate-200 text-amber-900 border-b-2 border-green-600'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {nome}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {INSTITUICOES_LINHA_2.map((nome) => (
              <button
                key={nome}
                type="button"
                onClick={() => setInstituicaoSelecionada(nome)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  instituicaoSelecionada === nome
                    ? 'bg-slate-200 text-amber-900 border-b-2 border-green-600'
                    : 'bg-red-600 text-white hover:bg-red-700'
                }`}
              >
                {nome}
              </button>
            ))}
          </div>
        </section>

        {/* Contas contábeis */}
        <section>
          <h2 className="text-sm font-semibold text-slate-700 mb-1">Contas contábeis</h2>
          <p className="text-xs text-slate-500 mb-3">
            Lista derivada dos extratos: ordem por lançamentos (mais usadas primeiro). Entre parênteses:
            quantidade e soma dos valores na conta, em todos os bancos.
          </p>
          <div className="flex flex-wrap gap-2">
            {contasLinha1.map(({ nome, letra, count, saldo }) => (
              <button
                key={nome}
                type="button"
                onClick={() => setContaContabilSelecionada(nome)}
                title={
                  count > 0
                    ? `Letra ${letra}: ${count} lançamento(s) · Σ valores ${formatValor(saldo)}`
                    : `Letra ${letra}: sem lançamentos nos extratos atuais`
                }
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  contaContabilSelecionada === nome
                    ? 'bg-green-400 text-slate-900 font-semibold'
                    : count > 0
                      ? 'bg-green-200 text-slate-800 hover:bg-green-300'
                      : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                }`}
              >
                <span className="hidden sm:inline">{nome}</span>
                <span className="sm:hidden" title={nome}>
                  {letra}
                </span>
                {count > 0 && (
                  <span className="text-xs opacity-90 ml-1 font-normal">
                    ({count} · {formatValor(saldo)})
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {contasLinha2.map(({ nome, letra, count, saldo }) => (
              <button
                key={nome}
                type="button"
                onClick={() => setContaContabilSelecionada(nome)}
                title={
                  count > 0
                    ? `Letra ${letra}: ${count} lançamento(s) · Σ valores ${formatValor(saldo)}`
                    : `Letra ${letra}: sem lançamentos nos extratos atuais`
                }
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  contaContabilSelecionada === nome
                    ? 'bg-green-400 text-slate-900 font-semibold'
                    : count > 0
                      ? 'bg-green-200 text-slate-800 hover:bg-green-300'
                      : 'bg-slate-200 text-slate-500 hover:bg-slate-300'
                }`}
              >
                <span className="hidden sm:inline">{nome}</span>
                <span className="sm:hidden" title={nome}>
                  {letra}
                </span>
                {count > 0 && (
                  <span className="text-xs opacity-90 ml-1 font-normal">
                    ({count} · {formatValor(saldo)})
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Extrato do banco selecionado */}
        {instituicaoSelecionada && (
          <section className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 min-w-0">
                <h2 className="text-base font-bold text-slate-800 uppercase shrink-0">
                  Conta Corrente {instituicaoSelecionada}
                </h2>
                <div className="flex items-center gap-2">
                  <label htmlFor="limite-lanc-extrato" className="text-xs text-slate-600 whitespace-nowrap">
                    Lançamentos na tela:
                  </label>
                  <select
                    id="limite-lanc-extrato"
                    value={limiteLancamentosExtratoBanco}
                    onChange={(e) => setLimiteLancamentosExtratoBanco(Number(e.target.value))}
                    className="text-sm border border-slate-300 rounded-md px-2 py-1.5 bg-white text-slate-800 min-w-[5.5rem] shadow-sm"
                    title="Quantidade máxima de linhas exibidas (ordem atual da tabela)"
                  >
                    {OPCOES_LIMITE_LANCAMENTOS_EXTRATO.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm text-slate-600">
                  <span className="font-medium text-red-600">-675,38</span>
                  {' · '}
                  <span className="font-medium text-slate-800">76.234,60 Fundos Investimentos</span>
                </span>
                <div className="flex items-center gap-1">
                  <button type="button" className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Anterior">‹</button>
                  <span className="text-sm text-slate-600 min-w-[3rem] text-center">4994</span>
                  <button type="button" className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Próximo">›</button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-20 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('letra')} title="Duplo clique: ordenar A→Z / Z→A">Letra</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-16 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('numero')} title="Duplo clique: ordenar">Nº</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-24 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('data')} title="Duplo clique: data mais recente primeiro; de novo: mais antiga primeiro">Data</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 min-w-[180px] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('descricao')} title="Duplo clique: ordenar A→Z / Z→A">Descrição</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-28 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('valor')} title="Duplo clique: ordenar crescente ↔ decrescente">Valor</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600 border-r border-slate-200 min-w-[140px] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('saldo')} title="Duplo clique: ordenar crescente ↔ decrescente">Saldo</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 min-w-[120px] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('categoria')} title="Duplo clique: ordenar A→Z / Z→A">Categoria / Obs.</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-20 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('codCliente')} title="Duplo clique: ordenar">Cod. Cliente</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-16 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('proc')} title="Duplo clique: ordenar">Proc.</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-20 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('dimensao')} title="Duplo clique: ordenar">Dimensão</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600 w-20 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloExtratoBanco('parcela')} title="Duplo clique: ordenar">Parcela</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const total = listaExtratoBancoOrdenada.length;
                    const maxLinhas =
                      limiteLancamentosExtratoBanco === 0 ? total : limiteLancamentosExtratoBanco;
                    return listaExtratoBancoOrdenada.slice(0, maxLinhas).map((t) => {
                    const isLinhaBancoAlvo = linhaBancoAlvo?.nomeBanco === instituicaoSelecionada && linhaBancoAlvo?.numero === t.numero && linhaBancoAlvo?.data === t.data;
                    return (
                    <tr
                      key={`${t.letra}-${t.numero}-${t.data}`}
                      ref={isLinhaBancoAlvo ? linhaBancoRef : undefined}
                      className={`border-b border-slate-100 hover:bg-slate-50/50 cursor-pointer ${isLinhaBancoAlvo ? 'ring-1 ring-blue-500 ring-inset bg-blue-50/70' : ''}`}
                      onDoubleClick={() => handleDuploCliqueLinhaBanco(t)}
                      title="Duplo clique para abrir a conta contábil e ir à linha no consolidado"
                    >
                      <td className="py-1.5 px-3 border-r border-slate-100 w-20" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={t.letra}
                          onChange={(e) => updateLetraLancamento(instituicaoSelecionada, t.numero, t.data, e.target.value)}
                          className="w-full min-w-[4rem] py-0.5 px-1 text-slate-700 text-sm bg-slate-50 border border-slate-200 rounded cursor-pointer text-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {LETRAS_VALIDAS.map((l) => (
                            <option key={l} value={l}>{l}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-1.5 px-3 text-slate-500 border-r border-slate-100">{t.numero}</td>
                      <td className="py-1.5 px-3 text-slate-700 border-r border-slate-100">{t.data}</td>
                      <td className="py-1.5 px-3 text-slate-700 border-r border-slate-100">{t.descricao}</td>
                      <td className={`py-1.5 px-3 text-right border-r border-slate-100 font-medium ${t.valor < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                        {formatValor(t.valor)}
                      </td>
                      <td className={`py-1.5 px-3 text-right border-r border-slate-100 ${t.saldo < 0 ? 'text-red-600' : 'text-slate-800'}`}>
                        {formatValor(t.saldo)} {t.saldoDesc}
                      </td>
                      <td className="py-1.5 px-3 text-slate-600 border-r border-slate-100 text-xs">{t.categoria}</td>
                      <td
                        className="py-1.5 px-3 text-center text-slate-500 border-r border-slate-100"
                        onDoubleClick={(e) => { e.stopPropagation(); handleDuploCliqueCodCliente(t.codCliente, t.proc); }}
                        title="Duplo clique para abrir o cadastro do cliente e processo"
                      >
                        <input
                          type="text"
                          value={t.codCliente ?? ''}
                          onChange={(e) => updateCampoLancamento(instituicaoSelecionada, t.numero, t.data, 'codCliente', e.target.value)}
                          className="w-16 px-1 py-0.5 text-sm text-center bg-slate-50 border border-slate-200 rounded"
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => { e.stopPropagation(); handleDuploCliqueCodCliente(t.codCliente, t.proc); }}
                        />
                      </td>
                      <td
                        className="py-1.5 px-3 text-center text-slate-500 border-r border-slate-100"
                        onDoubleClick={(e) => { e.stopPropagation(); handleDuploCliqueProc(t.codCliente, t.proc, t); }}
                        title="Duplo clique para abrir Processos (cliente e processo)"
                      >
                        <input
                          type="text"
                          value={t.proc ?? ''}
                          onChange={(e) => updateCampoLancamento(instituicaoSelecionada, t.numero, t.data, 'proc', e.target.value)}
                          className="w-12 px-1 py-0.5 text-sm text-center bg-slate-50 border border-slate-200 rounded"
                          onClick={(e) => e.stopPropagation()}
                          onDoubleClick={(e) => { e.stopPropagation(); handleDuploCliqueProc(t.codCliente, t.proc, t); }}
                        />
                      </td>
                      <td className="py-1.5 px-3 text-center text-slate-500 border-r border-slate-100">{t.dimensao}</td>
                      <td className="py-1.5 px-3 text-center text-slate-500">{t.parcela}</td>
                    </tr>
                  );
                  });
                  })()}
                </tbody>
              </table>
            </div>
            {(() => {
              const total = listaExtratoBancoOrdenada.length;
              const vis =
                limiteLancamentosExtratoBanco === 0
                  ? total
                  : Math.min(limiteLancamentosExtratoBanco, total);
              if (total <= vis) return null;
              return (
                <div className="px-4 py-2 text-xs text-slate-600 bg-slate-50 border-t border-slate-200">
                  Exibindo <strong>{vis}</strong> de <strong>{total}</strong> lançamentos. Aumente o limite ou escolha{' '}
                  <strong>Todos</strong> para ver o extrato completo.
                </div>
              );
            })()}
          </section>
        )}

        {/* Extrato consolidado da conta contábil selecionada */}
        {contaContabilSelecionada && (
          <section className="rounded-lg border border-green-200 shadow-sm overflow-hidden bg-green-50/30">
            <div className="px-4 py-3 border-b border-green-200 bg-white/80 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-800 min-w-0">
                  Extrato consolidado – {contaContabilSelecionada}
                </h2>
                <div className="flex items-center gap-2 shrink-0">
                  <label htmlFor="limite-lanc-consolidado" className="text-xs text-slate-600 whitespace-nowrap">
                    Lançamentos na tela:
                  </label>
                  <select
                    id="limite-lanc-consolidado"
                    value={limiteLancamentosConsolidado}
                    onChange={(e) => setLimiteLancamentosConsolidado(Number(e.target.value))}
                    className="text-sm border border-green-300 rounded-md px-2 py-1.5 bg-white text-slate-800 min-w-[5.5rem] shadow-sm"
                    title="Quantidade máxima de linhas no consolidado (ordem atual da tabela)"
                  >
                    {OPCOES_LIMITE_LANCAMENTOS_EXTRATO.map((o) => (
                      <option key={o.v} value={o.v}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {isContaCompensacao && (
                <div className="text-xs text-slate-600 space-y-1 rounded-md bg-amber-50/80 border border-amber-200 px-3 py-2">
                  <p>
                    <strong>Conta Compensação:</strong> débito e crédito entre bancos com o <strong>mesmo valor absoluto</strong>{' '}
                    (sem tolerância: centavos idênticos). O campo <strong>Cod. Cliente</strong> fica vazio; só o{' '}
                    <strong>Elo</strong> identifica o <strong>par</strong> (mesmo número nas duas pernas, soma = 0). OFX entra
                    como <strong>N</strong> — use <strong>Parear compensações</strong> para identificar e aplicar Elo{' '}
                    <strong>0001</strong>, <strong>0002</strong>… após importar os extratos.
                  </p>
                  {paresCompensacaoDesbalanceados.length > 0 && (
                    <p className="text-amber-900 font-medium">
                      Atenção: par(es) com soma ≠ 0 — Elo{' '}
                      {paresCompensacaoDesbalanceados.map(([p]) => p).join(', ')}
                    </p>
                  )}
                  {orfaosCompensacao > 0 && (
                    <p className="text-slate-700">
                      {orfaosCompensacao} lançamento(s) em <strong>Conta Compensação</strong> sem par (Elo ?n) — ajuste
                      manual ou classifique como outra conta até existir contraparte no mesmo dia com valor oposto{' '}
                      <strong>exato</strong>.
                    </p>
                  )}
                  {paresCompensacaoDesbalanceados.length === 0 &&
                    Object.keys(somasParComp).some((p) => /^\d+$/.test(String(p))) && (
                    <p className="text-green-800">
                      Todos os pares numéricos conferem (soma = 0 entre as duas pernas).
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-14 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('numeroBanco')} title="Duplo clique: ordenar crescente ↔ decrescente">Nº</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-16 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('numero')} title="Duplo clique: ordenar">Id.</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-24 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('data')} title="Duplo clique: ordenar crescente ↔ decrescente">Data</th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 min-w-[140px] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('descricao')} title="Duplo clique: ordenar A→Z / Z→A">Descrição</th>
                    <th className="text-right py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-28 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('valor')} title="Duplo clique: ordenar crescente ↔ decrescente">
                      Valor <span className="text-slate-400 font-normal">({formatValor(saldoConsolidado)})</span>
                    </th>
                    <th className="text-left py-2 px-3 font-medium text-slate-600 border-r border-slate-200 min-w-[200px] cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('descricaoDetalhada')} title="Duplo clique: ordenar A→Z / Z→A">Descrição / Contraparte</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-20 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('codCliente')} title="Duplo clique: ordenar">Cod. Cliente</th>
                    <th
                      className="text-center py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-16 cursor-pointer hover:bg-slate-100 select-none"
                      onDoubleClick={() => handleDuploCliqueTituloConsolidado('proc')}
                      title={isContaCompensacao ? 'Duplo clique: ordenar por Elo' : 'Duplo clique: ordenar por Proc.'}
                    >
                      {isContaCompensacao ? 'Elo' : 'Proc.'}
                    </th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-16">Ref.</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600 border-r border-slate-200 w-16 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('eq')} title="Duplo clique: ordenar">Eq.</th>
                    <th className="text-center py-2 px-3 font-medium text-slate-600 w-20 cursor-pointer hover:bg-slate-100 select-none" onDoubleClick={() => handleDuploCliqueTituloConsolidado('parcela')} title="Duplo clique: ordenar">Parcela</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const total = listaConsolidadaOrdenada.length;
                    const maxLinhas =
                      limiteLancamentosConsolidado === 0 ? total : limiteLancamentosConsolidado;
                    const listaVisivel = listaConsolidadaOrdenada.slice(0, maxLinhas);
                    return listaVisivel.map((t, idx) => {
                    const rowKey = `${t.nomeBanco}-${t.numero}-${t.data}`;
                    const isFoco = linhaConsolidadoFoco === rowKey;
                    const isAlvo = linhaConsolidadoAlvo === rowKey;
                    const prev = listaVisivel[idx - 1];
                    const mesmoGrupo = prev && prev.numeroBanco === t.numeroBanco && prev.letra === t.letra;
                    return (
                      <tr
                        key={rowKey}
                        ref={isAlvo ? linhaConsolidadoRef : undefined}
                        onClick={() => setLinhaConsolidadoFoco(rowKey)}
                        className={`border-b border-green-100/80 ${mesmoGrupo ? 'bg-sky-100/50' : 'bg-green-50/50'} hover:bg-green-100/50 ${isFoco ? 'ring-1 ring-green-500 ring-inset' : ''}`}
                      >
                        <td
                          className="py-1.5 px-3 text-slate-600 border-r border-green-100 cursor-pointer hover:bg-green-200/50"
                          onDoubleClick={(e) => { e.stopPropagation(); handleDuploCliqueNºConsolidado(t); }}
                          title="Duplo clique para abrir o extrato do banco nesta linha"
                        >
                          {t.numeroBanco}
                        </td>
                        <td className="py-1.5 px-3 text-slate-600 border-r border-green-100">{t.numero}</td>
                        <td className="py-1.5 px-3 text-slate-700 border-r border-green-100">{t.data}</td>
                        <td className="py-1.5 px-3 text-slate-700 border-r border-green-100">{t.descricao}</td>
                        <td className={`py-1.5 px-3 text-right border-r border-green-100 font-medium ${t.valor < 0 ? 'text-red-600' : 'text-slate-900'}`}>
                          {formatValor(t.valor)}
                        </td>
                        <td className="py-1.5 px-3 text-slate-600 border-r border-green-100 text-xs">{t.descricaoDetalhada ?? ''}</td>
                        <td
                          className={`py-1.5 px-3 text-center border-r border-green-100 ${
                            isContaCompensacao && t.letra === 'E'
                              ? 'text-slate-400'
                              : 'text-slate-500 cursor-pointer hover:bg-green-200/50'
                          }`}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (isContaCompensacao && t.letra === 'E') return;
                            handleDuploCliqueCodCliente(t.codCliente, t.proc);
                          }}
                          title={
                            isContaCompensacao && t.letra === 'E'
                              ? 'Conta Compensação: Cod. não utilizado'
                              : 'Duplo clique para abrir o cadastro do cliente e processo'
                          }
                        >
                          {isContaCompensacao && t.letra === 'E' ? '' : (t.codCliente ?? '')}
                        </td>
                        <td
                          className="py-1.5 px-3 text-center text-slate-500 border-r border-green-100 cursor-pointer hover:bg-green-200/50"
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (isContaCompensacao && t.letra === 'E') return;
                            handleDuploCliqueProc(t.codCliente, t.proc, t);
                          }}
                          title={
                            isContaCompensacao && t.letra === 'E'
                              ? 'Elo = identificador do par de compensação (não é processo judicial)'
                              : 'Duplo clique para abrir Processos (cliente e processo)'
                          }
                        >
                          {t.proc ?? ''}
                        </td>
                        <td className="py-1.5 px-3 text-center text-slate-500 border-r border-green-100">{REF_CONSTANTE}</td>
                        <td className="py-1.5 px-3 text-center text-slate-500 border-r border-green-100">{t.eq ?? ''}</td>
                        <td className="py-1.5 px-3 text-center text-slate-500">{t.parcela ?? ''}</td>
                      </tr>
                    );
                  });
                  })()}
                </tbody>
              </table>
            </div>
            {(() => {
              const total = listaConsolidadaOrdenada.length;
              const vis =
                limiteLancamentosConsolidado === 0
                  ? total
                  : Math.min(limiteLancamentosConsolidado, total);
              if (total === 0) {
                return (
                  <p className="py-6 text-center text-slate-500 text-sm">
                    Nenhum lançamento com letra desta conta nos extratos bancários.
                  </p>
                );
              }
              if (total > vis) {
                return (
                  <div className="px-4 py-2 text-xs text-slate-600 bg-green-50/80 border-t border-green-200">
                    Exibindo <strong>{vis}</strong> de <strong>{total}</strong> lançamentos no consolidado. Aumente o
                    limite ou escolha <strong>Todos</strong>.
                  </div>
                );
              }
              return null;
            })()}
          </section>
        )}
      </div>

      {modalParearCompensacao && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-parear-comp-titulo"
        >
          <div
            className="bg-white rounded-lg shadow-xl border border-amber-200 w-full max-w-4xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-amber-200 flex items-center justify-between shrink-0">
              <h2 id="modal-parear-comp-titulo" className="text-base font-bold text-slate-800">
                Parear compensações
              </h2>
              <button
                type="button"
                onClick={() => setModalParearCompensacao(null)}
                className="px-2 py-1 text-slate-500 hover:bg-slate-100 rounded text-lg leading-none"
                aria-label="Fechar"
              >
                ×
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 text-sm space-y-3">
              <p className="text-slate-600">
                <strong>Passo 1 — Identificação:</strong> pares com mesma data, valor oposto exato (centavos) e bancos
                diferentes. <strong>Passo 2 — Aplicar:</strong> classifica como Conta Compensação (E) e grava o{' '}
                <strong>Elo</strong> (0001, 0002…).
              </p>
              {modalParearCompensacao.pares.length === 0 ? (
                <p className="py-6 text-center text-amber-800 bg-amber-50 rounded border border-amber-200">
                  Nenhum par encontrado. Os lançamentos devem estar em <strong>N</strong> (ou E órfão), mesma data,
                  crédito e débito de mesmo valor absoluto em <strong>bancos diferentes</strong> (ex.: Itaú +16.068,01 e
                  Cora -16.068,01 em 17/03).
                </p>
              ) : (
                <div className="border border-slate-200 rounded overflow-hidden">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-amber-50 border-b border-slate-200">
                        <th className="text-left py-2 px-2 font-semibold text-slate-700">Elo</th>
                        <th className="text-left py-2 px-2 font-semibold text-slate-700">Data</th>
                        <th className="text-left py-2 px-2 font-semibold text-slate-700">Crédito</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-700">Valor</th>
                        <th className="text-left py-2 px-2 font-semibold text-slate-700">Débito</th>
                        <th className="text-right py-2 px-2 font-semibold text-slate-700">Valor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalParearCompensacao.pares.map((p) => (
                        <tr key={p.elo} className="border-b border-slate-100 hover:bg-slate-50">
                          <td className="py-2 px-2 font-mono font-semibold text-amber-900">{p.elo}</td>
                          <td className="py-2 px-2 text-slate-700">{p.data}</td>
                          <td className="py-2 px-2 text-slate-700">
                            {p.credito.banco}
                            <span className="block text-xs text-slate-500">{p.credito.descricao}</span>
                          </td>
                          <td className="py-2 px-2 text-right text-slate-900">{formatValor(p.credito.valor)}</td>
                          <td className="py-2 px-2 text-slate-700">
                            {p.debito.banco}
                            <span className="block text-xs text-slate-500">{p.debito.descricao}</span>
                          </td>
                          <td className="py-2 px-2 text-right text-red-600 font-medium">
                            {formatValor(p.debito.valor)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex flex-wrap justify-end gap-2 shrink-0 bg-slate-50">
              <button
                type="button"
                onClick={() => setModalParearCompensacao(null)}
                className="px-4 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={modalParearCompensacao.pares.length === 0}
                onClick={() => {
                  const n = modalParearCompensacao.pares.length;
                  setExtratosPorBanco((prev) => parearCompensacaoInterbancaria(cloneExtratos(prev)));
                  setModalParearCompensacao(null);
                  setOfxStatus({
                    kind: 'success',
                    message: `Compensação aplicada: ${n} par(es) — Elo atribuído (0001, 0002…) na Conta Compensação.`,
                  });
                }}
                className="px-4 py-2 rounded bg-amber-600 text-white text-sm font-semibold hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Aplicar {modalParearCompensacao.pares.length} compensação(ões)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { featureFlags } from '../config/featureFlags.js';
import { padCliente8Cadastro } from '../data/cadastroClientesStorage.js';
import { listarClientesIndiceCadastro } from '../repositories/clientesRepository.js';
import {
  extrairInadimplenciaPdf,
  importarInadimplenciaConfirmado,
  reverterImportacao,
} from '../repositories/condominioInadimplenciaRepository.js';
import {
  baixarRelatorioPdf,
  extrairCobranca,
  processarCobranca,
} from '../repositories/cobrancaRepository.js';
import { downloadPdfBlob } from '../repositories/documentosRepository.js';
import {
  extrairUnidadesPessoasPlanilha,
  importarUnidadesPessoasPlanilha,
} from '../repositories/condominioUnidadesPessoasRepository.js';
import { useUsuarioPerfil } from '../hooks/useUsuarioPerfil.js';
import { Upload } from 'lucide-react';

const inputClass =
  'w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100';

function formatBrlCentavos(centavos) {
  const n = Number(centavos);
  if (!Number.isFinite(n)) return '—';
  return (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function botaoPrimario() {
  return `rounded px-3 py-1.5 text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-600 dark:hover:bg-slate-500 disabled:opacity-50 disabled:pointer-events-none`;
}

function botaoSecundario() {
  return `rounded px-3 py-1.5 text-sm font-medium border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800`;
}

/**
 * Referência da sessão de importação, reversão por DELETE e relatório de contagens.
 * @param {{ importacaoId?: string | null }} props
 */
function BlocoReversaoImportacao({ importacaoId }) {
  const id = importacaoId && String(importacaoId).trim();
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const [revertido, setRevertido] = useState(false);
  const [erroLocal, setErroLocal] = useState(null);

  if (!id) return null;

  const confirmarReversao = async () => {
    setErroLocal(null);
    setLoading(true);
    try {
      const data = await reverterImportacao(id);
      setRelatorio(data);
      setRevertido(true);
      setModalOpen(false);
    } catch (e) {
      setErroLocal(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700 space-y-3">
      <p className="break-all text-xs text-slate-500 dark:text-slate-400">
        <span className="font-medium text-slate-600 dark:text-slate-500">Importação (referência / log):</span>{' '}
        <span className="font-mono">{id}</span>
      </p>

      {!revertido && (
        <button
          type="button"
          className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50"
          disabled={loading}
          onClick={() => {
            setErroLocal(null);
            setModalOpen(true);
          }}
        >
          Reverter esta importação
        </button>
      )}

      {revertido && (
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Importação revertida com sucesso</p>
      )}

      {erroLocal && <p className="text-sm text-red-700 dark:text-red-300">{erroLocal}</p>}

      {relatorio && (
        <div className="space-y-1 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/80">
          <p className="font-medium text-slate-800 dark:text-slate-200">Relatório da reversão</p>
          <ul className="space-y-0.5 text-slate-700 dark:text-slate-300">
            <li>
              Andamentos removidos: <strong>{relatorio.andamentosRemovidos ?? 0}</strong>
            </li>
            <li>
              Cálculos removidos: <strong>{relatorio.calculosRemovidos ?? 0}</strong>
            </li>
            <li>
              Partes removidas: <strong>{relatorio.partesRemovidas ?? 0}</strong>
            </li>
            <li>
              Processos removidos: <strong>{relatorio.processosRemovidos ?? 0}</strong>
            </li>
            <li>
              Contatos removidos: <strong>{relatorio.contatosRemovidos ?? 0}</strong>
            </li>
            <li>
              Endereços removidos: <strong>{relatorio.enderecosRemovidos ?? 0}</strong>
            </li>
            <li>
              Pessoas removidas: <strong>{relatorio.pessoasRemovidas ?? 0}</strong>
            </li>
          </ul>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reversao-importacao-titulo"
        >
          <div className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <p id="reversao-importacao-titulo" className="text-sm text-slate-800 dark:text-slate-100">
              Serão apagados todos os registros gravados com este <span className="font-mono text-xs">importacaoId</span>
              : processos, cálculos, partes, pessoas novas, contatos e endereços criados na importação de débitos e na
              planilha (sessão unificada). Deseja continuar?
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={botaoSecundario()}
                disabled={loading}
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50"
                disabled={loading}
                onClick={() => void confirmarReversao()}
              >
                {loading ? 'A reverter…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Reversão só dos débitos (PDF) antes da planilha — mesmo {@code importacaoId} que será reutilizado se continuar.
 * @param {{ importacaoId?: string | null, disabled?: boolean, onSucesso: () => void }} props
 */
function ReverterDebitosPrePlanilha({ importacaoId, disabled, onSucesso }) {
  const id = importacaoId && String(importacaoId).trim();
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erroLocal, setErroLocal] = useState(null);

  if (!id) return null;

  const confirmar = async () => {
    setErroLocal(null);
    setLoading(true);
    try {
      await reverterImportacao(id);
      setModalOpen(false);
      onSucesso();
    } catch (e) {
      setErroLocal(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded border border-amber-200 bg-amber-50/80 px-3 py-3 dark:border-amber-900 dark:bg-amber-950/40">
      <p className="text-sm text-amber-950 dark:text-amber-100">
        Se os débitos importados estiverem incorretos, pode desfazê-los <strong>antes</strong> de enviar a planilha de
        proprietários. A reversão usa o mesmo <span className="font-mono text-xs">{id}</span> que será reutilizado ao
        importar pessoas (se continuar nesta sessão).
      </p>
      {erroLocal && <p className="mt-2 text-sm text-red-700 dark:text-red-300">{erroLocal}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:pointer-events-none disabled:opacity-50 dark:border-red-800 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-red-950/50"
          disabled={disabled || loading}
          onClick={() => {
            setErroLocal(null);
            setModalOpen(true);
          }}
        >
          Reverter importação de débitos
        </button>
      </div>
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reversao-debitos-pre-xls-titulo"
        >
          <div className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <p id="reversao-debitos-pre-xls-titulo" className="text-sm text-slate-800 dark:text-slate-100">
              Serão apagados os <strong>processos</strong>, <strong>cálculos</strong> e <strong>partes</strong> criados
              nesta importação de débitos (identificador acima). Nada da planilha será removido, pois ainda não foi
              importada neste fluxo. Deseja continuar?
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={botaoSecundario()}
                disabled={loading}
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50"
                disabled={loading}
                onClick={() => void confirmar()}
              >
                {loading ? 'A reverter…' : 'Confirmar reversão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Soma valorCentavos das cobranças de uma unidade (API de extração). */
function somaCentavosUnidade(u) {
  const list = u?.cobrancas;
  if (!Array.isArray(list)) return 0;
  return list.reduce((acc, c) => acc + (Number(c?.valorCentavos) || 0), 0);
}

function formatDocDigitos(doc) {
  const d = String(doc ?? '').replace(/\D/g, '');
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return d || '—';
}

function contarPfPjDasUnidades(unidades) {
  let pf = 0;
  let pj = 0;
  for (const u of unidades || []) {
    const n = String(u?.proprietarioDocDigitos ?? '').replace(/\D/g, '').length;
    if (n === 11) pf += 1;
    else if (n === 14) pj += 1;
  }
  return { pf, pj };
}

function resumoExtracaoCobranca(extracao) {
  const unidades = extracao?.unidades || [];
  const debitos = unidades.reduce((acc, u) => acc + (Array.isArray(u.cobrancas) ? u.cobrancas.length : 0), 0);
  const { pf, pj } = contarPfPjDasUnidades(unidades);
  const t = extracao?.totais || extracao?.resumo || {};
  return {
    unidades: t.unidades ?? t.quantidadeUnidades ?? unidades.length,
    debitos: t.debitos ?? t.quantidadeDebitos ?? t.quantidadeCobrancas ?? debitos,
    pf: t.pf ?? t.quantidadePf ?? pf,
    pj: t.pj ?? t.quantidadePj ?? pj,
    valorTotalCentavos:
      t.valorTotalCentavos ??
      unidades.reduce((acc, u) => acc + somaCentavosUnidade(u), 0),
  };
}

function montarTextoResumoProcessamentoCobranca(resultado, clienteCodigo, clienteNome) {
  const linhas = [
    'Cobrança automática — resumo do processamento',
    `Cliente: ${clienteNome || '—'} (${clienteCodigo || '—'})`,
    `importacaoId: ${resultado?.importacaoId ?? '—'}`,
    '',
  ];
  for (const it of resultado?.itens || []) {
    const cod = it.codigoUnidade ?? it.codigoUnidadeNormalizada ?? '?';
    linhas.push(
      [
        `Unidade ${cod}`,
        `processoCriado=${it.processoCriado ?? false}`,
        `numeroInterno=${it.numeroInterno ?? '—'}`,
        `debitosInseridos=${it.debitosInseridos ?? it.inseridos ?? 0}`,
        `debitosIgnorados=${it.debitosIgnorados ?? it.ignorados ?? 0}`,
        `dimensao=${it.dimensao ?? '—'}`,
        `revisaoTrocaDono=${it.revisaoTrocaDono ?? false}`,
      ].join(' | '),
    );
  }
  const erros = resultado?.erros || [];
  if (erros.length) {
    linhas.push('', 'Erros:');
    for (const e of erros) {
      linhas.push(`${e.codigoUnidade ?? e.codigoUnidadeNormalizada ?? '?'}: ${e.mensagem}`);
    }
  }
  return linhas.join('\n');
}

function downloadTextoArquivo(texto, nomeArquivo) {
  const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

function contagemDebitosItem(it, campoContagem, campoLista) {
  const n = it?.[campoContagem];
  if (Number.isFinite(Number(n))) return Number(n);
  const lista = it?.[campoLista];
  return Array.isArray(lista) ? lista.length : 0;
}

/** Reconciliação documento = inseridos + ignorados + falhados (totais do relatório). */
function reconciliacaoCobranca(resultado) {
  const doc = resultado?.totaisDocumento;
  const exec = resultado?.totaisExecucao;
  const titulosDoc = doc?.titulos ?? doc?.debitos ?? 0;
  const inseridos = exec?.titulosInseridos ?? 0;
  const ignorados = exec?.titulosIgnorados ?? 0;
  const falhados = exec?.titulosFalhados ?? 0;
  const soma = inseridos + ignorados + falhados;
  return { titulosDoc, inseridos, ignorados, falhados, soma, fecha: titulosDoc === soma };
}

/**
 * @param {{
 *   clientesFiltrados: unknown[],
 *   loadingClientes: boolean,
 *   buscaCliente: string,
 *   onBuscaChange: (v: string) => void,
 *   clienteSel: { codigo?: string, nomeRazao?: string } | null,
 *   onSelectCliente: (c: { codigo?: string, nomeRazao?: string }) => void,
 * }} props
 */
function SeletorClienteLista({
  clientesFiltrados,
  loadingClientes,
  buscaCliente,
  onBuscaChange,
  clienteSel,
  onSelectCliente,
}) {
  return (
    <>
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
          Buscar cliente (nome ou código)
        </label>
        <input
          className={inputClass}
          value={buscaCliente}
          onChange={(e) => onBuscaChange(e.target.value)}
          placeholder="Ex.: 00000299 ou nome do condomínio"
          disabled={loadingClientes}
        />
      </div>
      <div className="max-h-48 overflow-auto rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
        {loadingClientes ? (
          <p className="p-3 text-sm text-slate-500">Carregando clientes…</p>
        ) : clientesFiltrados.length === 0 ? (
          <p className="p-3 text-sm text-slate-500">Nenhum cliente na lista.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {clientesFiltrados.map((c) => {
              const cod = padCliente8Cadastro(c.codigo);
              const ativo = clienteSel && padCliente8Cadastro(clienteSel.codigo) === cod;
              return (
                <li key={cod}>
                  <button
                    type="button"
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-900 ${
                      ativo ? 'bg-slate-100 dark:bg-slate-800 font-medium' : ''
                    }`}
                    onClick={() => onSelectCliente(c)}
                  >
                    <span className="tabular-nums text-slate-500 dark:text-slate-400">{cod}</span>
                    {' — '}
                    <span className="text-slate-800 dark:text-slate-100">{c.nomeRazao || '—'}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}

/**
 * Tela «Atividades em Lote» — ponto de entrada pelo menu lateral.
 */
export function AtividadesEmLote() {
  const { isAdmin } = useUsuarioPerfil();
  const apiOk =
    featureFlags.useApiClientes &&
    featureFlags.useApiProcessos &&
    featureFlags.useApiCalculos;

  /** null = lista de cards; `pdf` = inadimplência (PDF) + planilha de proprietários no mesmo fluxo. */
  const [fluxoTipo, setFluxoTipo] = useState(null);
  const [step, setStep] = useState(1);
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clienteSel, setClienteSel] = useState(null);
  const [arquivoPdf, setArquivoPdf] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [extracao, setExtracao] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [expandedUnidades, setExpandedUnidades] = useState(() => new Set());
  const [loadingExtrair, setLoadingExtrair] = useState(false);
  const [loadingImportar, setLoadingImportar] = useState(false);
  const [erro, setErro] = useState(null);
  /** Alinhado à arquitetura em que cliente (cadastro) e autora do processo podem ser pessoas distintas. */
  const [autorMesmaPessoaCliente, setAutorMesmaPessoaCliente] = useState(true);
  const pdfInputRef = useRef(null);

  const [arquivoXls, setArquivoXls] = useState(null);
  const [fileInputKeyXls, setFileInputKeyXls] = useState(0);
  const [extracaoXls, setExtracaoXls] = useState(null);
  const [importResultXls, setImportResultXls] = useState(null);
  const [loadingExtrairXls, setLoadingExtrairXls] = useState(false);
  const [loadingImportarXls, setLoadingImportarXls] = useState(false);
  /** Utilizador escolheu «Importar pessoas depois» no passo 4 — saltam-se os passos 5–6 da planilha. */
  const [pessoasImportOmitida, setPessoasImportOmitida] = useState(false);
  const xlsInputRef = useRef(null);

  const [cobStep, setCobStep] = useState(1);
  const [cobArquivoXls, setCobArquivoXls] = useState(null);
  const [cobFileInputKey, setCobFileInputKey] = useState(0);
  const [cobExtracao, setCobExtracao] = useState(null);
  const [cobProcessResult, setCobProcessResult] = useState(null);
  const [cobLoadingExtrair, setCobLoadingExtrair] = useState(false);
  const [cobLoadingProcessar, setCobLoadingProcessar] = useState(false);
  const [cobClienteSel, setCobClienteSel] = useState(null);
  const [cobBuscaCliente, setCobBuscaCliente] = useState('');
  const [cobErro, setCobErro] = useState(null);
  const [cobCopiado, setCobCopiado] = useState(false);
  const cobXlsInputRef = useRef(null);

  const resetFluxoCobranca = useCallback(() => {
    setCobStep(1);
    setCobArquivoXls(null);
    setCobFileInputKey((k) => k + 1);
    setCobExtracao(null);
    setCobProcessResult(null);
    setCobClienteSel(null);
    setCobBuscaCliente('');
    setCobErro(null);
    setCobCopiado(false);
  }, []);

  const resetFluxoInadimplencia = useCallback(() => {
    setStep(1);
    setExtracao(null);
    setImportResult(null);
    setClienteSel(null);
    setArquivoPdf(null);
    setFileInputKey((k) => k + 1);
    setBuscaCliente('');
    setExpandedUnidades(new Set());
    setErro(null);
    setAutorMesmaPessoaCliente(true);
    setArquivoXls(null);
    setFileInputKeyXls((k) => k + 1);
    setExtracaoXls(null);
    setImportResultXls(null);
    setPessoasImportOmitida(false);
  }, []);

  useEffect(() => {
    if (!fluxoTipo || !apiOk) return undefined;
    let cancelled = false;
    (async () => {
      setLoadingClientes(true);
      setErro(null);
      try {
        const list = await listarClientesIndiceCadastro();
        if (!cancelled) setClientes(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) setErro(e?.message || String(e));
      } finally {
        if (!cancelled) setLoadingClientes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fluxoTipo, apiOk]);

  const clientesFiltradosCobranca = useMemo(() => {
    const q = cobBuscaCliente.trim().toLowerCase();
    const digitos = q.replace(/\D/g, '');
    const base = clientes;
    if (!q) return base.slice(0, 100);
    return base
      .filter((c) => {
        const cod = String(c.codigo ?? '');
        const nome = String(c.nomeRazao ?? '').toLowerCase();
        if (digitos.length > 0 && cod.includes(digitos)) return true;
        return nome.includes(q);
      })
      .slice(0, 100);
  }, [clientes, cobBuscaCliente]);

  const resumoCobExtracao = useMemo(
    () => (cobExtracao ? resumoExtracaoCobranca(cobExtracao) : null),
    [cobExtracao],
  );

  const clientesFiltrados = useMemo(() => {
    const q = buscaCliente.trim().toLowerCase();
    const digitos = q.replace(/\D/g, '');
    const base = clientes;
    if (!q) return base.slice(0, 100);
    return base
      .filter((c) => {
        const cod = String(c.codigo ?? '');
        const nome = String(c.nomeRazao ?? '').toLowerCase();
        if (digitos.length > 0 && cod.includes(digitos)) return true;
        return nome.includes(q);
      })
      .slice(0, 100);
  }, [clientes, buscaCliente]);

  /** Unidades que vieram no PDF com pelo menos uma cobrança (é para estas que existe processo após o passo 3). */
  const codigosUnidadesComDebitoNoPdf = useMemo(() => {
    const s = new Set();
    for (const u of extracao?.unidades || []) {
      const c = String(u?.codigoUnidade ?? '').trim();
      if (c) s.add(c);
    }
    return s;
  }, [extracao]);

  /** Linhas da planilha cuja unidade não apareceu no PDF desta sessão — não haverá processo para vincular o RÉU. */
  const unidadesPlanilhaSemDebitoNoPdf = useMemo(() => {
    if (!extracaoXls?.unidades) return [];
    const sem = [];
    for (const u of extracaoXls.unidades) {
      const c = String(u?.codigoUnidade ?? '').trim();
      if (c && !codigosUnidadesComDebitoNoPdf.has(c)) sem.push(c);
    }
    return sem;
  }, [extracaoXls, codigosUnidadesComDebitoNoPdf]);

  const onAnalisarPdf = useCallback(async () => {
    if (!clienteSel?.codigo || !arquivoPdf) return;
    setErro(null);
    setLoadingExtrair(true);
    try {
      const data = await extrairInadimplenciaPdf(padCliente8Cadastro(clienteSel.codigo), arquivoPdf);
      setExtracao(data);
      // Por padrão todas as unidades vêm expandidas (tabela de taxas visível).
      setExpandedUnidades(
        new Set((data.unidades || []).map((u) => u.codigoUnidade || '?')),
      );
      setStep(2);
    } catch (e) {
      setErro(e?.message || String(e));
    } finally {
      setLoadingExtrair(false);
    }
  }, [clienteSel, arquivoPdf]);

  /** Com cliente já escolhido: 1.º clique abre o PDF; com arquivo, envia para análise. */
  const onClicarAnalisarOuEscolherPdf = useCallback(() => {
    if (!clienteSel?.codigo) return;
    if (!arquivoPdf) {
      pdfInputRef.current?.click();
      return;
    }
    void onAnalisarPdf();
  }, [clienteSel, arquivoPdf, onAnalisarPdf]);

  const onConfirmarImportar = useCallback(async () => {
    if (!extracao?.clienteCodigo || !Array.isArray(extracao.unidades)) return;
    setErro(null);
    setLoadingImportar(true);
    try {
      const body = {
        clienteCodigo: extracao.clienteCodigo,
        unidades: extracao.unidades,
        autorMesmaPessoaCliente,
      };
      const data = await importarInadimplenciaConfirmado(body);
      setImportResult(data);
      setStep(4);
    } catch (e) {
      setErro(e?.message || String(e));
    } finally {
      setLoadingImportar(false);
    }
  }, [extracao, autorMesmaPessoaCliente]);

  const toggleUnidade = useCallback((cod) => {
    setExpandedUnidades((prev) => {
      const next = new Set(prev);
      if (next.has(cod)) next.delete(cod);
      else next.add(cod);
      return next;
    });
  }, []);

  const onExtrairPlanilhaNoFluxoPdf = useCallback(async () => {
    if (!extracao?.clienteCodigo || !arquivoXls) return;
    setErro(null);
    setLoadingExtrairXls(true);
    try {
      const data = await extrairUnidadesPessoasPlanilha(padCliente8Cadastro(extracao.clienteCodigo), arquivoXls);
      setExtracaoXls(data);
      setPessoasImportOmitida(false);
      setStep(5);
    } catch (e) {
      setErro(e?.message || String(e));
    } finally {
      setLoadingExtrairXls(false);
    }
  }, [extracao, arquivoXls]);

  /** 1.º clique abre o seletor de ficheiro; com planilha já escolhida, chama a extração na API (como no PDF). */
  const onClicarExtrairOuEscolherPlanilha = useCallback(() => {
    if (!extracao?.clienteCodigo) return;
    if (!arquivoXls) {
      xlsInputRef.current?.click();
      return;
    }
    void onExtrairPlanilhaNoFluxoPdf();
  }, [extracao, arquivoXls, onExtrairPlanilhaNoFluxoPdf]);

  const onImportarPlanilhaNoFluxoPdf = useCallback(async () => {
    if (!extracaoXls?.clienteCodigo || !Array.isArray(extracaoXls.unidades) || !importResult?.importacaoId) return;
    setErro(null);
    setLoadingImportarXls(true);
    try {
      const data = await importarUnidadesPessoasPlanilha({
        clienteCodigo: extracaoXls.clienteCodigo,
        unidades: extracaoXls.unidades,
        importacaoId: importResult.importacaoId,
      });
      setImportResultXls(data);
    } catch (e) {
      setErro(e?.message || String(e));
    } finally {
      setLoadingImportarXls(false);
    }
  }, [extracaoXls, importResult]);

  const irParaPasso6SemPlanilha = useCallback(() => {
    setExtracaoXls(null);
    setArquivoXls(null);
    setFileInputKeyXls((k) => k + 1);
    setImportResultXls(null);
    setPessoasImportOmitida(true);
    setStep(6);
  }, []);

  const onExtrairCobrancaXls = useCallback(async () => {
    if (!cobArquivoXls) return;
    setCobErro(null);
    setCobLoadingExtrair(true);
    try {
      const data = await extrairCobranca(cobArquivoXls);
      setCobExtracao(data);
      setCobProcessResult(null);
      setCobStep(2);
    } catch (e) {
      setCobErro(e?.message || String(e));
    } finally {
      setCobLoadingExtrair(false);
    }
  }, [cobArquivoXls]);

  const onClicarExtrairOuEscolherCobrancaXls = useCallback(() => {
    if (!cobArquivoXls) {
      cobXlsInputRef.current?.click();
      return;
    }
    void onExtrairCobrancaXls();
  }, [cobArquivoXls, onExtrairCobrancaXls]);

  const onProcessarCobranca = useCallback(async () => {
    if (!cobClienteSel?.codigo || !Array.isArray(cobExtracao?.unidades)) return;
    setCobErro(null);
    setCobLoadingProcessar(true);
    try {
      const data = await processarCobranca({
        clienteCodigo: padCliente8Cadastro(cobClienteSel.codigo),
        unidades: cobExtracao.unidades,
        arquivoNome: cobArquivoXls?.name || undefined,
      });
      setCobProcessResult(data);
      setCobStep(3);
      if (data?.importacaoId) {
        try {
          const { blob, filename } = await baixarRelatorioPdf(data.importacaoId);
          downloadPdfBlob(blob, filename);
        } catch (pdfErr) {
          setCobErro(
            (prev) =>
              prev ||
              `Processamento OK, mas o PDF não foi baixado: ${pdfErr?.message || String(pdfErr)}`,
          );
        }
      }
    } catch (e) {
      setCobErro(e?.message || String(e));
    } finally {
      setCobLoadingProcessar(false);
    }
  }, [cobClienteSel, cobExtracao, cobArquivoXls]);

  const onBaixarRelatorioPdfCobranca = useCallback(async () => {
    const id = cobProcessResult?.importacaoId;
    if (!id) return;
    setCobErro(null);
    try {
      const { blob, filename } = await baixarRelatorioPdf(id);
      downloadPdfBlob(blob, filename);
    } catch (e) {
      setCobErro(e?.message || String(e));
    }
  }, [cobProcessResult?.importacaoId]);

  const textoResumoCobranca = useMemo(() => {
    if (!cobProcessResult) return '';
    const cod = cobClienteSel ? padCliente8Cadastro(cobClienteSel.codigo) : '';
    return montarTextoResumoProcessamentoCobranca(cobProcessResult, cod, cobClienteSel?.nomeRazao);
  }, [cobProcessResult, cobClienteSel]);

  const reconcCob = useMemo(
    () => (cobProcessResult ? reconciliacaoCobranca(cobProcessResult) : null),
    [cobProcessResult],
  );

  const copiarResumoCobranca = useCallback(async () => {
    if (!textoResumoCobranca) return;
    try {
      await navigator.clipboard.writeText(textoResumoCobranca);
      setCobCopiado(true);
      setTimeout(() => setCobCopiado(false), 2000);
    } catch {
      setCobErro('Não foi possível copiar para a área de transferência.');
    }
  }, [textoResumoCobranca]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <header>
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Atividades em Lote</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Importação de dados em grande quantidade, com confirmação antes de concluir.
        </p>
        {isAdmin ? (
          <div className="mt-3 max-w-3xl rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-900/60 dark:text-slate-300">
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              Histórico de processos (Excel, grandes volumes) — administrador:
            </span>{' '}
            use o script Python{' '}
            <code className="rounded bg-white px-1 dark:bg-slate-800">~/Downloads/migrar_historico_processos.py</code> para gerar o SQL e
            aplicar no MySQL. O script imprime o{' '}
            <code className="rounded bg-white px-1 dark:bg-slate-800">importacao_id</code> (UUID) da sessão. Para reverter só esses
            andamentos importados:{' '}
            <code className="rounded bg-white px-1 dark:bg-slate-800">
              {`DELETE /api/condominio/inadimplencia/reverter/{importacaoId}`}
            </code>{' '}
            (mesmo endpoint da reversão de importações em lote).
          </div>
        ) : null}
      </header>

      {!apiOk && (
        <div className="rounded border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Para usar importação de inadimplência é necessário API de clientes, processos e cálculos ativa
          (`VITE_USE_API_CLIENTES`, `VITE_USE_API_PROCESSOS`, `VITE_USE_API_CALCULOS`).
        </div>
      )}

      {apiOk && !fluxoTipo && (
        <div className={`max-w-5xl ${isAdmin ? '' : 'mx-auto w-full'}`}>
          {!isAdmin ? (
            <p className="mb-4 text-sm text-slate-600 dark:text-slate-400 text-center">
              Escolha o tipo de importação de inadimplência do condomínio.
            </p>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <button
              type="button"
              onClick={() => {
                resetFluxoInadimplencia();
                setFluxoTipo('pdf');
              }}
              className={`flex w-full flex-col items-start gap-2 rounded-xl border-2 border-emerald-600/40 bg-white dark:bg-slate-900 p-5 text-left shadow-md hover:border-emerald-500 hover:shadow-lg transition-all cursor-pointer ${
                isAdmin ? '' : 'ring-2 ring-emerald-500/20'
              }`}
            >
              <span className="inline-flex items-center gap-2 font-semibold text-emerald-800 dark:text-emerald-200">
                <Upload className="h-5 w-5 shrink-0" aria-hidden />
                Importar inadimplência condominial (PDF)
              </span>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {!isAdmin ? (
                  <>
                    <strong>1.</strong> Selecione o PDF · <strong>2.</strong> Confira · <strong>3.</strong> Confirme
                  </>
                ) : (
                  <>
                    Analisa o PDF, grava processos e débitos, depois importa proprietários pela planilha XLS no mesmo
                    fluxo — uma referência para reverter tudo junto.
                  </>
                )}
              </span>
            </button>
            <button
              type="button"
              onClick={() => {
                resetFluxoCobranca();
                setFluxoTipo('cobranca-auto');
              }}
              className="flex w-full flex-col items-start gap-2 rounded-xl border-2 border-sky-600/40 bg-white dark:bg-slate-900 p-5 text-left shadow-md hover:border-sky-500 hover:shadow-lg transition-all cursor-pointer"
            >
              <span className="inline-flex items-center gap-2 font-semibold text-sky-800 dark:text-sky-200">
                <Upload className="h-5 w-5 shrink-0" aria-hidden />
                Cobrança automática (inadimplência)
              </span>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                Relatório <strong>.xls</strong> do condomínio: extrai unidades e débitos, resolve devedor/processo e
                mescla cobranças no cálculo (sem planilha de pessoas).
              </span>
            </button>
          </div>
        </div>
      )}

      {apiOk && fluxoTipo === 'pdf' && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Importar inadimplência condominial (PDF)
            </h2>
            <button
              type="button"
              className={botaoSecundario()}
              onClick={() => {
                resetFluxoInadimplencia();
                setFluxoTipo(null);
              }}
            >
              Voltar à lista
            </button>
          </div>

          {erro && (
            <div className="rounded border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800 dark:text-red-100">
              {erro}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">Passo 1 — Configuração</span>
                : selecione o cliente (condomínio), envie o PDF e clique em Analisar.
              </p>
              <SeletorClienteLista
                clientesFiltrados={clientesFiltrados}
                loadingClientes={loadingClientes}
                buscaCliente={buscaCliente}
                onBuscaChange={setBuscaCliente}
                clienteSel={clienteSel}
                onSelectCliente={setClienteSel}
              />
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Arquivo PDF
                </label>
                <input
                  ref={pdfInputRef}
                  key={fileInputKey}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="block w-full text-sm text-slate-600 dark:text-slate-300"
                  onChange={(e) => setArquivoPdf(e.target.files?.[0] ?? null)}
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Depois do cliente, use o botão abaixo para abrir a janela de seleção do PDF (ou o controle de arquivo
                  acima). O nome do arquivo só aparece depois que você escolher um PDF — antes disso o navegador mostra
                  Nenhum arquivo escolhido.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={botaoPrimario()}
                  disabled={!clienteSel || loadingExtrair}
                  onClick={onClicarAnalisarOuEscolherPdf}
                >
                  {loadingExtrair
                    ? 'Analisando…'
                    : !arquivoPdf
                      ? 'Escolher PDF…'
                      : 'Analisar PDF'}
                </button>
              </div>
            </div>
          )}

          {step === 2 && extracao && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">Passo 2 — Revisão do extrato</span>
                : confira os dados extraídos do PDF, as cobranças por unidade e a opção de autora. Em seguida você verá
                o resumo para confirmar antes de gravar.
              </p>
              <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Condomínio (cliente)</dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-100">
                    {extracao.clienteNome || '—'}{' '}
                    <span className="tabular-nums text-slate-500 font-normal">
                      ({extracao.clienteCodigo || '—'})
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Nome no PDF</dt>
                  <dd className="text-slate-800 dark:text-slate-100">{extracao.condominioNome || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Data de referência (PDF)</dt>
                  <dd className="tabular-nums text-slate-800 dark:text-slate-100">
                    {extracao.dataReferenciaPdf || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Resumo</dt>
                  <dd className="text-slate-800 dark:text-slate-100">
                    {extracao.resumo?.quantidadeUnidades ?? 0} unidades, {extracao.resumo?.quantidadeCobrancas ?? 0}{' '}
                    cobranças, total {formatBrlCentavos(extracao.resumo?.valorTotalCentavos)}
                  </dd>
                </div>
              </dl>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Unidades e cobranças</h3>
                <ul className="space-y-2">
                  {(extracao.unidades || []).map((u) => {
                    const cod = u.codigoUnidade || '?';
                    const aberto = expandedUnidades.has(cod);
                    const n = Array.isArray(u.cobrancas) ? u.cobrancas.length : 0;
                    return (
                      <li
                        key={cod}
                        className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 overflow-hidden"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900"
                          onClick={() => toggleUnidade(cod)}
                        >
                          <span>
                            Unidade <span className="tabular-nums">{cod}</span>
                            <span className="font-normal text-slate-500 dark:text-slate-400">
                              {' '}
                              — {n} cobrança(s)
                            </span>
                          </span>
                          <span className="text-slate-400">{aberto ? '▼' : '▶'}</span>
                        </button>
                        {aberto && n > 0 && (
                          <div className="border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
                            <table className="min-w-full text-xs">
                              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                                <tr>
                                  <th className="text-left px-2 py-1.5 font-medium">Receita</th>
                                  <th className="text-left px-2 py-1.5 font-medium">Doc</th>
                                  <th className="text-left px-2 py-1.5 font-medium">Período</th>
                                  <th className="text-left px-2 py-1.5 font-medium">Vencimento</th>
                                  <th className="text-right px-2 py-1.5 font-medium">Valor</th>
                                  <th className="text-right px-2 py-1.5 font-medium">Multa</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {u.cobrancas.map((row, idx) => (
                                  <tr key={`${cod}-${idx}`} className="text-slate-800 dark:text-slate-200">
                                    <td className="px-2 py-1.5 max-w-[200px] truncate" title={row.receita}>
                                      {row.receita}
                                    </td>
                                    <td className="px-2 py-1.5 tabular-nums">{row.doc}</td>
                                    <td className="px-2 py-1.5 tabular-nums">{row.periodo}</td>
                                    <td className="px-2 py-1.5 tabular-nums">{row.vencimento}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{row.valor}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{row.multa}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <fieldset className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-3 space-y-2">
                <legend className="px-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                  Autora do processo
                </legend>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  O cadastro de cliente (condomínio) usa uma pessoa; o processo pode ter outra pessoa como autora.
                  Confirme antes de gravar.
                </p>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800 dark:text-slate-100">
                  <input
                    type="radio"
                    name="autor-mesma-pessoa"
                    className="mt-1"
                    checked={autorMesmaPessoaCliente}
                    onChange={() => setAutorMesmaPessoaCliente(true)}
                  />
                  <span>
                    Sim — a <strong>autora</strong> é a <strong>mesma pessoa</strong> vinculada a este cliente (
                    {extracao.clienteNome || 'cliente selecionado'}).
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800 dark:text-slate-100">
                  <input
                    type="radio"
                    name="autor-mesma-pessoa"
                    className="mt-1"
                    checked={!autorMesmaPessoaCliente}
                    onChange={() => setAutorMesmaPessoaCliente(false)}
                  />
                  <span>
                    Não — são <strong>pessoas distintas</strong>. O processo será criado sem parte autora e sem nome no
                    cabeçalho do cálculo; complete depois na tela de processos.
                  </span>
                </label>
              </fieldset>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  className={botaoSecundario()}
                  disabled={loadingImportar}
                  onClick={() => {
                    setStep(1);
                    setExtracao(null);
                    setExpandedUnidades(new Set());
                    setAutorMesmaPessoaCliente(true);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={botaoPrimario()}
                  disabled={!(extracao.unidades && extracao.unidades.length)}
                  onClick={() => setStep(3)}
                >
                  Continuar para confirmação final
                </button>
              </div>
            </div>
          )}

          {step === 3 && extracao && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">Passo 3 — Confirmação final</span>
                : leia o resumo abaixo. Nada será gravado até você acionar o botão de confirmação no final desta página.
              </p>

              <div className="rounded-lg border border-amber-200 bg-amber-50/90 dark:border-amber-900 dark:bg-amber-950/50 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                Ao confirmar, serão criados ou atualizados <strong>processos</strong> e <strong>rodadas de cálculo</strong>{' '}
                conforme cada unidade listada. Em seguida o assistente pedirá a <strong>planilha XLS</strong> de
                proprietários (mesmo cliente); pode adiar essa etapa se preferir.
              </div>

              <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Cliente</dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-100">
                    {extracao.clienteNome || '—'}{' '}
                    <span className="tabular-nums text-slate-500 font-normal">
                      ({extracao.clienteCodigo || '—'})
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Referência no PDF</dt>
                  <dd className="text-slate-800 dark:text-slate-100">
                    {extracao.condominioNome || '—'}
                    {extracao.dataReferenciaPdf ? (
                      <span className="tabular-nums text-slate-500"> · {extracao.dataReferenciaPdf}</span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Totais a importar</dt>
                  <dd className="text-slate-800 dark:text-slate-100">
                    <strong>{extracao.resumo?.quantidadeUnidades ?? 0}</strong> unidades ·{' '}
                    <strong>{extracao.resumo?.quantidadeCobrancas ?? 0}</strong> cobranças · total{' '}
                    <strong>{formatBrlCentavos(extracao.resumo?.valorTotalCentavos)}</strong>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Autora do processo</dt>
                  <dd className="text-slate-800 dark:text-slate-100">
                    {autorMesmaPessoaCliente ? (
                      <>
                        Mesma pessoa do cliente — <span className="font-medium">{extracao.clienteNome || '—'}</span>{' '}
                        (parte AUTOR e nome no cabeçalho do cálculo).
                      </>
                    ) : (
                      <>
                        <strong>Pessoa distinta</strong> do cliente — processos sem parte autora e sem nome no
                        cabeçalho do cálculo até cadastro manual.
                      </>
                    )}
                  </dd>
                </div>
              </dl>

              <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Resumo por unidade (o que será importado)
                </h3>
                <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Unidade</th>
                        <th className="text-right px-3 py-2 font-medium">Cobranças</th>
                        <th className="text-right px-3 py-2 font-medium">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(extracao.unidades || []).map((u) => {
                        const cod = u.codigoUnidade || '—';
                        const n = Array.isArray(u.cobrancas) ? u.cobrancas.length : 0;
                        const sub = somaCentavosUnidade(u);
                        return (
                          <tr key={cod} className="text-slate-800 dark:text-slate-200">
                            <td className="px-3 py-2 font-mono text-xs sm:text-sm">{cod}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{n}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">
                              {formatBrlCentavos(sub)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/80">
                      <tr className="font-medium text-slate-900 dark:text-slate-100">
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {extracao.resumo?.quantidadeCobrancas ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatBrlCentavos(extracao.resumo?.valorTotalCentavos)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  className={botaoSecundario()}
                  disabled={loadingImportar}
                  onClick={() => setStep(2)}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className={botaoPrimario()}
                  disabled={loadingImportar || !(extracao.unidades && extracao.unidades.length)}
                  onClick={onConfirmarImportar}
                >
                  {loadingImportar ? 'Importando…' : 'Confirmar importação'}
                </button>
              </div>
            </div>
          )}

          {step === 4 && importResult && extracao && (
            <div className="space-y-6">
              <div className="space-y-3 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  <span className="font-medium text-slate-800 dark:text-slate-200">Passo 3 — Débitos importados</span>
                </p>
                <p className="text-sm text-slate-800 dark:text-slate-100">
                  Processos novos: <strong>{importResult.processosCriados ?? 0}</strong>
                  {' · '}
                  Cobranças lançadas (total): <strong>{importResult.cobrancasLancadasTotal ?? 0}</strong>
                </p>
                <p className="break-all text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-medium text-slate-600 dark:text-slate-500">importacaoId</span>{' '}
                  <span className="font-mono">{importResult.importacaoId ?? '—'}</span>
                </p>
                {(importResult.itens || []).length > 0 && (
                  <div>
                    <h3 className="text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">
                      Por unidade
                    </h3>
                    <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
                      {importResult.itens.map((it, i) => (
                        <li
                          key={`${it.codigoUnidade}-${i}`}
                          className="flex flex-wrap gap-x-3 gap-y-1 text-slate-800 dark:text-slate-200"
                        >
                          <span className="tabular-nums font-medium">{it.codigoUnidade}</span>
                          <span className="text-slate-500 dark:text-slate-400">
                            proc. {it.numeroInterno ?? '—'}
                            {it.processoCriado ? ' (novo)' : ''}
                          </span>
                          <span>{it.cobrancasLancadas ?? 0} cobrança(s)</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(importResult.erros || []).length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-red-700 dark:text-red-300">Erros (débitos)</h3>
                    <ul className="space-y-1 text-sm text-red-800 dark:text-red-200">
                      {importResult.erros.map((e, i) => (
                        <li key={i}>
                          <span className="tabular-nums font-medium">{e.codigoUnidade}</span>: {e.mensagem}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <ReverterDebitosPrePlanilha
                importacaoId={importResult.importacaoId}
                disabled={loadingExtrairXls}
                onSucesso={() => {
                  setImportResult(null);
                  setExtracaoXls(null);
                  setArquivoXls(null);
                  setFileInputKeyXls((k) => k + 1);
                  setImportResultXls(null);
                  setPessoasImportOmitida(false);
                  setStep(3);
                  setErro(null);
                }}
              />

              <div className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  <span className="font-medium text-slate-800 dark:text-slate-200">Passo 4 — Planilha de proprietários</span>
                  : envie o ficheiro <strong>.xls</strong> ou <strong>.xlsx</strong> do cadastro de unidades (mesmo
                  condomínio:{' '}
                  <span className="tabular-nums text-slate-500">{extracao.clienteCodigo}</span>
                  {extracao.clienteNome ? ` — ${extracao.clienteNome}` : ''}). Os processos criados acima serão usados
                  para vincular o proprietário (RÉU) por unidade.
                </p>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Planilha (.xls ou .xlsx)
                  </label>
                  <input
                    ref={xlsInputRef}
                    key={fileInputKeyXls}
                    type="file"
                    accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    className="block w-full text-sm text-slate-600 dark:text-slate-300"
                    onChange={(e) => setArquivoXls(e.target.files?.[0] ?? null)}
                  />
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    O botão principal abre a pasta de ficheiros se ainda não houver planilha; depois de escolher,
                    torna-se «Extrair planilha». Também pode usar o controlo acima.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={botaoPrimario()}
                    disabled={loadingExtrairXls}
                    onClick={() => void onClicarExtrairOuEscolherPlanilha()}
                  >
                    {loadingExtrairXls
                      ? 'A extrair…'
                      : !arquivoXls
                        ? 'Escolher planilha…'
                        : 'Extrair planilha'}
                  </button>
                  <button
                    type="button"
                    className={botaoSecundario()}
                    disabled={loadingExtrairXls}
                    onClick={irParaPasso6SemPlanilha}
                  >
                    Importar pessoas depois
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 5 && importResult && extracaoXls && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-800 dark:text-slate-200">Passo 5 — Revisão da planilha</span>
              </p>
              {extracao && unidadesPlanilhaSemDebitoNoPdf.length > 0 && (
                <div className="rounded border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                  <p className="font-medium text-amber-950 dark:text-amber-50">
                    {unidadesPlanilhaSemDebitoNoPdf.length} unidade(s) da planilha{' '}
                    <strong>não constam no PDF de inadimplência</strong> desta sessão.
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">
                    O passo 3 só cria processo por unidade que aparece no relatório com cobrança. Para as unidades em
                    falta, a importação de pessoas não consegue vincular o proprietário (RÉU) até existir processo —
                    inclua-as num PDF com débito ou crie o processo manualmente.
                  </p>
                  <p className="mt-2 font-mono text-xs break-all text-amber-900/90 dark:text-amber-200/90">
                    {unidadesPlanilhaSemDebitoNoPdf.slice(0, 40).join(', ')}
                    {unidadesPlanilhaSemDebitoNoPdf.length > 40
                      ? ` … (+${unidadesPlanilhaSemDebitoNoPdf.length - 40})`
                      : ''}
                  </p>
                </div>
              )}
              <dl className="grid gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Cliente</dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-100">
                    {extracaoXls.clienteNome || '—'}{' '}
                    <span className="font-normal tabular-nums text-slate-500">
                      ({extracaoXls.clienteCodigo || '—'})
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Resumo</dt>
                  <dd className="text-slate-800 dark:text-slate-100">
                    {extracaoXls.resumo?.linhasLidas ?? 0} linhas · {extracaoXls.resumo?.unidadesDistintas ?? 0}{' '}
                    unidades · prop. novos (estim.):{' '}
                    {extracaoXls.resumo?.pessoasProprietarioNovasEstimadas ?? 0}
                  </dd>
                </div>
              </dl>
              <div className="max-h-80 overflow-x-auto overflow-y-auto rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-medium">Unidade</th>
                      <th className="px-2 py-1.5 text-left font-medium">Proprietário</th>
                      <th className="px-2 py-1.5 text-left font-medium">CPF/CNPJ</th>
                      <th className="px-2 py-1.5 text-left font-medium">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(extracaoXls.unidades || []).map((u) => (
                      <tr key={u.codigoUnidade} className="text-slate-800 dark:text-slate-200">
                        <td className="px-2 py-1.5 font-mono tabular-nums">{u.codigoUnidade}</td>
                        <td className="max-w-[180px] truncate px-2 py-1.5" title={u.proprietario?.nome}>
                          {u.proprietario?.nome || '—'}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums">{u.proprietario?.cpfCnpjNormalizado || '—'}</td>
                        <td className="px-2 py-1.5">{u.situacaoProprietarioCpf || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={botaoSecundario()}
                  disabled={loadingImportarXls}
                  onClick={() => {
                    setExtracaoXls(null);
                    setArquivoXls(null);
                    setFileInputKeyXls((k) => k + 1);
                    setStep(4);
                  }}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className={botaoPrimario()}
                  disabled={!(extracaoXls.unidades && extracaoXls.unidades.length)}
                  onClick={() => setStep(6)}
                >
                  Continuar para confirmação
                </button>
              </div>
            </div>
          )}

          {step === 6 && importResult && (
            <div className="space-y-4">
              {!pessoasImportOmitida && extracaoXls && !importResultXls && (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-800 dark:text-slate-200">Passo 6 — Confirmar pessoas</span>
                    : serão mescladas pessoas (contatos/endereços), criada ou atualizada a parte{' '}
                    <strong>RÉU — Proprietário</strong> nos processos deste cliente por unidade. Inquilinos são
                    cadastrados <strong>sem</strong> parte processual. Tudo fica no mesmo{' '}
                    <span className="font-mono text-xs">importacaoId</span> dos débitos para reverter junto.
                  </p>
                  {extracao && unidadesPlanilhaSemDebitoNoPdf.length > 0 && (
                    <div className="rounded border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                      <strong>{unidadesPlanilhaSemDebitoNoPdf.length}</strong> unidade(s) da planilha não estão no PDF
                      desta sessão — a confirmação abaixo vai registar pessoas, mas <strong>falhará o vínculo RÉU</strong>{' '}
                      nessas linhas (aparecerão como erros no relatório) até existir processo.
                    </div>
                  )}
                  <div className="rounded border border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-100">
                    As unidades da planilha precisam de processo já criado na importação do PDF (uma unidade no PDF = uma
                    cobrança listada para essa unidade).
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={botaoSecundario()}
                      disabled={loadingImportarXls}
                      onClick={() => setStep(5)}
                    >
                      Voltar
                    </button>
                    <button
                      type="button"
                      className={botaoPrimario()}
                      disabled={
                        loadingImportarXls ||
                        !importResult.importacaoId ||
                        !(extracaoXls.unidades && extracaoXls.unidades.length)
                      }
                      onClick={() => void onImportarPlanilhaNoFluxoPdf()}
                    >
                      {loadingImportarXls ? 'A importar…' : 'Confirmar importação de pessoas'}
                    </button>
                  </div>
                </>
              )}

              {(pessoasImportOmitida || importResultXls) && (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    <span className="font-medium text-slate-800 dark:text-slate-200">Passo 6 — Concluído</span>
                  </p>

                  <div className="space-y-2 rounded-lg border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                    <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">Débitos (PDF)</h3>
                    <p className="text-sm text-slate-700 dark:text-slate-300">
                      Processos novos: <strong>{importResult.processosCriados ?? 0}</strong>
                      {' · '}
                      Cobranças: <strong>{importResult.cobrancasLancadasTotal ?? 0}</strong>
                    </p>
                  </div>

                  {importResultXls ? (
                    <div className="space-y-2 rounded-lg border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-950">
                      <h3 className="text-sm font-medium text-slate-800 dark:text-slate-200">Pessoas (planilha)</h3>
                      <ul className="space-y-1 text-sm text-slate-800 dark:text-slate-100">
                        <li>
                          Pessoas criadas: <strong>{importResultXls.pessoasCriadas ?? 0}</strong>
                        </li>
                        <li>
                          Pessoas reutilizadas: <strong>{importResultXls.pessoasReutilizadas ?? 0}</strong>
                        </li>
                        <li>
                          Contatos adicionados: <strong>{importResultXls.contatosAdicionados ?? 0}</strong>
                        </li>
                        <li>
                          Endereços adicionados: <strong>{importResultXls.enderecosAdicionados ?? 0}</strong>
                        </li>
                        <li>
                          Processos encontrados: <strong>{importResultXls.processosEncontrados ?? 0}</strong>
                        </li>
                        <li>
                          Partes proprietário: <strong>{importResultXls.partesProprietarioCriadas ?? 0}</strong>
                        </li>
                        <li>
                          Partes já corretas: <strong>{importResultXls.partesProprietarioJaExistentes ?? 0}</strong>
                        </li>
                        <li>
                          Inquilinos mesclados: <strong>{importResultXls.inquilinosMesclados ?? 0}</strong>
                        </li>
                      </ul>
                      {(importResultXls.erros || []).length > 0 && (
                        <div className="mt-2">
                          <h4 className="text-sm font-medium text-red-700 dark:text-red-300">Erros (planilha)</h4>
                          <ul className="space-y-1 text-sm text-red-800 dark:text-red-200">
                            {importResultXls.erros.map((e, i) => (
                              <li key={i}>
                                <span className="font-medium tabular-nums">{e.codigoUnidade ?? '(?)'}</span>:{' '}
                                {e.mensagem}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      Importação de pessoas pela planilha foi <strong>adiada</strong> nesta sessão. A reversão abaixo
                      desfaz apenas o que foi gravado com este <span className="font-mono text-xs">importacaoId</span>{' '}
                      (débitos e o que existir vinculado a ele).
                    </p>
                  )}

                  <BlocoReversaoImportacao
                    key={importResult.importacaoId ?? 'sem-id'}
                    importacaoId={importResult.importacaoId}
                  />

                  <button type="button" className={botaoPrimario()} onClick={resetFluxoInadimplencia}>
                    Nova importação
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {apiOk && fluxoTipo === 'cobranca-auto' && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Cobrança automática (inadimplência)
            </h2>
            <button
              type="button"
              className={botaoSecundario()}
              onClick={() => {
                resetFluxoCobranca();
                setFluxoTipo(null);
              }}
            >
              Voltar à lista
            </button>
          </div>

          {cobErro && (
            <div className="rounded border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800 dark:text-red-100">
              {cobErro}
            </div>
          )}

          {cobStep === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">Passo 1 — Relatório .xls</span>
                : envie o arquivo exportado pelo sistema do condomínio e clique em Extrair.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Arquivo .xls / .xlsx
                </label>
                <input
                  ref={cobXlsInputRef}
                  key={cobFileInputKey}
                  type="file"
                  accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="block w-full text-sm text-slate-600 dark:text-slate-300"
                  onChange={(e) => setCobArquivoXls(e.target.files?.[0] ?? null)}
                />
              </div>
              <button
                type="button"
                className={botaoPrimario()}
                disabled={cobLoadingExtrair}
                onClick={onClicarExtrairOuEscolherCobrancaXls}
              >
                {cobLoadingExtrair ? 'Extraindo…' : !cobArquivoXls ? 'Escolher arquivo…' : 'Extrair relatório'}
              </button>
            </div>
          )}

          {cobStep === 2 && cobExtracao && resumoCobExtracao && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">Passo 2 — Revisão e cliente</span>
                : confira os totais e unidades, selecione o condomínio (cliente) e processe.
              </p>
              <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Unidades</dt>
                  <dd className="font-medium tabular-nums text-slate-800 dark:text-slate-100">
                    {resumoCobExtracao.unidades}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Débitos</dt>
                  <dd className="font-medium tabular-nums text-slate-800 dark:text-slate-100">
                    {resumoCobExtracao.debitos}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">PF / PJ</dt>
                  <dd className="font-medium tabular-nums text-slate-800 dark:text-slate-100">
                    {resumoCobExtracao.pf} / {resumoCobExtracao.pj}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Valor total</dt>
                  <dd className="font-medium tabular-nums text-slate-800 dark:text-slate-100">
                    {formatBrlCentavos(resumoCobExtracao.valorTotalCentavos)}
                  </dd>
                </div>
              </dl>
              <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Unidade</th>
                      <th className="text-left px-3 py-2 font-medium">Proprietário</th>
                      <th className="text-left px-3 py-2 font-medium">CPF/CNPJ</th>
                      <th className="text-right px-3 py-2 font-medium">Cobranças</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {(cobExtracao.unidades || []).map((u) => {
                      const cod = u.codigoUnidadeNormalizada || u.codigoUnidade || '—';
                      const n = Array.isArray(u.cobrancas) ? u.cobrancas.length : 0;
                      return (
                        <tr key={cod} className="text-slate-800 dark:text-slate-200">
                          <td className="px-3 py-2 font-mono text-xs">{cod}</td>
                          <td className="px-3 py-2 max-w-[240px] truncate" title={u.proprietarioNome}>
                            {u.proprietarioNome || '—'}
                          </td>
                          <td className="px-3 py-2 tabular-nums text-xs">
                            {formatDocDigitos(u.proprietarioDocDigitos)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">{n}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <SeletorClienteLista
                clientesFiltrados={clientesFiltradosCobranca}
                loadingClientes={loadingClientes}
                buscaCliente={cobBuscaCliente}
                onBuscaChange={setCobBuscaCliente}
                clienteSel={cobClienteSel}
                onSelectCliente={setCobClienteSel}
              />
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  className={botaoSecundario()}
                  disabled={cobLoadingProcessar}
                  onClick={() => {
                    setCobStep(1);
                    setCobExtracao(null);
                  }}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className={botaoPrimario()}
                  disabled={
                    cobLoadingProcessar ||
                    !cobClienteSel ||
                    !(cobExtracao.unidades && cobExtracao.unidades.length)
                  }
                  onClick={() => void onProcessarCobranca()}
                >
                  {cobLoadingProcessar ? 'Processando…' : 'Processar'}
                </button>
              </div>
            </div>
          )}

          {cobStep === 3 && cobProcessResult && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-800 dark:text-slate-200">Processamento concluído</span>
              </p>
              {reconcCob && (
                <p
                  className={`text-sm tabular-nums ${
                    reconcCob.fecha
                      ? 'text-slate-700 dark:text-slate-300'
                      : 'font-medium text-red-700 dark:text-red-300'
                  }`}
                >
                  Documento {reconcCob.titulosDoc} = Inseridos {reconcCob.inseridos} + Ignorados{' '}
                  {reconcCob.ignorados} + Falhados {reconcCob.falhados}
                </p>
              )}
              {(cobProcessResult.pontosAtencao || []).length > 0 && (
                <div
                  className={`rounded border px-3 py-2 text-sm space-y-1 ${
                    (cobProcessResult.pontosAtencao || []).some((p) =>
                      String(p).includes('DIVERGÊNCIA'),
                    )
                      ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/50 dark:text-red-100'
                      : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100'
                  }`}
                >
                  <p className="font-medium">Pontos de atenção</p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {cobProcessResult.pontosAtencao.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="break-all text-xs text-slate-500 dark:text-slate-400">
                <span className="font-medium">importacaoId</span>{' '}
                <span className="font-mono">{cobProcessResult.importacaoId ?? '—'}</span>
              </p>
              {(cobProcessResult.itens || []).length > 0 && (
                <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Unidade</th>
                        <th className="text-left px-3 py-2 font-medium">Processo</th>
                        <th className="text-right px-3 py-2 font-medium">Inseridos</th>
                        <th className="text-right px-3 py-2 font-medium">Ignorados</th>
                        <th className="text-right px-3 py-2 font-medium">Dim.</th>
                        <th className="text-center px-3 py-2 font-medium">Troca dono</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {cobProcessResult.itens.map((it, i) => {
                        const cod = it.codigoUnidade ?? it.codigoUnidadeNormalizada ?? '—';
                        return (
                          <tr key={`${cod}-${i}`} className="text-slate-800 dark:text-slate-200">
                            <td className="px-3 py-2 font-mono text-xs">{cod}</td>
                            <td className="px-3 py-2 text-xs">
                              {it.numeroInterno != null ? (
                                <>
                                  nº {it.numeroInterno}
                                  {it.processoCriado ? ' (novo)' : ''}
                                </>
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {contagemDebitosItem(it, 'debitosInseridos', 'inseridos')}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">
                              {contagemDebitosItem(it, 'debitosIgnorados', 'ignorados')}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums">{it.dimensao ?? '—'}</td>
                            <td className="px-3 py-2 text-center">
                              {it.revisaoTrocaDono ? (
                                <span className="text-amber-700 dark:text-amber-300">Sim</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {(cobProcessResult.erros || []).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-red-700 dark:text-red-300">Erros</h3>
                  <ul className="space-y-1 text-sm text-red-800 dark:text-red-200">
                    {cobProcessResult.erros.map((e, i) => (
                      <li key={i}>
                        <span className="tabular-nums font-medium">
                          {e.codigoUnidade ?? e.codigoUnidadeNormalizada ?? '?'}
                        </span>
                        : {e.mensagem}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                {cobProcessResult.importacaoId ? (
                  <button
                    type="button"
                    className={botaoSecundario()}
                    onClick={() => void onBaixarRelatorioPdfCobranca()}
                  >
                    Baixar relatório (PDF)
                  </button>
                ) : null}
                <button type="button" className={botaoSecundario()} onClick={() => void copiarResumoCobranca()}>
                  {cobCopiado ? 'Copiado!' : 'Copiar resumo'}
                </button>
                <button
                  type="button"
                  className={botaoSecundario()}
                  onClick={() =>
                    downloadTextoArquivo(
                      textoResumoCobranca,
                      `cobranca-${cobProcessResult.importacaoId || 'resumo'}.txt`,
                    )
                  }
                >
                  Baixar resumo (.txt)
                </button>
                <button type="button" className={botaoPrimario()} onClick={resetFluxoCobranca}>
                  Nova cobrança
                </button>
              </div>
              {cobProcessResult.importacaoId ? (
                <BlocoReversaoImportacao importacaoId={cobProcessResult.importacaoId} />
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

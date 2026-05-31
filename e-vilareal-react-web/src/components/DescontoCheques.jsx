import { useCallback, useEffect, useMemo, useState } from 'react';
import { Banknote, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { formatMoeda, formatDataCurta } from './financeiro/shared/financeiroFormat.js';
import {
  listarDescontosCheque,
  simularDescontoCheque,
  criarDescontoCheque,
  atualizarDescontoCheque,
  excluirDescontoCheque,
} from '../repositories/descontoChequeRepository.js';

const DEBOUNCE_PREVIEW_MS = 450;

function hojeIso() {
  const d = new Date();
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const da = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${da}`;
}

/** Máscara R$: só dígitos → centavos. */
function digitsToCentavos(str) {
  const d = String(str ?? '').replace(/\D/g, '');
  return d ? parseInt(d, 10) : 0;
}

function centavosParaInput(c) {
  return (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function parseTaxa(str) {
  const n = Number(String(str ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

function formatTaxaDiariaPct(taxaDiaria) {
  const n = Number(taxaDiaria);
  if (!Number.isFinite(n)) return '—';
  return `${(n * 100).toLocaleString('pt-BR', { maximumFractionDigits: 5 })}% a.d.`;
}

const ESTADO_FORM_INICIAL = {
  descricao: '',
  valorCentavos: 0,
  dataBase: hojeIso(),
  dataDeposito: '',
  taxaMensal: '',
};

export function DescontoCheques() {
  const [form, setForm] = useState(ESTADO_FORM_INICIAL);
  const [editId, setEditId] = useState(null);

  const [preview, setPreview] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [previewErro, setPreviewErro] = useState('');

  const [lista, setLista] = useState([]);
  const [listaCarregando, setListaCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erroAcao, setErroAcao] = useState('');
  const [excluindoId, setExcluindoId] = useState(null);

  const valorFace = form.valorCentavos / 100;
  const taxaNum = parseTaxa(form.taxaMensal);

  const podeCalcular = useMemo(() => {
    if (!(valorFace > 0)) return false;
    if (!form.dataBase || !form.dataDeposito) return false;
    if (!(form.dataDeposito > form.dataBase)) return false;
    if (!Number.isFinite(taxaNum) || taxaNum < 0) return false;
    return true;
  }, [valorFace, form.dataBase, form.dataDeposito, taxaNum]);

  const recarregarLista = useCallback(async () => {
    setListaCarregando(true);
    try {
      const dados = await listarDescontosCheque();
      setLista(dados);
    } catch (e) {
      setErroAcao(e?.message || 'Falha ao carregar a lista.');
    } finally {
      setListaCarregando(false);
    }
  }, []);

  useEffect(() => {
    void recarregarLista();
  }, [recarregarLista]);

  // Preview ao vivo (debounce ~450ms), igual ao padrão de autosave do projeto.
  useEffect(() => {
    if (!podeCalcular) {
      setPreview(null);
      setPreviewErro('');
      setCalculando(false);
      return undefined;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setCalculando(true);
      try {
        const r = await simularDescontoCheque(
          {
            descricao: form.descricao,
            valorFace,
            dataBase: form.dataBase,
            dataDeposito: form.dataDeposito,
            taxaMensalPercentual: taxaNum,
          },
          { signal: ctrl.signal },
        );
        setPreview(r);
        setPreviewErro('');
      } catch (e) {
        if (!ctrl.signal.aborted) {
          setPreview(null);
          setPreviewErro(e?.message || 'Não foi possível calcular.');
        }
      } finally {
        if (!ctrl.signal.aborted) setCalculando(false);
      }
    }, DEBOUNCE_PREVIEW_MS);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // descricao fora das deps: não altera o cálculo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valorFace, form.dataBase, form.dataDeposito, taxaNum, podeCalcular]);

  const setCampo = (campo, valor) => setForm((f) => ({ ...f, [campo]: valor }));

  const limparForm = () => {
    setForm({ ...ESTADO_FORM_INICIAL, dataBase: hojeIso() });
    setEditId(null);
    setPreview(null);
    setPreviewErro('');
    setErroAcao('');
  };

  const iniciarEdicao = (item) => {
    setEditId(item.id);
    setErroAcao('');
    setForm({
      descricao: item.descricao || '',
      valorCentavos: Math.round(Number(item.valorFace || 0) * 100),
      dataBase: String(item.dataBase || hojeIso()).slice(0, 10),
      dataDeposito: String(item.dataDeposito || '').slice(0, 10),
      taxaMensal: String(item.taxaMensalPercentual ?? '').replace('.', ','),
    });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const salvar = async () => {
    if (!podeCalcular || salvando) return;
    setSalvando(true);
    setErroAcao('');
    const input = {
      descricao: form.descricao,
      valorFace,
      dataBase: form.dataBase,
      dataDeposito: form.dataDeposito,
      taxaMensalPercentual: taxaNum,
    };
    try {
      if (editId != null) {
        await atualizarDescontoCheque(editId, input);
      } else {
        await criarDescontoCheque(input);
      }
      // Refaz o GET da lista (o POST/PUT retorna createdAt/updatedAt null).
      await recarregarLista();
      limparForm();
    } catch (e) {
      setErroAcao(e?.message || 'Falha ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const excluir = async (id) => {
    if (excluindoId != null) return;
    if (typeof window !== 'undefined' && !window.confirm('Excluir este desconto de cheque?')) return;
    setExcluindoId(id);
    setErroAcao('');
    try {
      await excluirDescontoCheque(id);
      if (editId === id) limparForm();
      await recarregarLista();
    } catch (e) {
      setErroAcao(e?.message || 'Falha ao excluir.');
    } finally {
      setExcluindoId(null);
    }
  };

  const parcelas = preview?.parcelasDiarias ?? [];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[var(--vl-bg-page)] p-3 sm:p-4">
      <div className="mx-auto flex max-w-6xl flex-col gap-4">
        <header className="flex items-center gap-2">
          <Banknote className="h-6 w-6 text-emerald-600 dark:text-emerald-400" aria-hidden />
          <div>
            <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Desconto de Cheques</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Antecipação de cheque por desconto comercial simples (taxa × dias/30 sobre o valor de face).
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Formulário */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {editId != null ? `Editando cheque #${editId}` : 'Novo desconto'}
              </h2>
              {editId != null ? (
                <button
                  type="button"
                  onClick={limparForm}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <X className="h-3.5 w-3.5" aria-hidden /> Cancelar edição
                </button>
              ) : null}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 sm:col-span-2">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Descrição (opcional)</span>
                <input
                  type="text"
                  value={form.descricao}
                  maxLength={255}
                  onChange={(e) => setCampo('descricao', e.target.value)}
                  placeholder="Ex.: Cheque do cliente Fulano"
                  className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Valor de face (R$)</span>
                <div className="flex items-center rounded-md border border-slate-300 focus-within:border-cyan-500 focus-within:ring-2 focus-within:ring-cyan-500/30 dark:border-slate-600 dark:bg-slate-800">
                  <span className="pl-2.5 text-sm text-slate-500 dark:text-slate-400">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={centavosParaInput(form.valorCentavos)}
                    onChange={(e) => setCampo('valorCentavos', digitsToCentavos(e.target.value))}
                    className="w-full bg-transparent px-2 py-1.5 text-right text-sm text-slate-800 outline-none dark:text-slate-100"
                  />
                </div>
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Taxa mensal (% a.m.)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.taxaMensal}
                  onChange={(e) => setCampo('taxaMensal', e.target.value)}
                  placeholder="Ex.: 3"
                  className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Data base</span>
                <input
                  type="date"
                  value={form.dataBase}
                  onChange={(e) => setCampo('dataBase', e.target.value)}
                  className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-600 dark:text-slate-300">Data de depósito/vencimento</span>
                <input
                  type="date"
                  value={form.dataDeposito}
                  min={form.dataBase}
                  onChange={(e) => setCampo('dataDeposito', e.target.value)}
                  className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/30 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                />
              </label>
            </div>

            {!podeCalcular && (form.valorCentavos > 0 || form.dataDeposito) ? (
              <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
                Preencha valor, taxa e datas (depósito posterior à data base) para ver o cálculo.
              </p>
            ) : null}
            {previewErro ? (
              <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">{previewErro}</p>
            ) : null}
            {erroAcao ? <p className="mt-2 text-[11px] text-red-600 dark:text-red-400">{erroAcao}</p> : null}

            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                onClick={salvar}
                disabled={!podeCalcular || salvando}
                className="inline-flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {salvando ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                {editId != null ? 'Salvar alterações' : 'Salvar cheque'}
              </button>
              {calculando ? (
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> calculando…
                </span>
              ) : null}
            </div>
          </section>

          {/* Resumo + tabela diária */}
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <h2 className="mb-3 text-sm font-semibold text-slate-700 dark:text-slate-200">Prévia do cálculo</h2>
            {preview ? (
              <>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <ResumoCard rotulo="Dias" valor={String(preview.dias)} />
                  <ResumoCard rotulo="Taxa diária" valor={formatTaxaDiariaPct(preview.taxaDiaria)} />
                  <ResumoCard rotulo="Valor líquido" valor={formatMoeda(preview.valorLiquido)} destaque />
                  <ResumoCard rotulo="Desconto" valor={formatMoeda(preview.valorDesconto)} />
                </div>

                <div className="mt-3 max-h-[22rem] overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                  <table className="w-full border-collapse text-right text-xs">
                    <thead className="sticky top-0 z-10 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-semibold">Dia</th>
                        <th className="px-2 py-1.5 text-left font-semibold">Data</th>
                        <th className="px-2 py-1.5 font-semibold">Saldo no dia</th>
                        <th className="px-2 py-1.5 font-semibold">Juros do dia</th>
                        <th className="px-2 py-1.5 font-semibold">Juros acum.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parcelas.map((p) => (
                        <tr
                          key={p.dia}
                          className="border-t border-slate-100 odd:bg-white even:bg-slate-50/60 dark:border-slate-800 dark:odd:bg-slate-900 dark:even:bg-slate-800/40"
                        >
                          <td className="px-2 py-1 text-left text-slate-500 dark:text-slate-400">{p.dia}</td>
                          <td className="px-2 py-1 text-left text-slate-600 dark:text-slate-300">{formatDataCurta(p.data)}</td>
                          <td className="px-2 py-1 tabular-nums text-slate-800 dark:text-slate-100">{formatMoeda(p.saldo)}</td>
                          <td className="px-2 py-1 tabular-nums text-slate-600 dark:text-slate-300">{formatMoeda(p.jurosDia)}</td>
                          <td className="px-2 py-1 tabular-nums text-slate-600 dark:text-slate-300">{formatMoeda(p.jurosAcumulado)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="flex h-40 items-center justify-center text-sm text-slate-400 dark:text-slate-500">
                {calculando ? 'Calculando…' : 'Preencha o formulário para visualizar.'}
              </div>
            )}
          </section>
        </div>

        {/* Lista de cheques salvos */}
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Cheques salvos</h2>
            {listaCarregando ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> carregando…
              </span>
            ) : (
              <span className="text-[11px] text-slate-400">{lista.length} registro(s)</span>
            )}
          </div>
          {lista.length === 0 && !listaCarregando ? (
            <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">Nenhum cheque salvo ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="px-2 py-1.5 text-left font-semibold">Descrição</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Valor de face</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Base</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Depósito</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Dias</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Líquido</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Desconto</th>
                    <th className="px-2 py-1.5 text-right font-semibold">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-t border-slate-100 dark:border-slate-800 ${
                        editId === item.id ? 'bg-cyan-50 dark:bg-cyan-500/10' : ''
                      }`}
                    >
                      <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">{item.descricao || '—'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-800 dark:text-slate-100">{formatMoeda(item.valorFace)}</td>
                      <td className="px-2 py-1.5 text-right text-slate-600 dark:text-slate-300">{formatDataCurta(item.dataBase)}</td>
                      <td className="px-2 py-1.5 text-right text-slate-600 dark:text-slate-300">{formatDataCurta(item.dataDeposito)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{item.dias}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{formatMoeda(item.valorLiquido)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-600 dark:text-slate-300">{formatMoeda(item.valorDesconto)}</td>
                      <td className="px-2 py-1.5 text-right">
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => iniciarEdicao(item)}
                            title="Editar"
                            className="inline-flex items-center justify-center rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => excluir(item.id)}
                            disabled={excluindoId === item.id}
                            title="Excluir"
                            className="inline-flex items-center justify-center rounded-md border border-red-200 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
                          >
                            {excluindoId === item.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" aria-hidden />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function ResumoCard({ rotulo, valor, destaque = false }) {
  return (
    <div
      className={`rounded-lg border p-2.5 ${
        destaque
          ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800/60 dark:bg-emerald-950/30'
          : 'border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50'
      }`}
    >
      <div className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{rotulo}</div>
      <div
        className={`mt-0.5 text-sm font-semibold tabular-nums ${
          destaque ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-800 dark:text-slate-100'
        }`}
      >
        {valor}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import {
  criarPassivoApi,
  desativarPassivoApi,
  listarPassivosApi,
} from '../../repositories/patrimonioRepository.js';
import { fmtBRL, fmtPct } from './patrimonioFormat.js';

const VAZIO = {
  tipo: 'FINANCIAMENTO_IMOBILIARIO',
  credor: '',
  descricao: '',
  valorOriginal: '',
  saldoDevedor: '',
  sistemaAmortizacao: 'PRICE',
  taxaJurosNominalAa: '',
  cetEfetivoAa: '',
  indexador: 'TR',
  parcelaAtual: '',
  prazoRemanescenteMeses: '',
  diaVencimento: '10',
  consorcioContemplado: false,
  regenerarCronograma: true,
};

export function PatrimonioPassivos() {
  const [lista, setLista] = useState([]);
  const [form, setForm] = useState(VAZIO);
  const [erro, setErro] = useState('');
  const [ok, setOk] = useState('');

  async function carregar() {
    setLista(await listarPassivosApi());
  }

  useEffect(() => {
    carregar().catch((e) => setErro(e?.message || 'Erro'));
  }, []);

  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setOk('');
    try {
      const body = {
        ...form,
        valorOriginal: Number(form.valorOriginal),
        saldoDevedor: Number(form.saldoDevedor),
        taxaJurosNominalAa: form.taxaJurosNominalAa ? Number(form.taxaJurosNominalAa) : null,
        cetEfetivoAa: Number(form.cetEfetivoAa),
        parcelaAtual: Number(form.parcelaAtual),
        prazoRemanescenteMeses: Number(form.prazoRemanescenteMeses),
        diaVencimento: Number(form.diaVencimento) || null,
        consorcioContemplado: form.sistemaAmortizacao === 'CONSORCIO' ? !!form.consorcioContemplado : null,
      };
      await criarPassivoApi(body);
      setForm(VAZIO);
      setOk('Passivo cadastrado. Cronograma gerado (exceto consórcio).');
      await carregar();
    } catch (err) {
      setErro(err?.message || 'Falha ao salvar');
    }
  }

  return (
    <div className="space-y-5 max-w-5xl">
      <header>
        <h1 className="text-xl font-semibold">Passivos</h1>
        <p className="text-sm text-slate-500">
          Financiamentos, consórcios e dívidas — CET efetivo é o número que importa nas comparações.
          Consórcio nunca é tratado como financiamento.
        </p>
      </header>

      {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
      {ok ? <p className="text-sm text-teal-700">{ok}</p> : null}

      <form onSubmit={salvar} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
        <Field label="Tipo">
          <select value={form.tipo} onChange={(e) => setField('tipo', e.target.value)} className={inputCls}>
            <option value="FINANCIAMENTO_IMOBILIARIO">Financiamento imobiliário</option>
            <option value="FINANCIAMENTO_VEICULO">Financiamento veículo</option>
            <option value="CONSORCIO">Consórcio</option>
            <option value="CREDITO_PESSOAL">Crédito pessoal</option>
            <option value="CARTAO">Cartão</option>
            <option value="OUTROS">Outros</option>
          </select>
        </Field>
        <Field label="Sistema">
          <select
            value={form.sistemaAmortizacao}
            onChange={(e) => setField('sistemaAmortizacao', e.target.value)}
            className={inputCls}
          >
            <option value="PRICE">Price</option>
            <option value="SAC">SAC</option>
            <option value="CONSORCIO">Consórcio</option>
          </select>
        </Field>
        <Field label="Credor">
          <input required value={form.credor} onChange={(e) => setField('credor', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Descrição">
          <input value={form.descricao} onChange={(e) => setField('descricao', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Valor original">
          <input required value={form.valorOriginal} onChange={(e) => setField('valorOriginal', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Saldo devedor">
          <input required value={form.saldoDevedor} onChange={(e) => setField('saldoDevedor', e.target.value)} className={inputCls} />
        </Field>
        <Field label="CET efetivo % a.a.">
          <input required value={form.cetEfetivoAa} onChange={(e) => setField('cetEfetivoAa', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Juros nominal % a.a.">
          <input value={form.taxaJurosNominalAa} onChange={(e) => setField('taxaJurosNominalAa', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Parcela atual">
          <input required value={form.parcelaAtual} onChange={(e) => setField('parcelaAtual', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Prazo remanescente (meses)">
          <input required value={form.prazoRemanescenteMeses} onChange={(e) => setField('prazoRemanescenteMeses', e.target.value)} className={inputCls} />
        </Field>
        <Field label="Indexador">
          <input value={form.indexador} onChange={(e) => setField('indexador', e.target.value)} className={inputCls} />
        </Field>
        {form.sistemaAmortizacao === 'CONSORCIO' ? (
          <label className="flex items-center gap-2 md:col-span-3 text-sm">
            <input
              type="checkbox"
              checked={!!form.consorcioContemplado}
              onChange={(e) => setField('consorcioContemplado', e.target.checked)}
            />
            Consórcio contemplado (saldo como dívida corrigida)
          </label>
        ) : null}
        <div className="md:col-span-3">
          <button type="submit" className="px-4 py-2 rounded-md bg-teal-700 text-white hover:bg-teal-800">
            Cadastrar passivo
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
              <th className="p-2">Credor</th>
              <th className="p-2">Tipo</th>
              <th className="p-2">Sistema</th>
              <th className="p-2">Saldo</th>
              <th className="p-2">CET</th>
              <th className="p-2">Parcela</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {lista.map((p) => (
              <tr key={p.id} className="border-b border-slate-100 dark:border-slate-800">
                <td className="p-2">{p.credor}</td>
                <td className="p-2">{p.tipo}</td>
                <td className="p-2">
                  {p.sistemaAmortizacao}
                  {p.sistemaAmortizacao === 'CONSORCIO'
                    ? p.consorcioContemplado
                      ? ' · contemplado'
                      : ' · não contemplado'
                    : ''}
                </td>
                <td className="p-2 tabular-nums">{fmtBRL(p.saldoDevedor)}</td>
                <td className="p-2 tabular-nums">{fmtPct(p.cetEfetivoAa)}</td>
                <td className="p-2 tabular-nums">{fmtBRL(p.parcelaAtual)}</td>
                <td className="p-2">
                  <button
                    type="button"
                    className="text-xs text-red-700 underline"
                    onClick={() => desativarPassivoApi(p.id).then(carregar)}
                  >
                    Remover
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const inputCls = 'mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1.5';

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-slate-500">{label}</span>
      {children}
    </label>
  );
}

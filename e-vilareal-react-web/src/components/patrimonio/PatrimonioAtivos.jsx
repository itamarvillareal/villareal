import { useEffect, useState } from 'react';
import {
  listarCaixaApi,
  listarImoveisPatrimonioApi,
  listarRendaFixaApi,
  listarRvApi,
  listarVeiculosPatrimonioApi,
  listarOpcoesApi,
  salvarCaixaApi,
  salvarImovelPatrimonioApi,
  salvarRendaFixaApi,
  salvarRvApi,
  salvarVeiculoPatrimonioApi,
  salvarOpcaoApi,
} from '../../repositories/patrimonioRepository.js';
import { fmtBRL, fmtPct } from './patrimonioFormat.js';

export function PatrimonioAtivos() {
  const [caixa, setCaixa] = useState([]);
  const [rf, setRf] = useState([]);
  const [imoveis, setImoveis] = useState([]);
  const [rv, setRv] = useState([]);
  const [veiculos, setVeiculos] = useState([]);
  const [opcoes, setOpcoes] = useState([]);
  const [erro, setErro] = useState('');
  const [msg, setMsg] = useState('');

  async function carregar() {
    const [c, r, i, v, ve, o] = await Promise.all([
      listarCaixaApi(),
      listarRendaFixaApi(),
      listarImoveisPatrimonioApi(),
      listarRvApi(),
      listarVeiculosPatrimonioApi(),
      listarOpcoesApi('ABERTA'),
    ]);
    setCaixa(c);
    setRf(r);
    setImoveis(i);
    setRv(v);
    setVeiculos(ve);
    setOpcoes(o);
  }

  useEffect(() => {
    carregar().catch((e) => setErro(e?.message || 'Erro'));
  }, []);

  async function wrap(fn) {
    setErro('');
    setMsg('');
    try {
      await fn();
      setMsg('Salvo.');
      await carregar();
    } catch (e) {
      setErro(e?.message || 'Falha');
    }
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <header>
        <h1 className="text-xl font-semibold">Cadastro de ativos</h1>
        <p className="text-sm text-slate-500">
          Fase 1: entrada manual. Caixa vinculado a puts vendidas não conta como disponível.
        </p>
      </header>
      {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
      {msg ? <p className="text-sm text-teal-700">{msg}</p> : null}

      <Section title="Caixa">
        <QuickForm
          fields={[
            ['descricao', 'Descrição'],
            ['instituicao', 'Instituição'],
            ['valor', 'Valor'],
          ]}
          extras={
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="vinculado" /> Vinculado (margem / puts)
            </label>
          }
          onSubmit={(fd) =>
            wrap(() =>
              salvarCaixaApi(null, {
                descricao: fd.get('descricao'),
                instituicao: fd.get('instituicao') || null,
                valor: Number(fd.get('valor')),
                vinculado: fd.get('vinculado') === 'on',
                motivoVinculo: fd.get('vinculado') === 'on' ? 'Margem opções' : null,
              })
            )
          }
        />
        <Lista
          rows={caixa.map((c) => [
            c.descricao,
            fmtBRL(c.valor),
            c.vinculado ? 'vinculado' : 'livre',
          ])}
        />
      </Section>

      <Section title="Renda fixa">
        <QuickForm
          fields={[
            ['instrumento', 'Instrumento'],
            ['instituicao', 'Instituição'],
            ['valorAplicado', 'Valor aplicado'],
            ['rentabilidadeLiquidaAa', 'Rentab. líquida % a.a.'],
          ]}
          extras={
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="reservaEmergencia" /> Compõe reserva de emergência
            </label>
          }
          onSubmit={(fd) =>
            wrap(() =>
              salvarRendaFixaApi(null, {
                instrumento: fd.get('instrumento'),
                instituicao: fd.get('instituicao') || null,
                valorAplicado: Number(fd.get('valorAplicado')),
                valorAtual: Number(fd.get('valorAplicado')),
                rentabilidadeLiquidaAa: fd.get('rentabilidadeLiquidaAa')
                  ? Number(fd.get('rentabilidadeLiquidaAa'))
                  : null,
                reservaEmergencia: fd.get('reservaEmergencia') === 'on',
                liquidez: 'DIARIA',
              })
            )
          }
        />
        <Lista
          rows={rf.map((r) => [
            r.instrumento,
            fmtBRL(r.valorAtual ?? r.valorAplicado),
            r.rentabilidadeLiquidaAa != null ? fmtPct(r.rentabilidadeLiquidaAa) : '—',
            r.reservaEmergencia ? 'reserva' : '',
          ])}
        />
      </Section>

      <Section title="Imóveis">
        <QuickForm
          fields={[
            ['identificacao', 'Identificação'],
            ['valorAtual', 'Valor atual'],
            ['aluguelMensal', 'Aluguel mensal'],
            ['situacao', 'Situação (ALUGADO/VAGO/USO_PROPRIO/A_VENDA)'],
          ]}
          onSubmit={(fd) =>
            wrap(() =>
              salvarImovelPatrimonioApi(null, {
                identificacao: fd.get('identificacao'),
                valorAtual: Number(fd.get('valorAtual')),
                aluguelMensal: fd.get('aluguelMensal') ? Number(fd.get('aluguelMensal')) : null,
                situacao: fd.get('situacao') || 'USO_PROPRIO',
              })
            )
          }
        />
        <Lista
          rows={imoveis.map((i) => [
            i.identificacao,
            fmtBRL(i.valorAtual),
            i.capRateLiquidoAa != null ? `cap ${fmtPct(i.capRateLiquidoAa)}` : '—',
            i.situacao,
          ])}
        />
      </Section>

      <Section title="Renda variável">
        <QuickForm
          fields={[
            ['ticker', 'Ticker'],
            ['quantidade', 'Quantidade'],
            ['precoMedio', 'Preço médio'],
            ['precoAtual', 'Preço atual'],
          ]}
          onSubmit={(fd) =>
            wrap(() =>
              salvarRvApi(null, {
                ticker: fd.get('ticker'),
                quantidade: Number(fd.get('quantidade')),
                precoMedio: Number(fd.get('precoMedio')),
                precoAtual: fd.get('precoAtual') ? Number(fd.get('precoAtual')) : null,
              })
            )
          }
        />
        <Lista
          rows={rv.map((r) => [
            r.ticker,
            String(r.quantidade),
            fmtBRL(r.valorMercado),
            r.pnlPct != null ? fmtPct(r.pnlPct) : '—',
          ])}
        />
      </Section>

      <Section title="Opções (prêmio estimado ≠ realizado)">
        <QuickForm
          fields={[
            ['tickerAtivo', 'Ativo'],
            ['tipo', 'Tipo (VENDA_PUT/VENDA_CALL_COBERTA/COMPRA)'],
            ['strike', 'Strike'],
            ['vencimento', 'Vencimento (YYYY-MM-DD)'],
            ['margemExigida', 'Margem exigida'],
            ['premioRealizado', 'Prêmio realizado'],
            ['premioEstimado', 'Prêmio estimado'],
          ]}
          onSubmit={(fd) =>
            wrap(() =>
              salvarOpcaoApi(null, {
                tickerAtivo: fd.get('tickerAtivo'),
                tipo: fd.get('tipo') || 'VENDA_PUT',
                strike: Number(fd.get('strike')),
                vencimento: fd.get('vencimento'),
                dataAbertura: new Date().toISOString().slice(0, 10),
                margemExigida: Number(fd.get('margemExigida') || 0),
                premioRealizado: fd.get('premioRealizado') ? Number(fd.get('premioRealizado')) : null,
                premioEstimado: fd.get('premioEstimado') ? Number(fd.get('premioEstimado')) : null,
                status: 'ABERTA',
              })
            )
          }
        />
        <Lista
          rows={opcoes.map((o) => [
            o.tickerAtivo,
            o.tipo,
            `K ${o.strike}`,
            o.vencimento,
            `margem ${fmtBRL(o.margemExigida)}`,
          ])}
        />
      </Section>

      <Section title="Veículos">
        <QuickForm
          fields={[
            ['descricao', 'Descrição'],
            ['ano', 'Ano'],
            ['placa', 'Placa'],
            ['valorAtual', 'Valor atual'],
          ]}
          onSubmit={(fd) =>
            wrap(() =>
              salvarVeiculoPatrimonioApi(null, {
                descricao: fd.get('descricao'),
                ano: fd.get('ano') ? Number(fd.get('ano')) : null,
                placa: fd.get('placa') || null,
                valorAtual: Number(fd.get('valorAtual')),
              })
            )
          }
        />
        <Lista rows={veiculos.map((v) => [v.descricao, v.placa || '—', fmtBRL(v.valorAtual)])} />
      </Section>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
      <h2 className="text-sm font-medium">{title}</h2>
      {children}
    </section>
  );
}

function QuickForm({ fields, extras, onSubmit }) {
  return (
    <form
      className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(new FormData(e.currentTarget));
        e.currentTarget.reset();
      }}
    >
      {fields.map(([name, label]) => (
        <label key={name} className="block">
          <span className="text-slate-500 text-xs">{label}</span>
          <input name={name} required className="mt-0.5 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1" />
        </label>
      ))}
      {extras}
      <div className="md:col-span-4">
        <button type="submit" className="px-3 py-1.5 rounded-md bg-teal-700 text-white text-xs">
          Adicionar
        </button>
      </div>
    </form>
  );
}

function Lista({ rows }) {
  if (!rows?.length) return <p className="text-xs text-slate-500">Nenhum registro.</p>;
  return (
    <ul className="text-sm space-y-1">
      {rows.map((cols, i) => (
        <li key={i} className="flex flex-wrap gap-x-3 text-slate-700 dark:text-slate-300">
          {cols.map((c, j) => (
            <span key={j}>{c}</span>
          ))}
        </li>
      ))}
    </ul>
  );
}

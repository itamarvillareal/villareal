import { useEffect, useState } from 'react';
import {
  listarPassivosApi,
  rankingAmortizacaoApi,
  simularAmortizacaoApi,
  solicitarAmortizacaoApi,
  confirmarAmortizacaoApi,
  listarAmortizacoesApi,
  registrarAmortizacaoExecutadaApi,
  atualizarTetoAmortizacaoApi,
} from '../../repositories/patrimonioRepository.js';
import { fmtBRL, fmtPct, recomendacaoLabel, recomendacaoTom } from './patrimonioFormat.js';

/**
 * Coração do módulo: compara amortizar vs. investir com governança anti-impulso.
 * Regra de UI: meses/nominal/VP/taxa implícita na MESMA altura, peso visual equivalente.
 */
export function PatrimonioAmortizacao() {
  const [passivos, setPassivos] = useState([]);
  const [ranking, setRanking] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [passivoId, setPassivoId] = useState('');
  const [valor, setValor] = useState('');
  const [modalidade, setModalidade] = useState('REDUZIR_PRAZO');
  const [retornoAlt, setRetornoAlt] = useState('');
  const [resultado, setResultado] = useState(null);
  const [racional, setRacional] = useState('');
  const [justReserva, setJustReserva] = useState('');
  const [justTeto, setJustTeto] = useState('');
  const [solicitacao, setSolicitacao] = useState(null);
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [tetoInput, setTetoInput] = useState('');
  const [regData, setRegData] = useState(new Date().toISOString().slice(0, 10));
  const [mostrarRegistro, setMostrarRegistro] = useState(false);

  async function carregarBase() {
    try {
      const [p, r, h] = await Promise.all([
        listarPassivosApi(),
        rankingAmortizacaoApi(),
        listarAmortizacoesApi(),
      ]);
      setPassivos(p || []);
      setRanking(r || []);
      setHistorico(h || []);
      if (!passivoId && p?.length) {
        setPassivoId(String(p[0].id));
        setValor(String(p[0].parcelaAtual ?? ''));
      }
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar');
    }
  }

  useEffect(() => {
    carregarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function simular(e) {
    e?.preventDefault();
    setErro('');
    setLoading(true);
    setSolicitacao(null);
    try {
      const body = {
        passivoId: Number(passivoId),
        valor: Number(String(valor).replace(',', '.')),
        modalidade,
      };
      if (retornoAlt) body.retornoAlternativaLiquidaAa = Number(String(retornoAlt).replace(',', '.'));
      setResultado(await simularAmortizacaoApi(body));
    } catch (err) {
      setErro(err?.message || 'Falha na simulação');
    } finally {
      setLoading(false);
    }
  }

  async function solicitar() {
    setErro('');
    if (!racional.trim()) {
      setErro('Registre o racional da decisão antes de solicitar.');
      return;
    }
    setLoading(true);
    try {
      const body = {
        passivoId: Number(passivoId),
        valor: Number(String(valor).replace(',', '.')),
        modalidade,
        racional: racional.trim(),
        justificativaReserva: justReserva.trim() || undefined,
        justificativaTeto: justTeto.trim() || undefined,
      };
      if (retornoAlt) body.retornoAlternativaLiquidaAa = Number(String(retornoAlt).replace(',', '.'));
      const s = await solicitarAmortizacaoApi(body);
      setSolicitacao(s);
      await carregarBase();
    } catch (err) {
      setErro(err?.message || 'Falha ao solicitar');
    } finally {
      setLoading(false);
    }
  }

  async function registrarExecutada() {
    setErro('');
    if (!racional.trim()) {
      setErro('Racional obrigatório para registro a posteriori.');
      return;
    }
    setLoading(true);
    try {
      const body = {
        passivoId: Number(passivoId),
        valor: Number(String(valor).replace(',', '.')),
        modalidade,
        dataEfetivacao: regData,
        racional: racional.trim(),
        justificativaReserva: justReserva.trim() || undefined,
        justificativaTeto: justTeto.trim() || undefined,
      };
      if (retornoAlt) body.retornoAlternativaLiquidaAa = Number(String(retornoAlt).replace(',', '.'));
      const s = await registrarAmortizacaoExecutadaApi(body);
      setSolicitacao(s);
      setMostrarRegistro(false);
      await carregarBase();
      await simular();
    } catch (err) {
      setErro(err?.message || 'Falha ao registrar');
    } finally {
      setLoading(false);
    }
  }

  async function confirmar(id) {
    setErro('');
    setLoading(true);
    try {
      const s = await confirmarAmortizacaoApi(id);
      setSolicitacao(s);
      await carregarBase();
    } catch (err) {
      setErro(err?.message || 'Não foi possível confirmar (verifique o período de reflexão)');
    } finally {
      setLoading(false);
    }
  }

  async function salvarTeto() {
    try {
      await atualizarTetoAmortizacaoApi(Number(String(tetoInput).replace(',', '.')));
      await simular();
    } catch (err) {
      setErro(err?.message || 'Falha ao salvar teto');
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <header>
        <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Amortizar dívida ou manter investido?
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Decisão calculada, comparada e sujeita a regra — não por gatilho emocional.
        </p>
      </header>

      {erro ? (
        <div className="rounded-md border border-red-200 bg-red-50 text-red-800 text-sm px-3 py-2">{erro}</div>
      ) : null}

      {/* Consumo do teto anual — sempre visível */}
      <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-4 py-3 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <p className="text-[11px] uppercase tracking-wide text-slate-500">Teto anual de amortização extraordinária</p>
          <p className="text-lg font-semibold tabular-nums mt-0.5">
            {resultado?.tetoAmortizacaoAnual != null
              ? `${fmtBRL(resultado.tetoAmortizacaoUsadoAno)} usados / ${fmtBRL(resultado.tetoAmortizacaoAnual)}`
              : 'não definido'}
          </p>
          <p className="text-xs text-slate-500">
            {resultado?.tetoAmortizacaoDisponivel != null
              ? `Disponível ${fmtBRL(resultado.tetoAmortizacaoDisponivel)}`
              : 'Defina um teto para enxergar a sequência de operações'}
          </p>
        </div>
        <div className="flex gap-2 items-end">
          <label className="text-sm">
            <span className="text-slate-500 text-xs">Definir teto (R$)</span>
            <input
              className="mt-0.5 block w-36 rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1"
              value={tetoInput}
              onChange={(e) => setTetoInput(e.target.value)}
            />
          </label>
          <button type="button" onClick={salvarTeto} className="text-xs px-2 py-1.5 rounded-md border border-slate-300">
            Salvar
          </button>
        </div>
        {resultado?.ultrapassaTetoComEstaOperacao ? (
          <p className="w-full text-sm text-red-700 font-medium">
            Esta operação ultrapassa o teto — justificativa reforçada obrigatória.
          </p>
        ) : null}
      </div>

      <form onSubmit={simular} className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm block">
          <span className="text-slate-500">Dívida</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1.5"
            value={passivoId}
            onChange={(e) => {
              setPassivoId(e.target.value);
              const p = passivos.find((x) => String(x.id) === e.target.value);
              if (p) setValor(String(p.parcelaAtual ?? ''));
            }}
          >
            {passivos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.credor} · CET {fmtPct(p.cetEfetivoAa)} · saldo {fmtBRL(p.saldoDevedor)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm block">
          <span className="text-slate-500">Valor a amortizar (R$)</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1.5"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
          />
        </label>
        <label className="text-sm block">
          <span className="text-slate-500">Modalidade</span>
          <select
            className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1.5"
            value={modalidade}
            onChange={(e) => setModalidade(e.target.value)}
          >
            <option value="REDUZIR_PRAZO">Reduzir prazo (maximiza economia de juros)</option>
            <option value="REDUZIR_PARCELA">Reduzir parcela (maximiza fluxo mensal)</option>
          </select>
        </label>
        <label className="text-sm block">
          <span className="text-slate-500">Retorno líquido da alternativa (% a.a.) — opcional</span>
          <input
            className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1.5"
            value={retornoAlt}
            onChange={(e) => setRetornoAlt(e.target.value)}
            placeholder="usa taxa de referência se vazio"
          />
        </label>
        <div className="md:col-span-2">
          <button
            type="submit"
            disabled={loading || !passivoId}
            className="px-4 py-2 rounded-md bg-teal-700 text-white text-sm hover:bg-teal-800 disabled:opacity-50"
          >
            {loading ? 'Calculando…' : 'Comparar'}
          </button>
        </div>
      </form>

      {resultado ? (
        <section className="space-y-3">
          <div className={`rounded-lg border px-4 py-3 text-sm ${recomendacaoTom(resultado.recomendacao)}`}>
            <p className="font-semibold">{recomendacaoLabel(resultado.recomendacao)}</p>
            <p className="mt-1 opacity-90">{resultado.explicacao}</p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric label="CET da dívida" value={fmtPct(resultado.cetDividaAa)} />
            <Metric label="Retorno líquido alternativa" value={fmtPct(resultado.retornoAlternativaLiquidaAa)} />
            <Metric label="Diferencial" value={`${fmtPct(resultado.diferencialPpAa)} a.a.`} highlight />
            <Metric label="Impacto PL 12m" value={fmtBRL(resultado.impactoPl12m)} />
          </div>

          {/* Bloco 4: quatro métricas na mesma altura, peso visual idêntico */}
          <div
            data-testid="armadilha-nominal"
            className="rounded-lg border-2 border-slate-400 dark:border-slate-500 bg-slate-50 dark:bg-slate-900/60 p-4"
          >
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-3">
              Armadilha nominal × decisão real — peso visual equivalente
            </p>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricIgual
                label="Meses eliminados"
                sub="gatilho emocional"
                value={String(resultado.mesesEliminados ?? 0)}
              />
              <MetricIgual
                label="Valor nominal eliminado"
                sub="não é o ganho"
                value={fmtBRL(resultado.valorNominalEliminado)}
              />
              <MetricIgual
                label="Economia em valor presente"
                sub="ganho real"
                value={fmtBRL(resultado.economiaValorPresente)}
                decisoria
              />
              <MetricIgual
                label="Taxa implícita da amortização"
                sub="métrica decisória"
                value={fmtPct(resultado.taxaImplicitaAa)}
                decisoria
              />
            </div>
            <p className="text-xs text-slate-500 mt-3">
              Eliminar meses do final do contrato Price não é retorno 23× — o ganho é o juro embutido
              trazido a valor presente.
            </p>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
            <Metric label="Caixa livre" value={fmtBRL(resultado.caixaLivre)} />
            <Metric
              label="RF total × reserva líquida"
              value={`${fmtBRL(resultado.rendaFixaTotal)} / ${fmtBRL(resultado.reservaEmergenciaLiquida)}`}
            />
            <Metric label="Piso reserva" value={fmtBRL(resultado.pisoReserva)} />
            <Metric
              label="Base da comparação"
              value={resultado.baseComparacao || '—'}
            />
          </div>

          {resultado.taxaReferenciaDesatualizada ? (
            <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              Taxa de referência desatualizada
              {resultado.taxaReferenciaAtualizadaEm
                ? ` (desde ${new Date(resultado.taxaReferenciaAtualizadaEm).toLocaleDateString('pt-BR')})`
                : ''}
              . O comparador inteiro depende deste número.
            </p>
          ) : null}

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <h2 className="text-sm font-medium">Governança — solicitar ou registrar</h2>
            <label className="text-sm block">
              <span className="text-slate-500">Racional (obrigatório)</span>
              <textarea
                className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1.5 min-h-[72px]"
                value={racional}
                onChange={(e) => setRacional(e.target.value)}
              />
            </label>
            {resultado.recomendacao === 'BLOQUEADO_RESERVA' && (
              <label className="text-sm block">
                <span className="text-slate-500">Justificativa de reserva</span>
                <textarea
                  className="mt-1 w-full rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1.5"
                  value={justReserva}
                  onChange={(e) => setJustReserva(e.target.value)}
                />
              </label>
            )}
            {resultado.ultrapassaTetoComEstaOperacao ? (
              <label className="text-sm block">
                <span className="text-slate-500">Justificativa reforçada de desvio do teto anual (obrigatória)</span>
                <textarea
                  className="mt-1 w-full rounded-md border border-red-300 dark:border-red-700 bg-transparent px-2 py-1.5"
                  value={justTeto}
                  onChange={(e) => setJustTeto(e.target.value)}
                />
              </label>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={loading}
                onClick={solicitar}
                className="px-4 py-2 rounded-md border border-teal-700 text-teal-800 dark:text-teal-300 text-sm hover:bg-teal-50 disabled:opacity-50"
              >
                Solicitar (reflexão 48h se ≥ 1 parcela)
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => setMostrarRegistro((v) => !v)}
                className="px-4 py-2 rounded-md border border-slate-400 text-sm"
              >
                Registrar executada (a posteriori)
              </button>
            </div>
            {mostrarRegistro ? (
              <div className="rounded-md bg-slate-100 dark:bg-slate-800 px-3 py-3 space-y-2">
                <p className="text-xs text-slate-600 dark:text-slate-300">
                  Use quando a amortização já foi feita no banco/credora. Atualiza saldo, teto e cronograma.
                </p>
                <label className="text-sm block">
                  Data da efetivação
                  <input
                    type="date"
                    className="mt-1 block rounded-md border border-slate-300 dark:border-slate-600 bg-transparent px-2 py-1"
                    value={regData}
                    onChange={(e) => setRegData(e.target.value)}
                  />
                </label>
                <button
                  type="button"
                  onClick={registrarExecutada}
                  className="px-3 py-1.5 rounded-md bg-slate-800 text-white text-xs"
                >
                  Confirmar registro
                </button>
              </div>
            ) : null}
            {solicitacao ? (
              <div className="text-sm rounded-md bg-slate-100 dark:bg-slate-800 px-3 py-2 space-y-2">
                <p>
                  Status: <strong>{solicitacao.status}</strong>
                  {solicitacao.origem ? ` · origem ${solicitacao.origem}` : ''}
                  {solicitacao.pendenteAte
                    ? ` · reflexão até ${new Date(solicitacao.pendenteAte).toLocaleString('pt-BR')}`
                    : ''}
                </p>
                <p className="text-slate-600 dark:text-slate-300">{solicitacao.explicacaoGovernanca}</p>
                {(solicitacao.status === 'PRONTA' || solicitacao.status === 'PENDENTE_REFLEXAO') && (
                  <button
                    type="button"
                    onClick={() => confirmar(solicitacao.id)}
                    className="px-3 py-1.5 rounded-md bg-slate-800 text-white text-xs"
                  >
                    Confirmar decisão (registra; não executa no banco)
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4">
        <h2 className="text-sm font-medium mb-3">Ordem racional de quitação (CET ↓)</h2>
        {ranking.length === 0 ? (
          <p className="text-sm text-slate-500">Cadastre passivos para ver o ranking.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="py-2 pr-3">Credor</th>
                  <th className="py-2 pr-3">CET</th>
                  <th className="py-2 pr-3">vs alt.</th>
                  <th className="py-2">Recomendação</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r) => (
                  <tr key={r.passivoId} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3">{r.credor}</td>
                    <td className="py-2 pr-3 tabular-nums">{fmtPct(r.cetDividaAa)}</td>
                    <td className="py-2 pr-3 tabular-nums">{fmtPct(r.diferencialPpAa)} p.p.</td>
                    <td className="py-2">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded border ${recomendacaoTom(r.recomendacao)}`}>
                        {recomendacaoLabel(r.recomendacao)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {historico.length > 0 ? (
        <section className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
          <h2 className="text-sm font-medium mb-2">Registro de decisões</h2>
          <ul className="text-sm space-y-2">
            {historico.slice(0, 10).map((h) => (
              <li key={h.id} className="flex flex-wrap gap-x-3 gap-y-1 text-slate-600 dark:text-slate-300">
                <span>#{h.id}</span>
                <span>{fmtBRL(h.valor)}</span>
                <span>{h.status}</span>
                <span>{h.origem}</span>
                <span>{h.recomendacao}</span>
                {h.status === 'PENDENTE_REFLEXAO' || h.status === 'PRONTA' ? (
                  <button type="button" className="underline text-teal-700" onClick={() => confirmar(h.id)}>
                    Confirmar
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Metric({ label, value, highlight, muted }) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        highlight
          ? 'border-teal-600 bg-teal-50/80 dark:bg-teal-950/30'
          : muted
            ? 'border-slate-200 dark:border-slate-700 opacity-80'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
      }`}
    >
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`text-lg font-semibold tabular-nums mt-0.5 ${highlight ? 'text-teal-800 dark:text-teal-200' : ''}`}>
        {value}
      </p>
    </div>
  );
}

/** Quatro células idênticas em altura/tipografia — Bloco 4. */
function MetricIgual({ label, sub, value, decisoria }) {
  return (
    <div
      className={`rounded-md border px-3 py-3 min-h-[104px] flex flex-col justify-between ${
        decisoria
          ? 'border-teal-700 bg-teal-50 dark:bg-teal-950/40'
          : 'border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900'
      }`}
    >
      <div>
        <p className="text-[11px] uppercase tracking-wide text-slate-500 leading-tight">{label}</p>
        <p className="text-[10px] text-slate-400 mt-0.5">{sub}</p>
      </div>
      <p className={`text-xl font-semibold tabular-nums leading-none ${decisoria ? 'text-teal-900 dark:text-teal-100' : 'text-slate-900 dark:text-slate-100'}`}>
        {value}
      </p>
    </div>
  );
}

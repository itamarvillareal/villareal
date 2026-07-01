import { useEffect, useState } from 'react';
import { ChevronLeft, Lock, SlidersHorizontal, X } from 'lucide-react';
import {
  loadConfigCalculoCliente,
  saveConfigCalculoCliente,
  padCliente8Config,
  refreshConfigCalculoClienteFromApi,
  normalizarHonorariosValorFixo,
} from '../data/clienteConfigCalculoStorage.js';
import { normalizarRegraInicioCobrancaDias } from '../domain/cobrancaRegraInicio.js';
import { featureFlags } from '../config/featureFlags.js';
import { INDICES_CALCULO, PERIODICIDADE_OPCOES, MODELOS_LISTA_DEBITOS } from '../data/calculosIndices.js';
import { useCloseOnEscape } from '../hooks/useCloseOnEscape.js';

const CARD =
  'flex h-full min-h-0 flex-col rounded-lg border border-slate-200 bg-slate-50/80 p-2.5 shadow-sm';
const LEGEND = 'text-xs font-semibold text-slate-800 px-0.5';
const RADIO =
  'h-3.5 w-3.5 shrink-0 border-slate-300 text-indigo-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:opacity-100';
const INPUT_BASE =
  'w-full rounded-md border border-slate-300 bg-white py-1.5 pl-2.5 pr-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:border-indigo-400';
const INPUT_SUFFIX = `${INPUT_BASE} pr-9`;
const INPUT_LEITURA =
  'border-transparent bg-slate-50/90 text-slate-900 shadow-none cursor-default focus-visible:ring-0';
const LABEL_RADIO_BASE =
  'flex min-h-[1.75rem] cursor-pointer items-center gap-2 rounded px-1.5 py-0.5 text-xs hover:bg-white/70 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500';

/** @param {boolean} selecionado @param {boolean} somenteLeitura */
function classeLabelRadio(selecionado, somenteLeitura) {
  if (!somenteLeitura) {
    return `${LABEL_RADIO_BASE} text-slate-700`;
  }
  if (selecionado) {
    return `${LABEL_RADIO_BASE} cursor-default font-medium text-slate-900 hover:bg-transparent`;
  }
  return `${LABEL_RADIO_BASE} cursor-default text-slate-500 hover:bg-transparent`;
}

function classeInput(somenteLeitura, salvando) {
  if (somenteLeitura) return `${INPUT_BASE} ${INPUT_LEITURA}`;
  if (salvando) return `${INPUT_BASE} cursor-wait opacity-80`;
  return INPUT_BASE;
}

const REGRA_INICIO_OPCOES = [
  { valor: 1, label: 'Importar tudo' },
  {
    valor: 61,
    label: '60+1 dias (condicional)',
  },
];

const REGRA_INICIO_TOOLTIP =
  'Condicional: se a unidade já tem débito cadastrado com mais de 60 dias, importa todas as taxas da planilha; ' +
  'caso contrário, só importa quando alguma taxa tiver mais de 60 dias de atraso.';

/**
 * Modal "Configurações Personalizadas do Cliente" — padrões de cálculo por código de cliente.
 * @param {{ open: boolean, codigoCliente: string, nomeCliente?: string, onClose?: () => void, somenteLeitura?: boolean }} props
 */
export function ModalConfiguracoesCalculoCliente({
  open,
  codigoCliente,
  nomeCliente,
  onClose,
  somenteLeitura = false,
}) {
  const [honorariosTipo, setHonorariosTipo] = useState('fixos');
  const [honorariosValor, setHonorariosValor] = useState('0 %');
  const [honorariosVariaveisTexto, setHonorariosVariaveisTexto] = useState('');
  const [juros, setJuros] = useState('1 %');
  const [multa, setMulta] = useState('0 %');
  const [indice, setIndice] = useState('INPC');
  const [periodicidade, setPeriodicidade] = useState('mensal');
  const [modeloListaDebitos, setModeloListaDebitos] = useState('01');
  const [regraInicioCobrancaDias, setRegraInicioCobrancaDias] = useState(1);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState('');

  useCloseOnEscape(open, onClose, { enabled: !salvando });

  const inputsDesabilitados = somenteLeitura || salvando;
  const inputCls = classeInput(somenteLeitura, salvando);
  const inputSuffixCls = `${inputCls} pr-9`;

  useEffect(() => {
    if (!open || !codigoCliente) return;
    let cancelled = false;
    setErroSalvar('');
    (async () => {
      if (featureFlags.useApiCalculos) {
        await refreshConfigCalculoClienteFromApi(codigoCliente);
      }
      if (cancelled) return;
      const c = loadConfigCalculoCliente(codigoCliente);
      setHonorariosTipo(c.honorariosTipo === 'variaveis' ? 'variaveis' : 'fixos');
      setHonorariosValor(
        c.honorariosTipo === 'variaveis' ? '' : normalizarHonorariosValorFixo(c.honorariosValor ?? '0 %')
      );
      setHonorariosVariaveisTexto(c.honorariosVariaveisTexto ?? '');
      setJuros(c.juros ?? '1 %');
      setMulta(c.multa ?? '0 %');
      setIndice(c.indice ?? 'INPC');
      setPeriodicidade(c.periodicidade ?? 'mensal');
      setModeloListaDebitos(c.modeloListaDebitos ?? '01');
      setRegraInicioCobrancaDias(normalizarRegraInicioCobrancaDias(c.regraInicioCobrancaDias));
    })();
    return () => {
      cancelled = true;
    };
  }, [open, codigoCliente]);

  if (!open) return null;

  const codPad = padCliente8Config(codigoCliente);

  async function salvar() {
    if (inputsDesabilitados) return;
    setErroSalvar('');
    setSalvando(true);
    try {
      await saveConfigCalculoCliente(codigoCliente, {
        honorariosTipo,
        honorariosValor:
          honorariosTipo === 'fixos' ? normalizarHonorariosValorFixo(honorariosValor) : '',
        honorariosVariaveisTexto,
        juros,
        multa,
        indice,
        periodicidade,
        modeloListaDebitos,
        regraInicioCobrancaDias,
      });
      onClose?.();
    } catch (e) {
      setErroSalvar(e?.message || 'Falha ao salvar configurações.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-2 sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-config-calc-titulo"
    >
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xl ring-1 ring-slate-900/5">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-violet-200/40 bg-gradient-to-r from-violet-600 via-indigo-600 to-slate-800 px-3 py-2 text-white shadow-sm">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:hidden disabled:opacity-50"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h2
              id="modal-config-calc-titulo"
              className="flex items-center gap-1.5 text-sm font-semibold leading-tight sm:text-base"
            >
              <SlidersHorizontal className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              <span className="truncate">Configurações do cliente</span>
              {somenteLeitura ? (
                <Lock className="h-3.5 w-3.5 shrink-0 text-indigo-200" aria-hidden title="Somente leitura" />
              ) : null}
            </h2>
            <p className="truncate text-[11px] text-indigo-100/95">
              <span className="font-mono font-medium text-white">{codPad}</span>
              {nomeCliente ? ` · ${nomeCliente}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {somenteLeitura ? (
          <p className="shrink-0 border-b border-amber-200/80 bg-amber-50 px-3 py-1.5 text-[11px] leading-snug text-amber-950">
            Somente leitura — use <strong>Habilitar edição</strong> no cadastro para alterar.
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2.5 sm:px-4 sm:py-3">
          <section aria-labelledby="sec-calculos-titulo">
            <p
              id="sec-calculos-titulo"
              className="mb-2 text-[11px] leading-snug text-slate-600"
            >
              Padrão na tela <strong className="text-slate-800">Cálculos</strong> para todos os processos deste
              cliente (editável por processo depois).
            </p>

            <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 md:items-stretch">
              {/* Coluna 1 — Honorários + Cobrança automática */}
              <div className={`${CARD} gap-0`}>
                <fieldset disabled={inputsDesabilitados} className="min-h-0 border-0 p-0">
                  <legend className={LEGEND}>Honorários</legend>
                  <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Tipo de honorários">
                    <label className={classeLabelRadio(honorariosTipo === 'fixos', somenteLeitura)}>
                      <input
                        type="radio"
                        name="hon-mod"
                        checked={honorariosTipo === 'fixos'}
                        onChange={() => setHonorariosTipo('fixos')}
                        className={RADIO}
                        disabled={inputsDesabilitados}
                      />
                      Fixos
                    </label>
                    <label className={classeLabelRadio(honorariosTipo === 'variaveis', somenteLeitura)}>
                      <input
                        type="radio"
                        name="hon-mod"
                        checked={honorariosTipo === 'variaveis'}
                        onChange={() => setHonorariosTipo('variaveis')}
                        className={RADIO}
                        disabled={inputsDesabilitados}
                      />
                      Variáveis
                    </label>
                  </div>
                  <div className="mt-1.5">
                    {honorariosTipo === 'variaveis' ? (
                      <>
                        <label htmlFor="hon-var-texto" className="mb-0.5 block text-[11px] font-medium text-slate-600">
                          Faixas (%)
                        </label>
                        <textarea
                          id="hon-var-texto"
                          value={honorariosVariaveisTexto}
                          onChange={(e) => setHonorariosVariaveisTexto(e.target.value)}
                          rows={3}
                          readOnly={somenteLeitura}
                          disabled={salvando}
                          className={`${inputCls} min-h-[4.5rem] resize-y font-mono text-xs leading-snug`}
                          placeholder={'> 30 = 0% · < 60 = 20%'}
                        />
                      </>
                    ) : (
                      <>
                        <label htmlFor="hon-fix-valor" className="mb-0.5 block text-[11px] font-medium text-slate-600">
                          Percentual fixo
                        </label>
                        <div className="relative">
                          <input
                            id="hon-fix-valor"
                            type="text"
                            value={honorariosValor}
                            onChange={(e) => setHonorariosValor(e.target.value)}
                            readOnly={somenteLeitura}
                            disabled={salvando}
                            className={inputSuffixCls}
                            placeholder="20"
                          />
                          <span
                            className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500"
                            aria-hidden
                          >
                            %
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                </fieldset>

                <div
                  className="mt-2.5 border-t border-slate-200 pt-2.5"
                  role="separator"
                  aria-label="Cobrança automática"
                >
                  <p className="text-[11px] font-semibold leading-tight text-sky-900">
                    Cobrança automática (.xls)
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-slate-500" title="Fora dos padrões de Cálculos">
                    Independente dos padrões de Cálculos — só importação .xls
                  </p>
                  <fieldset disabled={inputsDesabilitados} className="mt-1.5 min-w-0 border-0 p-0">
                    <legend className="text-[11px] font-medium text-slate-700">Regra de início</legend>
                    <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
                      Define quais unidades da planilha .xls entram na importação automática.
                    </p>
                    <div
                      className="mt-1 flex flex-col gap-0.5"
                      role="radiogroup"
                      aria-label="Regra de início de cobrança"
                    >
                      {REGRA_INICIO_OPCOES.map((op) => (
                        <label
                          key={op.valor}
                          className={`${classeLabelRadio(regraInicioCobrancaDias === op.valor, somenteLeitura)} ${
                            regraInicioCobrancaDias === op.valor && !somenteLeitura
                              ? 'bg-sky-50/80'
                              : ''
                          }`}
                          title={REGRA_INICIO_TOOLTIP}
                        >
                          <input
                            type="radio"
                            name="regra-inicio-modal"
                            checked={regraInicioCobrancaDias === op.valor}
                            onChange={() => setRegraInicioCobrancaDias(op.valor)}
                            className={RADIO}
                            disabled={inputsDesabilitados}
                          />
                          {op.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </div>
              </div>

              {/* Encargos */}
              <fieldset disabled={inputsDesabilitados} className={CARD}>
                <legend className={LEGEND}>Encargos</legend>
                <div className="mt-1.5 space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="cfg-juros" className="mb-0.5 block text-[11px] font-medium text-slate-600">
                        Juros
                      </label>
                      <div className="relative">
                        <input
                          id="cfg-juros"
                          type="text"
                          value={juros}
                          onChange={(e) => setJuros(e.target.value)}
                          readOnly={somenteLeitura}
                          disabled={salvando}
                          className={inputSuffixCls}
                          placeholder="1"
                        />
                        <span
                          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500"
                          aria-hidden
                        >
                          %
                        </span>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="cfg-multa" className="mb-0.5 block text-[11px] font-medium text-slate-600">
                        Multa
                      </label>
                      <div className="relative">
                        <input
                          id="cfg-multa"
                          type="text"
                          value={multa}
                          onChange={(e) => setMulta(e.target.value)}
                          readOnly={somenteLeitura}
                          disabled={salvando}
                          className={inputSuffixCls}
                          placeholder="0"
                        />
                        <span
                          className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500"
                          aria-hidden
                        >
                          %
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="border-t border-slate-200/80 pt-2">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-700">Índice</span>
                    <div
                      className="grid grid-cols-2 gap-x-1 gap-y-0"
                      role="radiogroup"
                      aria-label="Índice de correção"
                    >
                      {INDICES_CALCULO.map((nome) => (
                        <label key={nome} className={classeLabelRadio(indice === nome, somenteLeitura)}>
                          <input
                            type="radio"
                            name="indice-modal"
                            checked={indice === nome}
                            onChange={() => setIndice(nome)}
                            className={RADIO}
                            disabled={inputsDesabilitados}
                          />
                          <span className="truncate">{nome}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </fieldset>

              {/* Apresentação */}
              <fieldset disabled={inputsDesabilitados} className={CARD}>
                <legend className={LEGEND}>Apresentação</legend>
                <div className="mt-1.5 space-y-2">
                  <div>
                    <span className="mb-1 block text-[11px] font-semibold text-slate-700">Periodicidade</span>
                    <div className="space-y-0" role="radiogroup" aria-label="Periodicidade">
                      {PERIODICIDADE_OPCOES.map((p) => (
                        <label key={p.id} className={classeLabelRadio(periodicidade === p.id, somenteLeitura)}>
                          <input
                            type="radio"
                            name="period-modal"
                            checked={periodicidade === p.id}
                            onChange={() => setPeriodicidade(p.id)}
                            className={RADIO}
                            disabled={inputsDesabilitados}
                          />
                          {p.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="border-t border-slate-200/80 pt-2">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-700">Modelo lista</span>
                    <div className="space-y-0" role="radiogroup" aria-label="Modelo lista de débitos">
                      {MODELOS_LISTA_DEBITOS.map((m) => (
                        <label
                          key={m}
                          className={classeLabelRadio(modeloListaDebitos === m, somenteLeitura)}
                        >
                          <input
                            type="radio"
                            name="modelo-modal"
                            checked={modeloListaDebitos === m}
                            onChange={() => setModeloListaDebitos(m)}
                            className={RADIO}
                            disabled={inputsDesabilitados}
                          />
                          Modelo {m}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </fieldset>
            </div>
          </section>

          {erroSalvar ? (
            <p className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800" role="alert">
              {erroSalvar}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-2 border-t border-slate-200 bg-slate-50 px-3 py-2 sm:px-4">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="min-h-9 rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
          >
            Fechar
          </button>
          {!somenteLeitura ? (
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={inputsDesabilitados}
              className="min-h-9 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-60"
            >
              {salvando ? 'Salvando…' : 'Salvar'}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

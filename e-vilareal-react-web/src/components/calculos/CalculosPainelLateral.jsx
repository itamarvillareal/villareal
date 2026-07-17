import { BarChart2, Check, ChevronDown, ChevronUp, MessageCircle, RefreshCw } from 'lucide-react';
import { INDICES_CALCULO, PERIODICIDADE_OPCOES } from '../../data/calculosIndices.js';
import {
  editarPercentualFixoCampo,
  normalizarHonorariosValorFixo,
  percentualFixoParaCampo,
} from '../../data/clienteConfigCalculoStorage.js';
import { resolverAliasHojeEmTexto } from '../../services/hjDateAliasService.js';
import { featureFlags } from '../../config/featureFlags.js';

const INDICES = INDICES_CALCULO;

const inputClass =
  'w-full px-2 py-1.5 max-lg:py-2.5 max-lg:text-base border border-slate-300 rounded text-sm bg-white';

/**
 * Painel lateral do formulário de Cálculos (rodada, parâmetros e ações).
 * @param {'rodada' | 'parametros' | 'acoes' | 'completo'} secao
 */
export function CalculosPainelLateral({
  secao = 'completo',
  layoutMobile = false,
  tabAtiva,
  codClienteManual,
  procManual,
  dimensao,
  pagina,
  totalPaginas,
  dataCalculo,
  juros,
  multa,
  honorariosTipo,
  honorariosValor,
  honorariosVariaveisTexto,
  indice,
  periodicidade,
  indiceMenuAberto,
  calculoAceito,
  modoAlteracao,
  aceitarPagamento,
  aceitarPagamentoDisponivel = true,
  limpezaAtiva,
  sincronizandoRodadasApi,
  inputCodClienteRodadaRef,
  inputProcRodadaRef,
  inputDimensaoRodadaRef,
  btnIrRodadaRef,
  indicePickerRef,
  debitosPlanilhaInputRef,
  SpinnerField,
  SpinnerFieldManual,
  onCodClienteChange,
  onProcChange,
  onDimensaoChange,
  onDimensaoCommitEnter,
  onPaginaChange,
  onAplicarClienteProc,
  onAplicarClienteProcComValores,
  onCommitClienteProc,
  onEnterCampoRodada,
  onUpdatePainelCampo,
  onDataCalculoChange,
  onDataCalculoBlur,
  onToggleIndiceMenu,
  onAbrirConferenciaIndices,
  onSelecionarIndice,
  onAlternarLimpeza,
  onAlternarAceitarPagamento,
  onModoAlteracaoChange,
  onImportarDebitos,
  onDebitosFileChange,
  onSincronizarBanco,
  onGerarPdf,
  onGerarWord,
  onCobrancaWhatsApp,
}) {
  const gridRodada = layoutMobile
    ? 'grid grid-cols-1 gap-3'
    : 'grid grid-cols-1 min-[420px]:grid-cols-3 gap-2 lg:block lg:space-y-2';
  const gridParametros = layoutMobile
    ? 'grid grid-cols-1 gap-3'
    : 'grid grid-cols-1 sm:grid-cols-2 gap-2 lg:block lg:space-y-2';

  const secaoRodada = (
    <div className="rounded border border-slate-200 bg-white p-1.5 shadow-sm">
      <div className={gridRodada}>
        <div>
          <label className="mb-0.5 block text-[11px] font-medium text-slate-700">Cod Cliente</label>
          <SpinnerFieldManual
            inputRef={inputCodClienteRodadaRef}
            value={codClienteManual}
            onChange={onCodClienteChange}
            min={1}
            step={1}
            className="w-full"
            formatDisplay={(n) => String(Math.max(1, Math.floor(Number(n) || 1))).padStart(8, '0')}
            parseInput={(s) => Number(String(s).replace(/\D/g, ''))}
            onStep={(nextCod) => onAplicarClienteProcComValores(nextCod, procManual)}
            onBlur={onCommitClienteProc}
            onKeyDown={(e) => onEnterCampoRodada(e, inputProcRodadaRef)}
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] font-medium text-slate-700">Proc.</label>
          <SpinnerFieldManual
            inputRef={inputProcRodadaRef}
            value={procManual}
            onChange={onProcChange}
            min={1}
            step={1}
            className="w-full"
            formatDisplay={(n) => String(Math.max(1, Math.floor(Number(n) || 1)))}
            parseInput={(s) => Number(String(s).replace(/\D/g, ''))}
            onStep={(nextProc) => onAplicarClienteProcComValores(codClienteManual, nextProc)}
            onBlur={onCommitClienteProc}
            onKeyDown={(e) => onEnterCampoRodada(e, inputDimensaoRodadaRef)}
          />
        </div>
        <div>
          <label className="mb-0.5 block text-[11px] font-medium text-slate-700">Dimensão</label>
          <SpinnerField
            inputRef={inputDimensaoRodadaRef}
            value={dimensao}
            onChange={onDimensaoChange}
            min={0}
            className="w-full"
            onKeyDown={(e) => onEnterCampoRodada(e, btnIrRodadaRef, onDimensaoCommitEnter)}
          />
        </div>
        <button
          ref={btnIrRodadaRef}
          type="button"
          onClick={onAplicarClienteProc}
          className={`w-full rounded bg-blue-600 px-2 py-2.5 text-sm font-medium text-white hover:bg-blue-700 lg:py-1.5 lg:text-xs ${layoutMobile ? '' : 'col-span-1 min-[420px]:col-span-3 lg:col-span-1'}`}
        >
          Ir
        </button>
      </div>
    </div>
  );

  const secaoParametros =
    tabAtiva === 'Títulos' ? (
      <div className={gridParametros}>
        <div>
          <label className="mb-0.5 block text-xs font-medium text-slate-700">Página</label>
          <SpinnerField value={pagina} onChange={onPaginaChange} min={1} className="w-full lg:w-24" />
          <p className="mt-1 text-[11px] text-slate-500">de {String(totalPaginas).padStart(2, '0')}</p>
        </div>
        <div className="flex items-end">
          <button
            type="button"
            onClick={onAlternarLimpeza}
            className="w-full rounded border border-slate-200 bg-white px-2 py-2.5 text-xs text-slate-700 hover:bg-slate-50 lg:py-1.5"
          >
            {limpezaAtiva ? 'Reverter limpeza' : 'Limpa Página Toda'}
          </button>
        </div>
        <div className={layoutMobile ? '' : 'col-span-2 lg:col-span-1'}>
          <label className="mb-0.5 block text-xs font-medium text-slate-700">Data do Cálculo:</label>
          <input
            type="text"
            value={dataCalculo}
            disabled={calculoAceito && !modoAlteracao}
            onChange={onDataCalculoChange}
            onBlur={onDataCalculoBlur}
            placeholder="dd/mm/aaaa ou hj"
            className={`${inputClass} disabled:bg-slate-100 disabled:text-slate-500`}
          />
        </div>
        <div>
          <label className="mb-0.5 block text-xs font-medium text-slate-700">Juros:</label>
          <input
            type="text"
            value={juros}
            onChange={(e) => onUpdatePainelCampo({ juros: e.target.value })}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-0.5 block text-xs font-medium text-slate-700">Multa:</label>
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={percentualFixoParaCampo(multa)}
              onChange={(e) => onUpdatePainelCampo({ multa: editarPercentualFixoCampo(e.target.value) })}
              onBlur={(e) =>
                onUpdatePainelCampo({ multa: normalizarHonorariosValorFixo(e.target.value) })
              }
              placeholder="2"
              className={`${inputClass} pr-7`}
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500" aria-hidden>
              %
            </span>
          </div>
        </div>
        <div className={`rounded border border-slate-200 bg-white p-2 shadow-sm ${layoutMobile ? '' : 'col-span-2 lg:col-span-1'}`}>
          <p className="mb-1 text-[11px] font-medium text-slate-700">Honorários</p>
          <div className="mb-1 flex gap-3">
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="radio"
                name={layoutMobile ? 'honorarios-mobile' : 'honorarios'}
                checked={honorariosTipo === 'fixos'}
                onChange={() => onUpdatePainelCampo({ honorariosTipo: 'fixos' })}
                className="text-slate-600"
              />
              Fixos
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="radio"
                name={layoutMobile ? 'honorarios-mobile' : 'honorarios'}
                checked={honorariosTipo === 'variaveis'}
                onChange={() => onUpdatePainelCampo({ honorariosTipo: 'variaveis' })}
                className="text-slate-600"
              />
              Variáveis
            </label>
          </div>
          {honorariosTipo === 'variaveis' && (
            <>
              <p className="mb-1 text-xs text-slate-500">
                Padrão sugerido: ≤ 30 dias = 0% | 31–60 dias = 10% | &gt; 60 dias = 20%
              </p>
              <textarea
                value={honorariosVariaveisTexto}
                onChange={(e) => onUpdatePainelCampo({ honorariosVariaveisTexto: e.target.value })}
                rows={3}
                placeholder="Regras personalizadas (texto livre)"
                className="mb-1 w-full rounded border border-slate-300 px-2 py-1 font-mono text-sm"
              />
            </>
          )}
          <div className="relative">
            <input
              type="text"
              inputMode="decimal"
              value={percentualFixoParaCampo(honorariosValor)}
              onChange={(e) =>
                onUpdatePainelCampo({ honorariosValor: editarPercentualFixoCampo(e.target.value) })
              }
              onBlur={(e) =>
                onUpdatePainelCampo({ honorariosValor: normalizarHonorariosValorFixo(e.target.value) })
              }
              placeholder="20"
              disabled={honorariosTipo !== 'fixos'}
              className={`${inputClass} pr-7 ${honorariosTipo !== 'fixos' ? 'bg-slate-50 text-slate-400' : ''}`}
            />
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500" aria-hidden>
              %
            </span>
          </div>
        </div>
        <div
          className={`relative rounded border border-slate-200 bg-white p-2 shadow-sm ${layoutMobile ? '' : 'col-span-2 lg:col-span-1'}`}
          ref={indicePickerRef}
        >
          <p className="mb-1 text-[11px] font-medium text-slate-700">Índice</p>
          <button
            type="button"
            onClick={onToggleIndiceMenu}
            onDoubleClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onAbrirConferenciaIndices();
            }}
            title="Clique para escolher; duplo clique para conferir índices mês a mês"
            className="flex w-full items-center justify-between gap-1.5 rounded border border-slate-200 bg-white px-2 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 lg:py-1.5 lg:text-[11px]"
            aria-expanded={indiceMenuAberto}
            aria-haspopup="listbox"
          >
            <span className="flex min-w-0 items-center gap-1 truncate">
              {indice}
              {indice === 'INPC' && <BarChart2 className="h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />}
            </span>
            {indiceMenuAberto ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
            )}
          </button>
          {indiceMenuAberto ? (
            <ul
              className="absolute left-2 right-2 top-full z-30 mt-0.5 max-h-48 overflow-y-auto rounded border border-slate-200 bg-white py-0.5 shadow-lg"
              role="listbox"
              aria-label="Escolher índice"
            >
              {INDICES.map((nome) => (
                <li key={nome} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={indice === nome}
                    onClick={() => onSelecionarIndice(nome)}
                    className={`flex w-full items-center gap-1.5 px-3 py-2.5 text-left text-sm hover:bg-slate-50 lg:py-1.5 lg:text-[11px] ${
                      indice === nome ? 'bg-blue-50 font-medium text-blue-900' : 'text-slate-800'
                    }`}
                  >
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                      {indice === nome ? <Check className="h-3 w-3 text-blue-600" strokeWidth={3} aria-hidden /> : null}
                    </span>
                    <span className="truncate">{nome}</span>
                    {nome === 'INPC' && <BarChart2 className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className={`rounded border border-slate-200 bg-white p-2 shadow-sm ${layoutMobile ? '' : 'col-span-2 lg:col-span-1'}`}>
          <p className="mb-0.5 text-[11px] font-medium text-slate-700">Periodicidade (sugestão)</p>
          <select
            value={periodicidade}
            onChange={(e) => onUpdatePainelCampo({ periodicidade: e.target.value })}
            className={inputClass}
          >
            {PERIODICIDADE_OPCOES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    ) : (
      <p className="py-2 text-sm leading-snug text-slate-500">
        Os parâmetros de cálculo (data, juros, multa, honorários e índice) ficam disponíveis na aba{' '}
        <strong>Títulos</strong>.
      </p>
    );

  const secaoAcoes = (
    <div className="space-y-2 border-t border-slate-200 pt-2">
      <button
        type="button"
        className="w-full rounded border border-slate-200 bg-blue-600 px-2 py-2.5 text-xs font-medium text-white hover:bg-blue-700 lg:py-1.5"
      >
        Configurações
      </button>
      {!layoutMobile && (
        <>
          <label
            className={`flex items-center gap-2 py-0.5 text-xs ${aceitarPagamentoDisponivel ? 'cursor-pointer' : 'cursor-wait opacity-60'}`}
            title={aceitarPagamentoDisponivel ? undefined : 'Aguarde o cálculo terminar de carregar.'}
          >
            <input
              type="checkbox"
              checked={aceitarPagamento}
              disabled={!aceitarPagamentoDisponivel}
              onChange={(e) => onAlternarAceitarPagamento(e.target.checked)}
              className="rounded border-slate-300"
            />
            Aceitar Pagamento
          </label>
          <label className="flex cursor-pointer items-center gap-2 py-0.5 text-xs">
            <input
              type="checkbox"
              checked={modoAlteracao}
              onChange={(e) => onModoAlteracaoChange(e.target.checked)}
              className="rounded border-slate-300"
            />
            Modo de Alteração
          </label>
        </>
      )}
      <input
        ref={debitosPlanilhaInputRef}
        type="file"
        accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        className="hidden"
        aria-hidden="true"
        onChange={onDebitosFileChange}
      />
      <button
        type="button"
        onClick={onImportarDebitos}
        className="w-full rounded border border-slate-200 bg-white px-2 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50 lg:py-1.5"
      >
        Importar débitos (Excel)
      </button>
      {featureFlags.useApiCalculos && (
        <button
          type="button"
          disabled={sincronizandoRodadasApi}
          onClick={onSincronizarBanco}
          className="flex w-full items-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-60 lg:py-1.5"
        >
          <RefreshCw className={`h-4 w-4 shrink-0 ${sincronizandoRodadasApi ? 'animate-spin' : ''}`} aria-hidden />
          Sincronizar com banco
        </button>
      )}
      <button
        type="button"
        onClick={onGerarPdf}
        className="w-full rounded border border-slate-200 bg-white px-2 py-2.5 text-left text-xs text-slate-700 hover:bg-slate-50 lg:py-1.5"
      >
        Salvar Formulário em PDF
      </button>
      <button
        type="button"
        onClick={onGerarWord}
        className="w-full rounded border border-slate-200 bg-white px-2 py-2.5 text-xs text-slate-700 hover:bg-slate-50 lg:py-1.5"
      >
        Gerar no Word
      </button>
      <button
        type="button"
        onClick={onCobrancaWhatsApp}
        className="flex w-full items-center justify-center gap-1.5 rounded border border-emerald-300 bg-emerald-50 px-2 py-2.5 text-xs font-medium text-emerald-900 hover:bg-emerald-100 lg:py-1.5"
      >
        <MessageCircle className="h-4 w-4 shrink-0" aria-hidden />
        Cobrança WhatsApp
      </button>
      <button
        type="button"
        className="w-full rounded border border-slate-200 bg-white px-2 py-2.5 text-xs text-slate-700 hover:bg-slate-50 lg:py-1.5"
      >
        Email Automático
      </button>
    </div>
  );

  if (secao === 'rodada') return secaoRodada;
  if (secao === 'parametros') return secaoParametros;
  if (secao === 'acoes') return secaoAcoes;

  return (
    <div className="space-y-2">
      {secaoRodada}
      {secaoParametros}
      {secaoAcoes}
    </div>
  );
}

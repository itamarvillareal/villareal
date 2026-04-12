import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import {
  loadConfigCalculoCliente,
  saveConfigCalculoCliente,
  padCliente8Config,
  refreshConfigCalculoClienteFromApi,
} from '../data/clienteConfigCalculoStorage.js';
import { featureFlags } from '../config/featureFlags.js';
import { INDICES_CALCULO, PERIODICIDADE_OPCOES, MODELOS_LISTA_DEBITOS } from '../data/calculosIndices.js';

/**
 * Modal "Configurações Personalizadas do Cliente" — padrões de cálculo por código de cliente.
 */
export function ModalConfiguracoesCalculoCliente({ open, codigoCliente, nomeCliente, onClose }) {
  const [honorariosTipo, setHonorariosTipo] = useState('fixos');
  const [honorariosValor, setHonorariosValor] = useState('0');
  const [honorariosVariaveisTexto, setHonorariosVariaveisTexto] = useState('');
  const [juros, setJuros] = useState('1 %');
  const [multa, setMulta] = useState('0 %');
  const [indice, setIndice] = useState('INPC');
  const [periodicidade, setPeriodicidade] = useState('mensal');
  const [modeloListaDebitos, setModeloListaDebitos] = useState('01');

  useEffect(() => {
    if (!open || !codigoCliente) return;
    let cancelled = false;
    (async () => {
      if (featureFlags.useApiCalculos) {
        await refreshConfigCalculoClienteFromApi(codigoCliente);
      }
      if (cancelled) return;
      const c = loadConfigCalculoCliente(codigoCliente);
      setHonorariosTipo(c.honorariosTipo === 'variaveis' ? 'variaveis' : 'fixos');
      setHonorariosValor(c.honorariosValor ?? '0');
      setHonorariosVariaveisTexto(c.honorariosVariaveisTexto ?? '');
      setJuros(c.juros ?? '1 %');
      setMulta(c.multa ?? '0 %');
      setIndice(c.indice ?? 'INPC');
      setPeriodicidade(c.periodicidade ?? 'mensal');
      setModeloListaDebitos(c.modeloListaDebitos ?? '01');
    })();
    return () => {
      cancelled = true;
    };
  }, [open, codigoCliente]);

  if (!open) return null;

  const codPad = padCliente8Config(codigoCliente);

  function salvar() {
    saveConfigCalculoCliente(codigoCliente, {
      honorariosTipo,
      honorariosValor: honorariosTipo === 'fixos' ? honorariosValor : '',
      honorariosVariaveisTexto,
      juros,
      multa,
      indice,
      periodicidade,
      modeloListaDebitos,
    });
    onClose?.();
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-config-calc-titulo"
   >
      <div className="w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 bg-slate-50 shrink-0">
          <div>
            <h2 id="modal-config-calc-titulo" className="text-base font-semibold text-slate-900">
              Configurações Personalizadas do Cliente
            </h2>
            <p className="text-xs text-slate-600 mt-0.5">
              Cliente <span className="font-mono font-medium">{codPad}</span>
              {nomeCliente ? ` — ${nomeCliente}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1.5 text-slate-500 hover:bg-slate-200/80"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-xs text-slate-600 px-4 pt-3 border-b border-slate-100 pb-2">
          Estes valores são usados como <strong>padrão</strong> na tela <strong>Cálculos</strong> para todos os
          processos deste cliente, até que você altere manualmente naquele processo. Casos especiais podem usar
          configurações diferentes.
        </p>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Coluna 1 — Honorários */}
            <fieldset className="border border-slate-200 rounded-lg p-3 bg-slate-50/80">
              <legend className="text-sm font-semibold text-slate-800 px-1">Honorários</legend>
              <div className="flex gap-4 mt-2 mb-2">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="hon-mod"
                    checked={honorariosTipo === 'fixos'}
                    onChange={() => setHonorariosTipo('fixos')}
                    className="text-indigo-600"
                  />
                  Fixos
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="hon-mod"
                    checked={honorariosTipo === 'variaveis'}
                    onChange={() => setHonorariosTipo('variaveis')}
                    className="text-indigo-600"
                  />
                  Variáveis
                </label>
              </div>
              {honorariosTipo === 'variaveis' && (
                <textarea
                  value={honorariosVariaveisTexto}
                  onChange={(e) => setHonorariosVariaveisTexto(e.target.value)}
                  rows={5}
                  className="w-full text-sm font-mono border border-slate-300 rounded px-2 py-1.5 bg-white"
                  placeholder={'Ex.:\n> 30 = 0%\n< 30 < 60 = 10%\n< 60 = 20%'}
                />
              )}
              {honorariosTipo === 'fixos' && (
                <input
                  type="text"
                  value={honorariosValor}
                  onChange={(e) => setHonorariosValor(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded px-2 py-1.5 bg-white"
                  placeholder="Ex.: 10 %"
                />
              )}
            </fieldset>

            {/* Coluna 2 — Juros, Multa, Índice */}
            <div className="space-y-3">
              <fieldset className="border border-slate-200 rounded-lg p-3 bg-white">
                <label className="block text-sm font-medium text-slate-700 mb-1">Juros</label>
                <input
                  type="text"
                  value={juros}
                  onChange={(e) => setJuros(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded px-2 py-1.5"
                />
              </fieldset>
              <fieldset className="border border-slate-200 rounded-lg p-3 bg-white">
                <label className="block text-sm font-medium text-slate-700 mb-1">Multa</label>
                <input
                  type="text"
                  value={multa}
                  onChange={(e) => setMulta(e.target.value)}
                  className="w-full text-sm border border-slate-300 rounded px-2 py-1.5"
                />
              </fieldset>
              <fieldset className="border border-slate-200 rounded-lg p-3 bg-slate-50/80">
                <legend className="text-sm font-semibold text-slate-800 px-1">Índice</legend>
                <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {INDICES_CALCULO.map((nome) => (
                    <label key={nome} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="indice-modal"
                        checked={indice === nome}
                        onChange={() => setIndice(nome)}
                        className="text-indigo-600"
                      />
                      {nome}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>

            {/* Coluna 3 — Periodicidade + Modelo */}
            <div className="space-y-3">
              <fieldset className="border border-slate-200 rounded-lg p-3 bg-slate-50/80">
                <legend className="text-sm font-semibold text-slate-800 px-1">Sugestão de Periodicidade</legend>
                <div className="mt-2 space-y-1.5">
                  {PERIODICIDADE_OPCOES.map((p) => (
                    <label key={p.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="period-modal"
                        checked={periodicidade === p.id}
                        onChange={() => setPeriodicidade(p.id)}
                        className="text-indigo-600"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="border border-slate-200 rounded-lg p-3 bg-slate-50/80">
                <legend className="text-sm font-semibold text-slate-800 px-1">Modelo Lista de Débitos</legend>
                <div className="mt-2 space-y-1.5">
                  {MODELOS_LISTA_DEBITOS.map((m) => (
                    <label key={m} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input
                        type="radio"
                        name="modelo-modal"
                        checked={modeloListaDebitos === m}
                        onChange={() => setModeloListaDebitos(m)}
                        className="text-indigo-600"
                      />
                      Modelo {m}
                    </label>
                  ))}
                </div>
              </fieldset>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 px-4 py-3 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded border border-slate-300 bg-white text-slate-800 text-sm hover:bg-slate-100"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={salvar}
            className="px-5 py-2 rounded bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700"
          >
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

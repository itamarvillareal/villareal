import { useEffect, useState } from 'react';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape.js';
import { CalendarClock, ChevronLeft, Loader2, X } from 'lucide-react';
import {
  apiDateTimeParaBr,
  apiTimeParaBr,
  formatarDataInput,
  formatarHoraInput,
  montarBodyAgendamentoRequest,
  normalizarHora,
  PERIODOS_CADENCIA,
  validarCadenciaCliente,
} from '../../domain/agendamentoCadencia.js';
import {
  atualizarAgendamento,
  criarAgendamento,
  listarAgendamentosProcesso,
} from '../../repositories/agendamentoRepository.js';
import { normalizarDataBr } from '../../data/processosHistoricoData.js';

const CARD =
  'rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-[#0d1018]/60 p-3 space-y-3';
const INPUT =
  'w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0d1018] px-3 py-2 text-sm';
const LABEL = 'text-xs font-medium text-slate-600 dark:text-slate-400';

function estadoInicialForm() {
  return {
    tipoCadencia: 'INTERVALO',
    intervaloMinutos: '120',
    horariosFixos: '08:00,14:00',
    periodo: 'SEMANAL',
    periodoHorario: '08:00',
    janelaInicio: '',
    janelaFim: '',
    validoAteData: '',
    validoAteHora: '',
    apenasDiasUteis: false,
    considerarFeriados: false,
    prioridade: '0',
    motivo: '',
  };
}

function agendamentoApiParaForm(ag) {
  const { data, hora } = apiDateTimeParaBr(ag?.validoAte);
  const tipo = String(ag?.tipoCadencia ?? 'INTERVALO');
  return {
    tipoCadencia:
      tipo === 'HORARIOS_FIXOS' || tipo === 'PERIODICO' ? tipo : 'INTERVALO',
    intervaloMinutos: ag?.intervaloMinutos != null ? String(ag.intervaloMinutos) : '',
    horariosFixos: ag?.horariosFixos ?? '',
    periodo: ag?.periodo ?? 'SEMANAL',
    periodoHorario: apiTimeParaBr(ag?.periodoHorario) || '08:00',
    janelaInicio: apiTimeParaBr(ag?.janelaInicio),
    janelaFim: apiTimeParaBr(ag?.janelaFim),
    validoAteData: data,
    validoAteHora: hora,
    apenasDiasUteis: Boolean(ag?.apenasDiasUteis),
    considerarFeriados: Boolean(ag?.considerarFeriados),
    prioridade: String(ag?.prioridade ?? 0),
    motivo: ag?.motivo ?? '',
  };
}

/**
 * Modal reutilizável de cadência (editar na 2.3a; criar na 2.3b).
 * @param {{
 *   open: boolean,
 *   modo?: 'editar'|'criar',
 *   agendamentoId?: number|null,
 *   processoId?: number|null,
 *   numeroCnj?: string,
 *   clienteNome?: string,
 *   onClose?: () => void,
 *   onSaved?: () => void,
 * }} props
 */
export function ModalAgendamentoCadencia({
  open,
  modo = 'editar',
  agendamentoId,
  processoId,
  numeroCnj,
  clienteNome,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(estadoInicialForm);
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useCloseOnEscape(open, onClose, { enabled: !salvando });

  const isCriar = modo === 'criar' || !agendamentoId;

  useEffect(() => {
    if (!open || !isCriar) return;
    setForm(estadoInicialForm());
    setErro('');
    setCarregando(false);
  }, [open, isCriar]);

  useEffect(() => {
    if (!open || isCriar) return;
    const agId = Number(agendamentoId);
    const procId = Number(processoId);
    if (!Number.isFinite(agId) || agId < 1 || !Number.isFinite(procId) || procId < 1) return;

    let cancelled = false;
    setErro('');
    setCarregando(true);
    void listarAgendamentosProcesso(procId)
      .then((rows) => {
        if (cancelled) return;
        const ag = (Array.isArray(rows) ? rows : []).find((x) => Number(x?.id) === agId);
        if (!ag) {
          setErro('Agendamento não encontrado para este processo.');
          setForm(estadoInicialForm());
          return;
        }
        setForm(agendamentoApiParaForm(ag));
      })
      .catch((e) => {
        if (!cancelled) setErro(e?.message || 'Falha ao carregar agendamento.');
      })
      .finally(() => {
        if (!cancelled) setCarregando(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, isCriar, agendamentoId, processoId]);

  useEffect(() => {
    if (!open) {
      setForm(estadoInicialForm());
      setErro('');
      setCarregando(false);
      setSalvando(false);
    }
  }, [open]);

  if (!open) return null;

  const titulo = isCriar ? 'Nova consulta periódica' : 'Editar cadência';
  const inputsDesabilitados = carregando || salvando;

  async function salvar() {
    if (inputsDesabilitados) return;
    const errCad = validarCadenciaCliente(form);
    if (errCad) {
      setErro(errCad);
      return;
    }
    const dataVal = String(form.validoAteData ?? '').trim();
    if (dataVal && !normalizarDataBr(dataVal)) {
      setErro('Data «válido até» inválida (use dd/mm/aaaa).');
      return;
    }
    const procId = Number(processoId);
    if (!Number.isFinite(procId) || procId < 1) {
      setErro('Processo sem id na API — salve o cadastro antes de agendar consultas.');
      return;
    }

    setErro('');
    setSalvando(true);
    try {
      const body = montarBodyAgendamentoRequest({
        ...form,
        janelaInicio: normalizarHora(form.janelaInicio) || form.janelaInicio,
        janelaFim: normalizarHora(form.janelaFim) || form.janelaFim,
        validoAteHora: normalizarHora(form.validoAteHora) || form.validoAteHora,
        periodoHorario: normalizarHora(form.periodoHorario) || form.periodoHorario,
      });
      if (isCriar) {
        await criarAgendamento(procId, body);
      } else {
        const agId = Number(agendamentoId);
        if (!Number.isFinite(agId) || agId < 1) {
          setErro('Agendamento inválido.');
          return;
        }
        await atualizarAgendamento(agId, body);
      }
      onSaved?.();
      onClose?.();
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar cadência.');
    } finally {
      setSalvando(false);
    }
  }

  const tipo = form.tipoCadencia;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/45 p-2 sm:p-3"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-agendamento-cadencia-titulo"
    >
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white dark:bg-[#141c2c] shadow-2xl">
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-indigo-200/40 bg-gradient-to-r from-indigo-600 to-slate-800 px-3 py-2 text-white">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/10 hover:bg-white/20 md:hidden disabled:opacity-50"
            aria-label="Voltar"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0 flex-1">
            <h2 id="modal-agendamento-cadencia-titulo" className="flex items-center gap-1.5 text-sm font-semibold sm:text-base">
              <CalendarClock className="h-4 w-4 shrink-0" aria-hidden />
              <span className="truncate">{titulo}</span>
            </h2>
            <p className="truncate text-[11px] text-indigo-100/95">
              {numeroCnj ? <span className="font-mono">{numeroCnj}</span> : null}
              {clienteNome ? ` · ${clienteNome}` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-white/15 disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3 sm:px-4 space-y-3">
          {carregando ? (
            <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              Carregando cadência…
            </p>
          ) : null}

          <fieldset disabled={inputsDesabilitados} className={`${CARD} border-0 p-0 space-y-3`}>
            <div className={CARD}>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Tipo de cadência</p>
              <div className="mt-2 flex flex-wrap gap-4" role="radiogroup" aria-label="Tipo de cadência">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="tipoCadencia"
                    checked={tipo === 'INTERVALO'}
                    onChange={() => setForm((f) => ({ ...f, tipoCadencia: 'INTERVALO' }))}
                  />
                  Intervalo (minutos)
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="tipoCadencia"
                    checked={tipo === 'HORARIOS_FIXOS'}
                    onChange={() => setForm((f) => ({ ...f, tipoCadencia: 'HORARIOS_FIXOS' }))}
                  />
                  Horários fixos
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="tipoCadencia"
                    checked={tipo === 'PERIODICO'}
                    onChange={() => setForm((f) => ({ ...f, tipoCadencia: 'PERIODICO' }))}
                  />
                  Periódico
                </label>
              </div>
              {tipo === 'INTERVALO' ? (
                <label className="block mt-3">
                  <span className={LABEL}>Intervalo (minutos)</span>
                  <input
                    type="number"
                    min={1}
                    className={`${INPUT} mt-1`}
                    value={form.intervaloMinutos}
                    onChange={(e) => setForm((f) => ({ ...f, intervaloMinutos: e.target.value }))}
                  />
                </label>
              ) : null}
              {tipo === 'HORARIOS_FIXOS' ? (
                <label className="block mt-3">
                  <span className={LABEL}>Horários (CSV HH:mm)</span>
                  <input
                    type="text"
                    className={`${INPUT} mt-1 font-mono text-xs`}
                    placeholder="08:00,14:30,18:00"
                    value={form.horariosFixos}
                    onChange={(e) => setForm((f) => ({ ...f, horariosFixos: e.target.value }))}
                  />
                </label>
              ) : null}
              {tipo === 'PERIODICO' ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label>
                    <span className={LABEL}>Período</span>
                    <select
                      className={`${INPUT} mt-1`}
                      value={form.periodo}
                      onChange={(e) => setForm((f) => ({ ...f, periodo: e.target.value }))}
                    >
                      {PERIODOS_CADENCIA.map((p) => (
                        <option key={p.valor} value={p.valor}>
                          {p.rotulo}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span className={LABEL}>Horário (hh:mm)</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      className={`${INPUT} mt-1 font-mono`}
                      placeholder="08:00"
                      value={form.periodoHorario}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, periodoHorario: formatarHoraInput(e.target.value) }))
                      }
                      onBlur={() =>
                        setForm((f) => ({
                          ...f,
                          periodoHorario: normalizarHora(f.periodoHorario) || f.periodoHorario,
                        }))
                      }
                    />
                  </label>
                </div>
              ) : null}
            </div>

            <div className={`${CARD} grid grid-cols-1 sm:grid-cols-2 gap-3`}>
              <label>
                <span className={LABEL}>Janela início (hh:mm)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className={`${INPUT} mt-1 font-mono`}
                  placeholder="08:00"
                  value={form.janelaInicio}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, janelaInicio: formatarHoraInput(e.target.value) }))
                  }
                  onBlur={() =>
                    setForm((f) => ({
                      ...f,
                      janelaInicio: normalizarHora(f.janelaInicio) || f.janelaInicio,
                    }))
                  }
                />
              </label>
              <label>
                <span className={LABEL}>Janela fim (hh:mm)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className={`${INPUT} mt-1 font-mono`}
                  placeholder="18:00"
                  value={form.janelaFim}
                  onChange={(e) => setForm((f) => ({ ...f, janelaFim: formatarHoraInput(e.target.value) }))}
                  onBlur={() =>
                    setForm((f) => ({
                      ...f,
                      janelaFim: normalizarHora(f.janelaFim) || f.janelaFim,
                    }))
                  }
                />
              </label>
              <label>
                <span className={LABEL}>Válido até — data (dd/mm/aaaa)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className={`${INPUT} mt-1 font-mono`}
                  placeholder="31/12/2026"
                  value={form.validoAteData}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, validoAteData: formatarDataInput(e.target.value) }))
                  }
                  onBlur={() =>
                    setForm((f) => ({
                      ...f,
                      validoAteData: normalizarDataBr(f.validoAteData) || f.validoAteData,
                    }))
                  }
                />
              </label>
              <label>
                <span className={LABEL}>Válido até — hora (hh:mm)</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className={`${INPUT} mt-1 font-mono`}
                  placeholder="23:59"
                  value={form.validoAteHora}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, validoAteHora: formatarHoraInput(e.target.value) }))
                  }
                  onBlur={() =>
                    setForm((f) => ({
                      ...f,
                      validoAteHora: normalizarHora(f.validoAteHora) || f.validoAteHora,
                    }))
                  }
                />
              </label>
            </div>

            <div className={CARD}>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.apenasDiasUteis}
                  onChange={(e) => setForm((f) => ({ ...f, apenasDiasUteis: e.target.checked }))}
                  className="mt-0.5"
                />
                <span>Apenas dias úteis</span>
              </label>
              <label className="flex items-start gap-2 text-sm mt-2">
                <input
                  type="checkbox"
                  checked={form.considerarFeriados}
                  onChange={(e) => setForm((f) => ({ ...f, considerarFeriados: e.target.checked }))}
                  className="mt-0.5"
                />
                <span>
                  Considerar feriados
                  <span className="block text-[11px] text-slate-500 dark:text-slate-400">
                    Aplicado na Fase 3 (agendamento automático).
                  </span>
                </span>
              </label>
            </div>

            <div className={`${CARD} grid grid-cols-1 sm:grid-cols-2 gap-3`}>
              <label>
                <span className={LABEL}>Prioridade</span>
                <input
                  type="number"
                  className={`${INPUT} mt-1`}
                  value={form.prioridade}
                  onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))}
                />
              </label>
              <label className="sm:col-span-2">
                <span className={LABEL}>Motivo / observação</span>
                <input
                  type="text"
                  className={`${INPUT} mt-1`}
                  value={form.motivo}
                  onChange={(e) => setForm((f) => ({ ...f, motivo: e.target.value }))}
                />
              </label>
            </div>
          </fieldset>

          {erro ? (
            <p className="text-sm text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-950/30 px-3 py-2">
              {erro}
            </p>
          ) : null}
        </div>

        <div className="shrink-0 flex flex-wrap justify-end gap-2 border-t border-slate-200 dark:border-white/10 px-3 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={salvando}
            className="px-4 py-2 rounded-lg border border-slate-300 dark:border-white/15 text-sm disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void salvar()}
            disabled={inputsDesabilitados || carregando}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : null}
            Salvar
          </button>
        </div>
      </div>
    </div>
  );
}

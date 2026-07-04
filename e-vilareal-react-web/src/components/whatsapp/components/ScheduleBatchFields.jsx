import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { processosBtnSecondary, processosInputClass } from '../../processos/ProcessosAdminLayout.jsx';
import { previewWhatsAppScheduleRecurrence } from '../../../repositories/whatsappRepository.js';
import { datetimeLocalToIso, isFutureDatetimeLocal } from '../../../utils/whatsappFormat.js';
import {
  BATCH_MODE_AVULSAS,
  BATCH_MODE_INTERVALO_DIA,
  BATCH_MODE_MENSAL,
  BATCH_MODE_SEMANAL,
  buildRecorrenciaPayload,
  DIAS_SEMANA_OPCOES,
  INTERVALO_MINUTOS_OPCOES,
  MAX_OCORRENCIAS_LOTE,
  MENSAL_MODO_INTERVALO,
  MENSAL_MODO_QUANTIDADE,
} from '../../../utils/whatsappScheduleRecurrence.js';

export {
  BATCH_MODE_AVULSAS,
  BATCH_MODE_MENSAL,
  BATCH_MODE_SEMANAL,
  BATCH_MODE_INTERVALO_DIA,
} from '../../../utils/whatsappScheduleRecurrence.js';

/** @deprecated use BATCH_MODE_MENSAL */
export const BATCH_MODE_RECORRENCIA = BATCH_MODE_MENSAL;

const MODOS = [
  { id: BATCH_MODE_MENSAL, label: 'Mensal' },
  { id: BATCH_MODE_SEMANAL, label: 'Semanal' },
  { id: BATCH_MODE_INTERVALO_DIA, label: 'Várias vezes no dia' },
  { id: BATCH_MODE_AVULSAS, label: 'Datas avulsas' },
];

function hojeIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function mesAtualIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function ScheduleBatchFields({ batchMode, onBatchModeChange, onStateChange }) {
  const [avulsas, setAvulsas] = useState(['']);
  const [diaDoMes, setDiaDoMes] = useState('18');
  const [horaLocal, setHoraLocal] = useState('08:00');
  const [mensalModo, setMensalModo] = useState(MENSAL_MODO_QUANTIDADE);
  const [mesInicio, setMesInicio] = useState(mesAtualIso());
  const [mesFim, setMesFim] = useState('');
  const [quantidadeMeses, setQuantidadeMeses] = useState('6');
  const [diasSemana, setDiasSemana] = useState(['SEGUNDA']);
  const [dataInicio, setDataInicio] = useState(hojeIsoDate());
  const [quantidadeSemanas, setQuantidadeSemanas] = useState('4');
  const [dataIntervalo, setDataIntervalo] = useState(hojeIsoDate());
  const [horaInicio, setHoraInicio] = useState('08:00');
  const [horaFim, setHoraFim] = useState('18:00');
  const [intervaloMinutos, setIntervaloMinutos] = useState('5');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  const state = {
    batchMode,
    avulsas,
    diaDoMes,
    horaLocal,
    mensalModo,
    mesInicio,
    mesFim,
    quantidadeMeses,
    diasSemana,
    dataInicio,
    quantidadeSemanas,
    data: dataIntervalo,
    horaInicio,
    horaFim,
    intervaloMinutos,
    preview,
  };

  useEffect(() => {
    onStateChange?.(state);
  }, [
    batchMode,
    avulsas,
    diaDoMes,
    horaLocal,
    mensalModo,
    mesInicio,
    mesFim,
    quantidadeMeses,
    diasSemana,
    dataInicio,
    quantidadeSemanas,
    dataIntervalo,
    horaInicio,
    horaFim,
    intervaloMinutos,
    preview,
    onStateChange,
  ]);

  useEffect(() => {
    if (batchMode === BATCH_MODE_AVULSAS) {
      setPreview(null);
      setPreviewError('');
      return undefined;
    }

    const payload = buildRecorrenciaPayload(batchMode, state);
    if (!payload) {
      setPreview(null);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPreviewLoading(true);
      setPreviewError('');
      void previewWhatsAppScheduleRecurrence(payload, controller.signal)
        .then((res) => setPreview(res))
        .catch((err) => {
          if (controller.signal.aborted) return;
          setPreview(null);
          setPreviewError(err?.message || 'Não foi possível calcular as datas.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setPreviewLoading(false);
        });
    }, 350);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [
    batchMode,
    diaDoMes,
    horaLocal,
    mensalModo,
    mesInicio,
    mesFim,
    quantidadeMeses,
    diasSemana,
    dataInicio,
    quantidadeSemanas,
    dataIntervalo,
    horaInicio,
    horaFim,
    intervaloMinutos,
  ]);

  const toggleDiaSemana = (valor) => {
    setDiasSemana((prev) => {
      const set = new Set(prev);
      if (set.has(valor)) set.delete(valor);
      else set.add(valor);
      const next = [...set];
      return next.length ? next : [valor];
    });
  };

  const addAvulsa = () => setAvulsas((prev) => [...prev, '']);
  const removeAvulsa = (idx) => setAvulsas((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  const updateAvulsa = (idx, value) =>
    setAvulsas((prev) => prev.map((v, i) => (i === idx ? value : v)));

  const previewAlerta =
    preview?.total > 50
      ? `Serão ${preview.total} envios — confira antes de confirmar (limite ${MAX_OCORRENCIAS_LOTE}).`
      : null;

  return (
    <div className="space-y-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
      <div>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
          Como repetir?
        </label>
        <div className="grid grid-cols-2 gap-2">
          {MODOS.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`text-xs py-2 rounded-lg border ${
                batchMode === m.id
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'border-slate-300 dark:border-slate-600'
              }`}
              onClick={() => onBatchModeChange(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {batchMode === BATCH_MODE_MENSAL ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Dia do mês
              </label>
              <input
                type="number"
                min={1}
                max={31}
                className={processosInputClass}
                value={diaDoMes}
                onChange={(e) => setDiaDoMes(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Hora</label>
              <input
                type="time"
                className={processosInputClass}
                value={horaLocal}
                onChange={(e) => setHoraLocal(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Mês inicial</label>
              <input
                type="month"
                className={processosInputClass}
                value={mesInicio}
                onChange={(e) => setMesInicio(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Repetir por</label>
              <select
                className={processosInputClass}
                value={mensalModo}
                onChange={(e) => setMensalModo(e.target.value)}
              >
                <option value={MENSAL_MODO_QUANTIDADE}>Quantidade de meses</option>
                <option value={MENSAL_MODO_INTERVALO}>Até mês final</option>
              </select>
            </div>
          </div>
          {mensalModo === MENSAL_MODO_QUANTIDADE ? (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Quantidade de meses
              </label>
              <input
                type="number"
                min={1}
                max={120}
                className={processosInputClass}
                value={quantidadeMeses}
                onChange={(e) => setQuantidadeMeses(e.target.value)}
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Mês final</label>
              <input
                type="month"
                className={processosInputClass}
                value={mesFim}
                onChange={(e) => setMesFim(e.target.value)}
              />
            </div>
          )}
          <p className="text-xs text-slate-500">
            Se o dia não existir no mês (ex.: 31 em fevereiro), usa-se o último dia do mês.
          </p>
        </>
      ) : null}

      {batchMode === BATCH_MODE_SEMANAL ? (
        <>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
              Dias da semana
            </label>
            <div className="flex flex-wrap gap-1.5">
              {DIAS_SEMANA_OPCOES.map((d) => (
                <button
                  key={d.valor}
                  type="button"
                  className={`px-2.5 py-1 rounded-md text-xs border ${
                    diasSemana.includes(d.valor)
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'border-slate-300 dark:border-slate-600'
                  }`}
                  onClick={() => toggleDiaSemana(d.valor)}
                >
                  {d.rotulo}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                A partir de
              </label>
              <input
                type="date"
                className={processosInputClass}
                value={dataInicio}
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Hora</label>
              <input
                type="time"
                className={processosInputClass}
                value={horaLocal}
                onChange={(e) => setHoraLocal(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Quantidade de semanas
              </label>
              <input
                type="number"
                min={1}
                max={104}
                className={processosInputClass}
                value={quantidadeSemanas}
                onChange={(e) => setQuantidadeSemanas(e.target.value)}
              />
            </div>
          </div>
        </>
      ) : null}

      {batchMode === BATCH_MODE_INTERVALO_DIA ? (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Data</label>
              <input
                type="date"
                className={processosInputClass}
                value={dataIntervalo}
                onChange={(e) => setDataIntervalo(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">De</label>
              <input
                type="time"
                className={processosInputClass}
                value={horaInicio}
                onChange={(e) => setHoraInicio(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Até</label>
              <input
                type="time"
                className={processosInputClass}
                value={horaFim}
                onChange={(e) => setHoraFim(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Intervalo</label>
              <select
                className={processosInputClass}
                value={intervaloMinutos}
                onChange={(e) => setIntervaloMinutos(e.target.value)}
              >
                {INTERVALO_MINUTOS_OPCOES.map((o) => (
                  <option key={o.valor} value={String(o.valor)}>
                    {o.rotulo}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Repete a mesma mensagem no dia, do horário inicial ao final, no intervalo escolhido.
          </p>
        </>
      ) : null}

      {batchMode === BATCH_MODE_AVULSAS ? (
        <div className="space-y-2">
          <p className="text-xs text-slate-600 dark:text-slate-400">Adicione uma ou mais datas de envio.</p>
          {avulsas.map((value, idx) => (
            <div key={idx} className="flex gap-2 items-center">
              <input
                type="datetime-local"
                className={`${processosInputClass} flex-1`}
                value={value}
                onChange={(e) => updateAvulsa(idx, e.target.value)}
              />
              <button
                type="button"
                className="p-2 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-500 hover:text-red-600 disabled:opacity-40"
                disabled={avulsas.length <= 1}
                onClick={() => removeAvulsa(idx)}
                aria-label="Remover data"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button type="button" className={processosBtnSecondary} onClick={addAvulsa}>
            <Plus className="w-4 h-4" />
            Adicionar data
          </button>
        </div>
      ) : null}

      {batchMode !== BATCH_MODE_AVULSAS ? (
        <>
          {previewLoading ? (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Calculando datas…
            </p>
          ) : null}
          {previewError ? <p className="text-xs text-red-600">{previewError}</p> : null}
          {previewAlerta ? <p className="text-xs text-amber-700 dark:text-amber-400">{previewAlerta}</p> : null}
          {preview?.labels?.length ? (
            <div className="text-xs text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-900/80 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <p className="font-medium mb-1">
                Serão criados {preview.total} agendamento{preview.total !== 1 ? 's' : ''}:
              </p>
              <p className="line-clamp-4">{preview.labels.join(', ')}</p>
              {preview.total > 8 ? (
                <p className="text-slate-500 mt-1">… e mais {preview.total - 8} data(s)</p>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

export function buildScheduleBatchPayload(baseBody, state) {
  if (!state) {
    return { error: 'Configure as datas do lote.' };
  }

  if (state.batchMode === BATCH_MODE_AVULSAS) {
    const scheduledAtList = [];
    for (const local of state.avulsas || []) {
      if (!String(local).trim()) continue;
      if (!isFutureDatetimeLocal(local)) {
        return { error: 'Todas as datas avulsas devem ser no futuro.' };
      }
      const iso = datetimeLocalToIso(local);
      if (!iso) return { error: 'Data/hora avulsa inválida.' };
      scheduledAtList.push(iso);
    }
    if (scheduledAtList.length === 0) {
      return { error: 'Informe pelo menos uma data avulsa.' };
    }
    return { body: { ...baseBody, scheduledAtList } };
  }

  const recorrencia = buildRecorrenciaPayload(state.batchMode, state);
  if (!recorrencia) {
    return { error: 'Preencha todos os campos da recorrência.' };
  }
  if (!state.preview?.total) {
    return { error: 'Aguarde o preview das datas ou corrija os parâmetros.' };
  }
  return { body: { ...baseBody, recorrencia } };
}

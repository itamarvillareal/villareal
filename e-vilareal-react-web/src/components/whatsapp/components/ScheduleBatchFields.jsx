import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { processosBtnSecondary, processosInputClass } from '../../processos/ProcessosAdminLayout.jsx';
import { previewWhatsAppScheduleRecurrence } from '../../../repositories/whatsappRepository.js';
import { datetimeLocalToIso, isFutureDatetimeLocal } from '../../../utils/whatsappFormat.js';

export const BATCH_MODE_AVULSAS = 'avulsas';
export const BATCH_MODE_RECORRENCIA = 'recorrencia';

export function ScheduleBatchFields({ batchMode, onBatchModeChange, onStateChange }) {
  const [avulsas, setAvulsas] = useState(['']);
  const [diaDoMes, setDiaDoMes] = useState('18');
  const [horaLocal, setHoraLocal] = useState('08:00');
  const [mesInicio, setMesInicio] = useState('');
  const [mesFim, setMesFim] = useState('');
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState('');

  useEffect(() => {
    onStateChange?.({
      batchMode,
      avulsas,
      diaDoMes,
      horaLocal,
      mesInicio,
      mesFim,
      preview,
    });
  }, [batchMode, avulsas, diaDoMes, horaLocal, mesInicio, mesFim, preview, onStateChange]);

  useEffect(() => {
    if (batchMode !== BATCH_MODE_RECORRENCIA) {
      setPreview(null);
      return undefined;
    }
    if (!mesInicio || !mesFim || !diaDoMes || !horaLocal) {
      setPreview(null);
      return undefined;
    }

    const [hh, mm] = horaLocal.split(':').map((v) => Number(v));
    const dia = Number(diaDoMes);
    if (!Number.isFinite(dia) || dia < 1 || dia > 31 || !Number.isFinite(hh) || !Number.isFinite(mm)) {
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPreviewLoading(true);
      setPreviewError('');
      void previewWhatsAppScheduleRecurrence(
        { diaDoMes: dia, hora: hh, minuto: mm, mesInicio, mesFim },
        controller.signal,
      )
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
  }, [batchMode, diaDoMes, horaLocal, mesInicio, mesFim]);

  const addAvulsa = () => setAvulsas((prev) => [...prev, '']);
  const removeAvulsa = (idx) => setAvulsas((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  const updateAvulsa = (idx, value) =>
    setAvulsas((prev) => prev.map((v, i) => (i === idx ? value : v)));

  return (
    <div className="space-y-4 rounded-xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
      <div className="flex gap-2">
        <button
          type="button"
          className={`flex-1 text-xs py-2 rounded-lg border ${
            batchMode === BATCH_MODE_RECORRENCIA
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'border-slate-300 dark:border-slate-600'
          }`}
          onClick={() => onBatchModeChange(BATCH_MODE_RECORRENCIA)}
        >
          Recorrência mensal
        </button>
        <button
          type="button"
          className={`flex-1 text-xs py-2 rounded-lg border ${
            batchMode === BATCH_MODE_AVULSAS
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'border-slate-300 dark:border-slate-600'
          }`}
          onClick={() => onBatchModeChange(BATCH_MODE_AVULSAS)}
        >
          Datas avulsas
        </button>
      </div>

      {batchMode === BATCH_MODE_RECORRENCIA ? (
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
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Mês final</label>
              <input
                type="month"
                className={processosInputClass}
                value={mesFim}
                onChange={(e) => setMesFim(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-slate-500">
            Se o dia não existir no mês (ex.: 31 em fevereiro), usa-se o último dia do mês.
          </p>
          {previewLoading ? (
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" /> Calculando datas…
            </p>
          ) : null}
          {previewError ? <p className="text-xs text-red-600">{previewError}</p> : null}
          {preview?.labels?.length ? (
            <div className="text-xs text-slate-700 dark:text-slate-300 bg-white/80 dark:bg-slate-900/80 rounded-lg p-3 border border-slate-200 dark:border-slate-700">
              <p className="font-medium mb-1">
                Serão criados {preview.total} agendamento{preview.total !== 1 ? 's' : ''}:
              </p>
              <p>{preview.labels.join(', ')}</p>
            </div>
          ) : null}
        </>
      ) : (
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
      )}
    </div>
  );
}

export function buildScheduleBatchPayload(baseBody, state) {
  if (!state) {
    return { error: 'Configure as datas do lote.' };
  }
  if (state.batchMode === BATCH_MODE_RECORRENCIA) {
    const [hh, mm] = String(state.horaLocal || '').split(':').map((v) => Number(v));
    const dia = Number(state.diaDoMes);
    if (!state.mesInicio || !state.mesFim || !Number.isFinite(dia) || !Number.isFinite(hh) || !Number.isFinite(mm)) {
      return { error: 'Preencha dia, hora e intervalo de meses da recorrência.' };
    }
    if (!state.preview?.total) {
      return { error: 'Aguarde o preview das datas ou corrija o intervalo.' };
    }
    return {
      body: {
        ...baseBody,
        recorrenciaMensal: {
          diaDoMes: dia,
          hora: hh,
          minuto: mm,
          mesInicio: state.mesInicio,
          mesFim: state.mesFim,
        },
      },
    };
  }

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

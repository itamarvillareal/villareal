import { useState } from 'react';
import {
  Bell,
  Bot,
  ChevronDown,
  ChevronUp,
  FileText,
  MessageCircle,
  Phone,
  User,
  UserPlus,
  Banknote,
} from 'lucide-react';
import {
  formatPhoneDisplay,
  formatTimeBR,
  formatDateTimeBR,
} from '../../../utils/whatsappFormat.js';
import {
  resumirTexto,
  templateIconName,
  templateLabel,
} from '../../../utils/whatsappScheduleUtils.js';
import { buildScheduledMessagePreview } from '../../../utils/whatsappTemplateUtils.js';

const ICON_MAP = {
  Bell,
  FileText,
  UserPlus,
  MessageCircle,
  Banknote,
};

function TemplateIcon({ templateName, className }) {
  const name = templateIconName(templateName);
  const Cmp = ICON_MAP[name] || MessageCircle;
  return <Cmp className={className} aria-hidden />;
}

function statusConfig(status) {
  const s = String(status ?? '').toUpperCase();
  switch (s) {
    case 'SENT':
      return {
        border: 'border-l-emerald-500',
        badge: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200',
        label: 'Enviado',
      };
    case 'FAILED':
      return {
        border: 'border-l-red-500',
        badge: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200',
        label: 'Falhou',
      };
    case 'CANCELLED':
      return {
        border: 'border-l-slate-400',
        badge: 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400',
        label: 'Cancelado',
      };
    default:
      return {
        border: 'border-l-amber-500',
        badge: 'bg-amber-100 text-amber-900 dark:bg-amber-950/40 dark:text-amber-100',
        label: 'Aguardando envio',
      };
  }
}

function extrairNomeCliente(item) {
  const params = item.templateParams;
  if (Array.isArray(params) && params[0]) return params[0];
  return null;
}

function extrairNumeroProcesso(item) {
  const params = item.templateParams;
  if (Array.isArray(params) && params[1]) return params[1];
  if (item.processoId) return `Processo #${item.processoId}`;
  return null;
}

export function ScheduleCard({ item, compact = false, onCancel, cancelling = false, templates = [] }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = statusConfig(item.status);
  const isPending = String(item.status).toUpperCase() === 'PENDING';
  const mensagemCompleta = buildScheduledMessagePreview(item.templateName, item.templateParams, templates);
  const mensagemResumida = resumirTexto(mensagemCompleta, compact ? 40 : 160);
  const showExpand = !compact && mensagemCompleta.length > 160;

  const titulo = item.descricao || templateLabel(item.templateName);
  const nomeCliente = extrairNomeCliente(item);
  const numeroProcesso = extrairNumeroProcesso(item);
  const automatico = String(item.createdBy ?? '').toLowerCase() === 'sistema';
  const telefoneDestino = formatPhoneDisplay(item.phoneNumber) || '—';
  const isSent = String(item.status).toUpperCase() === 'SENT';
  const rotuloTelefone = isSent ? 'Enviado para' : 'Para';

  if (compact) {
    return (
      <div
        className={`rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 border-l-4 ${cfg.border}`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{titulo}</p>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              <span className="font-medium">{rotuloTelefone}:</span> {telefoneDestino}
            </p>
          </div>
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 tabular-nums shrink-0">
            {formatTimeBR(item.scheduledAt)}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium ${cfg.badge}`}>
            {cfg.label}
          </span>
          {isPending && onCancel ? (
            <button
              type="button"
              className="text-xs text-red-600 hover:underline disabled:opacity-50"
              disabled={cancelling}
              onClick={() => onCancel(item)}
            >
              Cancelar
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <article
      className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm border-l-4 ${cfg.border} overflow-hidden transition-opacity`}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2 shrink-0">
              <TemplateIcon templateName={item.templateName} className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 leading-snug">{titulo}</h3>
              <p className="text-xs text-slate-500 mt-0.5">{templateLabel(item.templateName)}</p>
            </div>
          </div>
          <span className="text-lg font-bold text-slate-800 dark:text-slate-200 tabular-nums shrink-0">
            {formatTimeBR(item.scheduledAt)}
          </span>
        </div>

        <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
          {nomeCliente ? (
            <li className="flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 shrink-0 opacity-60" aria-hidden />
              {nomeCliente}
            </li>
          ) : null}
          <li className="flex items-center gap-1.5 tabular-nums">
            <Phone className="w-3.5 h-3.5 shrink-0 opacity-60" aria-hidden />
            <span className="font-medium text-slate-700 dark:text-slate-300">{rotuloTelefone}:</span>
            <span>{telefoneDestino}</span>
          </li>
          {numeroProcesso ? (
            <li className="flex items-center gap-1.5">
              <span className="opacity-60" aria-hidden>
                📋
              </span>
              {numeroProcesso}
            </li>
          ) : null}
        </ul>

        <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2 text-xs text-slate-700 dark:text-slate-300">
          <p className="whitespace-pre-wrap break-words leading-relaxed">
            {expanded ? mensagemCompleta : mensagemResumida}
          </p>
          {showExpand ? (
            <button
              type="button"
              className="mt-1.5 text-emerald-600 hover:underline inline-flex items-center gap-0.5"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? (
                <>
                  <ChevronUp className="w-3 h-3" /> Recolher
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" /> Ver mensagem completa
                </>
              )}
            </button>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex flex-wrap items-center gap-x-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.badge}`}>
              {cfg.label}
              {isSent && item.sentAt ? (
                <span className="opacity-80">✓ {formatTimeBR(item.sentAt)}</span>
              ) : null}
              {isSent && telefoneDestino !== '—' ? (
                <span className="opacity-90 font-normal tabular-nums">· {telefoneDestino}</span>
              ) : null}
            </span>
            {String(item.status).toUpperCase() === 'FAILED' && item.errorMessage ? (
              <span className="text-[11px] text-red-600 dark:text-red-400" title={item.errorMessage}>
                {item.retryCount > 0 ? `${item.retryCount} tent.` : ''}{' '}
                {item.errorMessage.length > 40 ? `${item.errorMessage.slice(0, 40)}…` : item.errorMessage}
              </span>
            ) : null}
          </div>
          {isPending && onCancel ? (
            <button
              type="button"
              className="text-xs font-medium text-red-600 hover:text-red-700 hover:underline disabled:opacity-50"
              disabled={cancelling}
              onClick={() => onCancel(item)}
            >
              Cancelar
            </button>
          ) : null}
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="inline-flex items-center gap-1">
            {automatico ? (
              <>
                <Bot className="w-3 h-3" aria-hidden />
                Automático
              </>
            ) : (
              <>Manual{item.createdBy ? ` — ${item.createdBy}` : ''}</>
            )}
          </span>
          <span className="tabular-nums">{formatDateTimeBR(item.scheduledAt)}</span>
        </div>
      </div>
    </article>
  );
}

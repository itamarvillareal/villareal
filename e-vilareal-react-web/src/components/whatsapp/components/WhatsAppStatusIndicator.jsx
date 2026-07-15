import { formatDateTimeBR } from '../../../utils/whatsappFormat.js';

/**
 * Indicador compacto de status da integração WhatsApp (cabeçalho global).
 *
 * @param {{
 *   configured?: boolean,
 *   loadOk?: boolean,
 *   fetchedAt?: string | null,
 *   loading?: boolean,
 * }} props
 */
export function WhatsAppStatusIndicator({ configured, loadOk, fetchedAt, loading }) {
  if (loading) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
        role="status"
      >
        <span className="h-2 w-2 rounded-full bg-slate-300 animate-pulse" aria-hidden />
        Verificando…
      </span>
    );
  }

  if (!loadOk) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100"
        role="status"
        title="Não foi possível consultar o status da integração"
      >
        <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden />
        Desconectado
      </span>
    );
  }

  if (!configured) {
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100"
        role="status"
        title="Configure as variáveis WHATSAPP_* no servidor"
      >
        <span className="h-2 w-2 rounded-full bg-amber-500" aria-hidden />
        Não configurado
      </span>
    );
  }

  const hora =
    fetchedAt && !Number.isNaN(Date.parse(fetchedAt)) ? formatDateTimeBR(fetchedAt) : null;

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-900 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-100"
      role="status"
      title={hora ? `Última verificação: ${hora}` : 'Integração WhatsApp ativa'}
    >
      <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
      Integração ativa
    </span>
  );
}

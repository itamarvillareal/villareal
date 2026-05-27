import { CheckCircle2, AlertCircle, WifiOff } from 'lucide-react';

/**
 * @param {{
 *   configured?: boolean,
 *   loadOk?: boolean,
 *   fetchedAt?: string | null,
 *   loading?: boolean,
 * }} props
 */
export function WhatsAppStatusBanner({ configured, loadOk, fetchedAt, loading }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
        Verificando integração WhatsApp…
      </div>
    );
  }

  if (!loadOk) {
    return (
      <div
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-100"
        role="status"
      >
        <WifiOff className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="font-medium">Não foi possível verificar o WhatsApp</p>
          <p className="mt-0.5 text-red-800/90 dark:text-red-200/90">
            Verifique sua conexão com o servidor e tente recarregar a página.
          </p>
        </div>
      </div>
    );
  }

  if (!configured) {
    return (
      <div
        className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3 text-sm text-amber-950 dark:border-amber-900/40 dark:bg-amber-950/25 dark:text-amber-100"
        role="status"
      >
        <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" aria-hidden />
        <div>
          <p className="font-medium">Integração não configurada</p>
          <p className="mt-0.5">
            O WhatsApp Business ainda não foi ligado neste ambiente. Os números zerados são normais até o
            administrador concluir a configuração.
          </p>
        </div>
      </div>
    );
  }

  const hora =
    fetchedAt && !Number.isNaN(Date.parse(fetchedAt))
      ? new Date(fetchedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
      : null;

  return (
    <div
      className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-3 text-sm text-emerald-950 dark:border-emerald-900/40 dark:bg-emerald-950/25 dark:text-emerald-100"
      role="status"
    >
      <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" aria-hidden />
      <div>
        <p className="font-medium">Integração ativa</p>
        <p className="mt-0.5">
          O sistema está recebendo e enviando mensagens pelo WhatsApp Business.
          {hora ? ` Última atualização: ${hora}.` : null}
        </p>
      </div>
    </div>
  );
}

import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { INBOX_TIPOS } from '../constants/financeiroConstants.js';
import { pathInboxFinanceiro } from '../financeiroNavLinks.js';
import { InboxPage } from './InboxPage.jsx';

const TIPOS_VALIDOS = new Set(Object.values(INBOX_TIPOS));

/** Normaliza `/financeiro/inbox?tipo=compensar` → `/financeiro/inbox/compensar`. */
export function InboxRoute() {
  const { tipo: tipoParam } = useParams();
  const [searchParams] = useSearchParams();

  if (!tipoParam || !TIPOS_VALIDOS.has(tipoParam)) {
    const tipoQuery = searchParams.get('tipo');
    const dest =
      tipoQuery && TIPOS_VALIDOS.has(tipoQuery) ? tipoQuery : INBOX_TIPOS.classificar;
    return <Navigate to={pathInboxFinanceiro(searchParams.toString(), dest)} replace />;
  }

  return <InboxPage />;
}

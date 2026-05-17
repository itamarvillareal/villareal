import { Navigate } from 'react-router-dom';

/** Container legado — redireciona para o painel. */
export function FinanceiroPage() {
  return <Navigate to="/financeiro" replace />;
}

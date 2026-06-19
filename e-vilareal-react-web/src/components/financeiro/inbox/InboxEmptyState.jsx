import { CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { INBOX_TIPOS } from '../constants/financeiroConstants.js';

const SUBTITULOS = {
  [INBOX_TIPOS.classificar]: 'Nenhuma classificação pendente.',
  [INBOX_TIPOS.compensar]: 'Nenhuma compensação pendente.',
  [INBOX_TIPOS.fatura]: 'Nenhuma sugestão de fatura pendente.',
  [INBOX_TIPOS.semelhantes]: 'Nenhum lançamento pendente com histórico semelhante na Conta Escritório.',
  [INBOX_TIPOS.inconsistentes]: 'Nenhum grupo inconsistente para revisar.',
};

export function InboxEmptyState({ tipo }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <CheckCircle className="w-12 h-12 text-green-500 mb-3" strokeWidth={1.5} aria-hidden />
      <h2 className="text-[18px] font-medium text-slate-800 dark:text-slate-100">Tudo em dia!</h2>
      <p className="mt-1 text-sm text-slate-500 max-w-md">
        {SUBTITULOS[tipo] ?? 'Nenhuma pendência nesta aba.'}
      </p>
      <Link to="/financeiro/extrato" className="mt-4 text-sm text-blue-600 hover:underline dark:text-blue-400">
        ← Ver extrato
      </Link>
    </div>
  );
}

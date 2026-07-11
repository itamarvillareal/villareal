import { Link } from 'react-router-dom';
import { BarChart3, CircleDollarSign, FileCheck, FileSpreadsheet } from 'lucide-react';

const RELATORIOS = [
  {
    to: '/imoveis/relatorios/financeiro',
    icone: CircleDollarSign,
    titulo: 'Financeiro mensal',
    descricao: 'Aluguel × repasse por competência, prazos do cadastro vs. lançamentos reais.',
  },
  {
    to: '/imoveis/relatorios/pagamentos',
    icone: BarChart3,
    titulo: 'Pagamentos',
    descricao: 'Gastos por imóvel, comparativo mensal, lucratividade e pendências (gráficos + CSV).',
  },
  {
    to: '/imoveis/relatorios/cadastro',
    icone: FileSpreadsheet,
    titulo: 'Cadastro / Repasses',
    descricao: 'Tabela completa do cadastro de todos os imóveis, com modo «lista repasses» por dia.',
  },
  {
    to: '/imoveis/relatorios/acerto',
    icone: FileCheck,
    titulo: 'Acerto com Cliente',
    descricao: 'Prestação de contas ao proprietário: pagamentos do período em PDF, por imóvel.',
  },
];

export function ImoveisRelatoriosHubPage() {
  return (
    <div className="p-4 max-w-[1100px] w-full mx-auto space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Relatórios de imóveis</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Todos os relatórios do módulo num só lugar.
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {RELATORIOS.map((r) => (
          <Link
            key={r.to}
            to={r.to}
            className="flex items-start gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 hover:border-teal-300 hover:shadow-sm transition-colors"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300">
              <r.icone className="w-5 h-5" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">{r.titulo}</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 mt-0.5">{r.descricao}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

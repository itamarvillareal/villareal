import { Settings } from 'lucide-react';

/**
 * Tela de configurações do sistema (placeholder — expandir preferências aqui).
 */
export function Configuracoes() {
  return (
    <div className="flex-1 flex flex-col min-h-0 p-4 md:p-6 bg-gray-100">
      <header className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-lg bg-white border border-slate-200 shadow-sm">
          <Settings className="w-7 h-7 text-slate-700" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Configurações</h1>
          <p className="text-sm text-slate-500">Preferências e opções do aplicativo.</p>
        </div>
      </header>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm max-w-2xl">
        <p className="text-sm text-slate-600">
          Nenhuma opção configurável por enquanto. Use esta área para adicionar temas, exportação de dados,
          atalhos, etc.
        </p>
      </section>
    </div>
  );
}

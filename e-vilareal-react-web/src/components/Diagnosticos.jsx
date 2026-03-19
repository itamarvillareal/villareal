import { useState } from 'react';
import { X } from 'lucide-react';

const BOTOES_ESQUERDA = [
  'Consultas Realizadas',
  'Consultas à Realizar',
  'Prazo Fatal',
  'Consultas Atrasadas',
  'Publicações',
  'Busca pessoa',
];

const BOTOES_DIREITA = [
  'Aguardando Documentos',
  'Aguardando Peticionar',
  'Aguardando Verificação',
  'Aguardando Protocolo',
  'Aguardando Providência',
  'Proc. Administrativo',
  'Baixar Protocolos',
];

export function Diagnosticos() {
  const [focado, setFocado] = useState('Consultas Realizadas');

  return (
    <div className="min-h-full bg-slate-200 flex items-center justify-center p-6">
      <div className="bg-white rounded-lg shadow-xl border border-slate-300 w-full max-w-2xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">Informe o relatório que deseja fazer</h2>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="p-2 rounded text-slate-500 hover:bg-slate-100"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div className="flex flex-col gap-2">
            {BOTOES_ESQUERDA.map((label) => (
              <button
                key={label}
                type="button"
                onFocus={() => setFocado(label)}
                className={`px-4 py-2.5 rounded border text-left text-sm font-medium transition-colors ${
                  focado === label
                    ? 'border-slate-400 border-2 bg-slate-50 text-slate-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            {BOTOES_DIREITA.map((label) => (
              <button
                key={label}
                type="button"
                onFocus={() => setFocado(label)}
                className={`px-4 py-2.5 rounded border text-left text-sm font-medium transition-colors ${
                  focado === label
                    ? 'border-slate-400 border-2 bg-slate-50 text-slate-800'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-center">
          <button
            type="button"
            onClick={() => window.history.back()}
            className="px-8 py-2 rounded border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Column } from './Column';
import { columns, getBoardData, tasksByColumn } from '../data/mockData';

const PENDENCIAS_STORAGE_KEY = 'pendencias_por_usuario_v1';

function getPendenciasIniciais() {
  try {
    const raw = window.localStorage.getItem(PENDENCIAS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // segue fallback
  }

  const base = {};
  for (const col of columns) {
    const origem = tasksByColumn[col.id] || [];
    const textos = origem.map((t) => String(t.title || '')).filter((t) => t.trim() !== '');
    base[col.id] = [...textos, '']; // sempre deixa uma caixa em branco ao final
  }
  return base;
}

export function Board() {
  const location = useLocation();
  const [selectedTaskId, setSelectedTaskId] = useState('k1');
  const [pendenciasPorUsuario, setPendenciasPorUsuario] = useState(() => getPendenciasIniciais());
  const boardData = getBoardData();
  const emPendencias = useMemo(
    () => location.pathname === '/pendencias',
    [location.pathname]
  );

  function persistirPendencias(next) {
    try {
      window.localStorage.setItem(PENDENCIAS_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage pode estar indisponível
    }
  }

  function atualizarPendencia(usuarioId, idx, valor) {
    setPendenciasPorUsuario((prev) => {
      const listaAtual = Array.isArray(prev[usuarioId]) ? [...prev[usuarioId]] : [''];
      listaAtual[idx] = valor;

      // Se preencheu a última caixa, cria outra em branco (lista infinita).
      if (idx === listaAtual.length - 1 && String(valor).trim() !== '') {
        listaAtual.push('');
      }

      // Mantém apenas uma caixa vazia no final.
      while (
        listaAtual.length > 1 &&
        String(listaAtual[listaAtual.length - 1]).trim() === '' &&
        String(listaAtual[listaAtual.length - 2]).trim() === ''
      ) {
        listaAtual.pop();
      }

      const next = { ...prev, [usuarioId]: listaAtual };
      persistirPendencias(next);
      return next;
    });
  }

  if (emPendencias) {
    return (
      <div className="flex-1 overflow-auto p-4">
        <div className="flex gap-4 overflow-x-auto pb-2 min-h-0">
          {columns.map((col) => {
            const pendencias = pendenciasPorUsuario[col.id] || [''];
            return (
              <div
                key={col.id}
                className="flex flex-col w-56 shrink-0 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
              >
                <div className="flex items-center justify-between px-3 py-2.5 bg-gray-100 border-b border-gray-200">
                  <span className="font-semibold text-gray-800 text-sm">{col.name}</span>
                  <div className="flex gap-0.5">
                    <button type="button" className="p-1 rounded hover:bg-gray-200 text-gray-600" aria-label="Anterior">
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button type="button" className="p-1 rounded hover:bg-gray-200 text-gray-600" aria-label="Próximo">
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2 p-2 flex-1 min-h-0 overflow-y-auto">
                  {pendencias.map((texto, idx) => (
                    <textarea
                      key={`${col.id}-${idx}`}
                      value={texto}
                      onChange={(e) => atualizarPendencia(col.id, idx, e.target.value)}
                      placeholder="Nova tarefa..."
                      rows={3}
                      className="min-h-[72px] rounded-md border-2 p-3 text-sm bg-white border-gray-200 hover:border-gray-300 text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-400"
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-4">
      <div className="flex gap-4 overflow-x-auto pb-2">
        {boardData.map((column) => (
          <Column
            key={column.id}
            column={column}
            selectedTaskId={selectedTaskId}
            onSelectTask={(task) => setSelectedTaskId(task?.id ?? null)}
          />
        ))}
      </div>
    </div>
  );
}

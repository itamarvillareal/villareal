import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TaskCard } from './TaskCard';

export function Column({ column, selectedTaskId, onSelectTask }) {
  return (
    <div className="flex flex-col w-56 shrink-0 bg-white/90 rounded-xl border border-slate-200/90 shadow-md ring-1 ring-indigo-500/10 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-700 border-b border-white/15 text-white">
        <span className="font-semibold text-sm">{column.name}</span>
        <div className="flex gap-0.5">
          <button
            type="button"
            className="p-1 rounded hover:bg-white/15 text-white/90"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="p-1 rounded hover:bg-white/15 text-white/90"
            aria-label="Próximo"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-2 p-2 flex-1 min-h-0">
        {column.tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={{
              ...task,
              selected: task.id === selectedTaskId,
            }}
            onSelect={onSelectTask}
          />
        ))}
      </div>
    </div>
  );
}

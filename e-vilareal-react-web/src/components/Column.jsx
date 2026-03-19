import { ChevronLeft, ChevronRight } from 'lucide-react';
import { TaskCard } from './TaskCard';

export function Column({ column, selectedTaskId, onSelectTask }) {
  return (
    <div className="flex flex-col w-56 shrink-0 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 bg-gray-100 border-b border-gray-200">
        <span className="font-semibold text-gray-800 text-sm">{column.name}</span>
        <div className="flex gap-0.5">
          <button
            type="button"
            className="p-1 rounded hover:bg-gray-200 text-gray-600"
            aria-label="Anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="p-1 rounded hover:bg-gray-200 text-gray-600"
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

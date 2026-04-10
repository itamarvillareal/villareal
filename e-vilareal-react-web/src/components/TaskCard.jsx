export function TaskCard({ task, onSelect }) {
  const isSelected = task.selected;
  const isEmpty = task.isEmpty;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(task)}
      onKeyDown={(e) => e.key === 'Enter' && onSelect?.(task)}
      className={`
        min-h-[72px] rounded-md border-2 p-3 text-sm transition-all cursor-pointer
        ${isEmpty
          ? 'bg-white border-gray-200 hover:border-gray-300 text-gray-400 dark:border-white/12 dark:hover:border-white/20'
          : 'bg-orange-100 border-orange-200 text-red-900'}
        ${isSelected ? 'ring-2 ring-green-500 ring-offset-1 border-green-400 dark:ring-green-400 dark:border-emerald-500/60' : ''}
      `}
    >
      {isEmpty ? (
        <span className="inline-block text-gray-400">Nova tarefa...</span>
      ) : (
        <span className="font-medium">{task.title}</span>
      )}
    </div>
  );
}

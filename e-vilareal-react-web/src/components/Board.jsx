import { useState } from 'react';
import { Column } from './Column';
import { getBoardData } from '../data/mockData';

export function Board() {
  const [selectedTaskId, setSelectedTaskId] = useState('k1');
  const boardData = getBoardData();

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

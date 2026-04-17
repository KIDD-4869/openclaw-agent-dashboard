import React, { useState } from 'react';
import TaskCard from './TaskCard';

const TaskArchive = React.memo(function TaskArchive({ tasks, agentId, defaultOpen = false, onRefresh }) {
  // 默认展开已完成任务
  const [open, setOpen] = useState(true);

  if (!tasks || tasks.length === 0) return null;

  return (
    <>
      <button className="archive-toggle" onClick={() => setOpen(o => !o)}>
        📜 已完成任务 ({tasks.length}) <span style={{ display: 'inline-block', width: '1em', textAlign: 'center' }}>{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="archive-body">
          {tasks.map(task => (
            <TaskCard key={task.sessionKey} task={task} agentId={agentId} onRefresh={onRefresh} />
          ))}
        </div>
      )}
    </>
  );
});

export default TaskArchive;

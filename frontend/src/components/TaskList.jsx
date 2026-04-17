import React from 'react';
import TaskCard from './TaskCard';
import TaskArchive from './TaskArchive';
import FilterBar from './FilterBar';
import { FILTER_CATEGORIES } from '../constants';

const TaskList = React.memo(function TaskList({ tasks, agentId, currentFilter, onFilter, onRefresh }) {
  if (!tasks || tasks.length === 0) {
    return <div className="empty">暂无任务</div>;
  }

  const filtered = currentFilter
    ? tasks.filter(t => t.category === currentFilter)
    : tasks;

  const activeTasks = filtered.filter(t => t.status !== 'completed' && t.status !== 'failed');
  const completedTasks = filtered.filter(t => t.status === 'completed' || t.status === 'failed');

  return (
    <>
      <FilterBar
        categories={FILTER_CATEGORIES}
        currentFilter={currentFilter}
        onFilter={onFilter}
      />
      {activeTasks.map(task => (
        <TaskCard key={task.sessionKey} task={task} agentId={agentId} onRefresh={onRefresh} />
      ))}
      {activeTasks.length === 0 && completedTasks.length === 0 && (
        <div className="empty">该分类下暂无任务</div>
      )}
      {completedTasks.length > 0 && (
        <TaskArchive tasks={completedTasks} agentId={agentId} defaultOpen={activeTasks.length === 0} onRefresh={onRefresh} />
      )}
    </>
  );
});

export default TaskList;

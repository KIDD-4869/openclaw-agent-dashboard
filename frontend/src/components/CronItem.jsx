import React, { useCallback } from 'react';
import { RUN_STATUS_LABELS } from '../constants';

const CronItem = React.memo(function CronItem({ cron, idx, selected, onSelect }) {
  const lastStatus = cron.lastRunStatus || 'never';
  const statusLabel = RUN_STATUS_LABELS[lastStatus] || lastStatus;

  const handleClick = useCallback(() => {
    onSelect(idx);
  }, [onSelect, idx]);

  return (
    <div
      className={'cron-item' + (selected ? ' selected' : '')}
      onClick={handleClick}
    >
      <div className="info">
        <div className="name">{cron.title}</div>
        <div className="meta">{cron.totalRuns} 次运行 · {statusLabel}</div>
      </div>
    </div>
  );
});

export default CronItem;

import React, { useCallback } from 'react';
import CronItem from './CronItem';
import { RUN_STATUS_LABELS } from '../constants';

const CronList = React.memo(function CronList({ cronData, selection, onSelect }) {
  const handleSelect = useCallback((idx) => {
    onSelect({ type: 'cron', idx });
  }, [onSelect]);

  if (cronData.length === 0) return null;

  return (
    <>
      <div className="sidebar-section" style={{ marginTop: 12 }}>
        ⏰ 定时任务 ({cronData.length})
      </div>
      {cronData.map((cron, idx) => (
        <CronItem
          key={cron.cronKey || idx}
          cron={cron}
          idx={idx}
          selected={selection?.type === 'cron' && selection.idx === idx}
          onSelect={handleSelect}
        />
      ))}
    </>
  );
});

export default CronList;

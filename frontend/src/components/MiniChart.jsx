import React, { useMemo } from 'react';
import { fmtTokens } from '../utils';

const BAR_MAX_HEIGHT = 100;

const MiniChart = React.memo(function MiniChart({ daily }) {
  const recent = useMemo(() => (daily || []).slice(-7), [daily]);
  const max = useMemo(() => {
    let m = 1;
    recent.forEach(d => { if (d.totalTokens > m) m = d.totalTokens; });
    return m;
  }, [recent]);

  if (recent.length === 0) return null;

  return (
    <div className="mini-chart">
      <div className="mini-chart-title">最近 7 天用量趋势</div>
      <div className="mini-chart-body">
        {/* 数值行 */}
        <div className="mini-chart-values">
          {recent.map((d, i) => (
            <div className="mini-chart-val" key={i}>{fmtTokens(d.totalTokens)}</div>
          ))}
        </div>
        {/* 柱状图 */}
        <div className="mini-chart-bars">
          {recent.map((d, i) => {
            const ratio = d.totalTokens / max;
            const barH = Math.max(2, Math.round(ratio * BAR_MAX_HEIGHT));
            return (
              <div className="mini-bar-col" key={i}>
                <div
                  className="mini-bar"
                  style={{
                    height: barH + 'px',
                    backgroundImage: 'linear-gradient(to top, rgba(201,168,76,0.6), rgba(201,168,76,1.0))',
                  }}
                />
              </div>
            );
          })}
        </div>
        {/* 日期行 */}
        <div className="mini-chart-labels">
          {recent.map((d, i) => (
            <div className="mini-bar-label" key={i}>{d.date.substring(5)}</div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default MiniChart;

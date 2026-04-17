import React, { useMemo } from 'react';
import { AGENT_COLORS, NAME_MAP } from '../constants';
import { fmtTokens } from '../utils';
import MiniChart from './MiniChart';

const TokenSummary = React.memo(function TokenSummary({ agents, usageData, totalTokens }) {
  const thirtyDayTotal = usageData?.totals?.totalTokens;

  // 今日用量：从 daily 数组取最后一天，如果是今天则用其 totalTokens，否则 fallback
  const todayTokens = useMemo(() => {
    const daily = usageData?.daily;
    if (!daily || daily.length === 0) return totalTokens;
    const last = daily[daily.length - 1];
    const today = new Date().toISOString().slice(0, 10);
    return last.date === today ? last.totalTokens : totalTokens;
  }, [usageData?.daily, totalTokens]);

  const donutData = useMemo(() => {
    if (totalTokens === 0) return null;
    let cumulative = 0;
    const segments = [];
    agents.forEach(sa => {
      const pct = (sa.totalTokens / totalTokens) * 100;
      if (pct > 0) {
        segments.push({ id: sa.agentId, pct, start: cumulative });
        cumulative += pct;
      }
    });
    if (segments.length === 0) return null;
    const gradientParts = segments.map(seg => {
      const color = AGENT_COLORS[seg.id] || 'var(--gray)';
      return color + ' ' + seg.start.toFixed(2) + '% ' + (seg.start + seg.pct).toFixed(2) + '%';
    });
    return { segments, gradient: 'conic-gradient(' + gradientParts.join(', ') + ')' };
  }, [agents, totalTokens]);

  return (
    <div className="token-summary">
      <div className="token-total-label">📊 Token 用量统计</div>
      {thirtyDayTotal != null && (
        <div className="token-total">
          {fmtTokens(thirtyDayTotal)}{' '}
          <span style={{ fontSize: '.75rem', color: 'var(--text-dim)', fontWeight: 400 }}>（30天累计）</span>
        </div>
      )}
      <div style={{ fontSize: '.85rem', color: 'var(--text-dim)', marginTop: 4 }}>
        今日用量: {fmtTokens(todayTokens)}
      </div>
      {donutData && (
        <div className="token-donut-wrap">
          <div className="token-donut" style={{ background: donutData.gradient }} />
          <div className="token-legend">
            {donutData.segments.map(seg => (
              <div className="token-legend-item" key={seg.id}>
                <span className="token-legend-dot" style={{ background: AGENT_COLORS[seg.id] || 'var(--gray)' }} />
                <span className="token-legend-name">{NAME_MAP[seg.id] || seg.id}</span>
                <span className="token-legend-pct">{seg.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {usageData?.daily && <MiniChart daily={usageData.daily} />}
    </div>
  );
});

export default TokenSummary;

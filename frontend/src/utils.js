export function fmtTokens(n) {
  if (!n && n !== 0) return '--';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

export function fmtTime(ts) {
  if (!ts) return '--';
  return new Date(ts).toLocaleString('zh-CN', { hour12: false });
}

export function fmtUptime(seconds) {
  if (!seconds && seconds !== 0) return '--';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d > 0) return d + 'd ' + h + 'h';
  if (h > 0) return h + 'h ' + m + 'm';
  return m + 'm';
}

export function fmtMemory(bytes) {
  if (!bytes && bytes !== 0) return '--';
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(1) + ' GB';
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(0) + ' MB';
  return (bytes / 1024).toFixed(0) + ' KB';
}

export function getHeartbeatStatus(sa) {
  if ((!sa.lastActive || sa.lastActive === 0) && sa.taskCount === 0)
    return { emoji: '⚪', label: '空闲', color: 'var(--gray)', dotClass: '' };
  const diff = Date.now() - sa.lastActive;
  if (diff <= 120000)
    return { emoji: '🟢', label: '活跃', color: 'var(--green)', dotClass: 'active' };
  return { emoji: '🔵', label: '就绪', color: 'var(--blue)', dotClass: '' };
}

export function sortAgentKeys(list, order) {
  return [...list].sort((a, b) => {
    const ai = order.indexOf(a.agentId);
    const bi = order.indexOf(b.agentId);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
}

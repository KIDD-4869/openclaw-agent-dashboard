import React from 'react';
import { fmtUptime, fmtMemory } from '../utils';

const Header = React.memo(function Header({
  status, lastRefresh, autoRefresh, gatewayStatus, sseConnected,
  onToggleRefresh, onRefresh, onToolbox, onSettings,
}) {
  const gwVer = gatewayStatus?.version || '--';
  const gwUptime = gatewayStatus?.uptime != null ? fmtUptime(gatewayStatus.uptime) : '--';
  const gwMem = gatewayStatus?.memoryMB ? gatewayStatus.memoryMB + ' MB' : (gatewayStatus?.memory ? fmtMemory(gatewayStatus.memory.rss || gatewayStatus.memory) : '--');

  // 连接状态：SSE 正常=绿色(ok)，SSE 断连降级轮询=橙色(loading)，完全断连=红色(error)
  let connStatus = status;
  if (status === 'ok') {
    connStatus = sseConnected ? 'ok' : 'loading'; // loading class = 橙色点
  }

  return (
    <div className="header">
      <h1>
        🐕 Agent Dashboard
        <span>实时监控面板</span>
      </h1>
      <div className="gateway-status">
        <span className="gw-item">⚙️ OpenClaw v{gwVer}</span>
        <span className="gw-item">⏱ {gwUptime}</span>
        <span className="gw-item">💾 {gwMem}</span>
      </div>
      <div className="controls">
        <span
          className={'status-dot ' + connStatus}
          title={
            connStatus === 'ok' ? 'SSE 实时连接'
            : connStatus === 'polling' ? 'SSE 断连，轮询模式'
            : connStatus === 'error' ? '连接失败'
            : '加载中'
          }
        />
        <span className="last-refresh">
          {lastRefresh ? '更新于 ' + lastRefresh.toLocaleTimeString('zh-CN', { hour12: false }) : '--'}
        </span>
        <button
          className={autoRefresh ? 'active' : ''}
          onClick={onToggleRefresh}
        >
          {autoRefresh ? '⏸ 自动刷新' : '▶ 自动刷新'}
        </button>
        <button onClick={onRefresh}>🔄 刷新</button>
        <button onClick={onToolbox}>🧰 百宝箱</button>
        <button onClick={onSettings}>⚙️ 设置</button>
      </div>
    </div>
  );
});

export default Header;

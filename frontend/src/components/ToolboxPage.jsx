import { useState } from 'react';
import DiscussPage from './DiscussPage';
import FilesPage from './FilesPage';
import SBTITest from './SBTITest';

// 百宝箱入口页 — 收纳议政、文件、SBTI 测试三个工具
export default function ToolboxPage({ onBack }) {
  // 当前激活的子工具，null 表示在百宝箱首页
  const [activeTool, setActiveTool] = useState(null);

  // 子工具路由
  if (activeTool === 'discuss') {
    return <DiscussPage onBack={() => setActiveTool(null)} />;
  }
  if (activeTool === 'files') {
    return <FilesPage onBack={() => setActiveTool(null)} />;
  }
  if (activeTool === 'sbti') {
    return <SBTITest onBack={() => setActiveTool(null)} />;
  }

  // 工具卡片列表
  const tools = [
    { id: 'discuss', icon: '💬', name: '议政', desc: 'Agent 多方辩论' },
    { id: 'files', icon: '📄', name: '文件', desc: 'workspace/tmp 文件预览' },
    { id: 'sbti', icon: '🧠', name: 'SBTI 人格测试', desc: '比 MBTI 更真实的灵魂审判' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#0f172a', color: '#e2e8f0', padding: 20 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* 顶部导航 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <button onClick={onBack} style={btnStyle}>← 返回</button>
          <h2 style={{ fontSize: 22, margin: 0 }}>🧰 百宝箱</h2>
        </div>

        {/* 工具卡片列表 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {tools.map(tool => (
            <ToolCard key={tool.id} tool={tool} onClick={() => setActiveTool(tool.id)} />
          ))}
        </div>
      </div>
    </div>
  );
}

// 单个工具卡片，用独立组件方便处理 hover 状态
function ToolCard({ tool, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: hovered ? '#334155' : '#1e293b',
        border: '1px solid #334155',
        borderRadius: 10,
        padding: '18px 20px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        transition: 'background 0.15s',
      }}
    >
      <span style={{ fontSize: 28 }}>{tool.icon}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 600 }}>{tool.name}</div>
        <div style={{ fontSize: 13, color: '#64748b', marginTop: 3 }}>{tool.desc}</div>
      </div>
      <span style={{ fontSize: 13, color: '#64748b' }}>进入 →</span>
    </div>
  );
}

const btnStyle = {
  background: '#334155',
  color: '#e2e8f0',
  border: 'none',
  borderRadius: 6,
  padding: '6px 14px',
  fontSize: 13,
  cursor: 'pointer',
};

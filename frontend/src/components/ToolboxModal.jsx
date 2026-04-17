import { useState, useEffect, useCallback, useRef } from 'react';
import DiscussPage from './DiscussPage';
import FilesPage from './FilesPage';
import SBTITest from './SBTITest';
import MenuPage from './MenuPage';
import StarryBackground from './StarryBackground';

/** 工具列表配置 */
const TOOLS = [
  { id: 'discuss', icon: '💬', name: '议政', desc: 'Agent 多方辩论' },
  { id: 'files', icon: '📂', name: '文件浏览器', desc: '浏览 OpenClaw 完整目录结构' },
  { id: 'sbti', icon: '🧠', name: 'SBTI 人格测试', desc: '比 MBTI 更真实的灵魂审判' },
  { id: 'menu', icon: '🍳', name: '菜谱', desc: '一键生成一周菜单' },
];

/** 注入全局 CSS 关键帧（只注入一次） */
const STYLE_ID = 'toolbox-keyframes';
function injectKeyframes() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes toolbox-bounce-in {
      0%   { opacity: 0; transform: scale(0.3); }
      50%  { opacity: 1; transform: scale(1.02); }
      100% { opacity: 1; transform: scale(1); }
    }
    @keyframes toolbox-mask-in {
      from { opacity: 0; }
      to   { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

/** 工具卡片列表 */
function ToolList({ onSelect, style: extraStyle }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, ...extraStyle }}>
      {TOOLS.map(t => (
        <div
          key={t.id}
          onClick={() => onSelect(t.id)}
          style={{
            background: 'var(--bg-card)',
            borderRadius: 12,
            padding: '20px 18px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            border: '1px solid var(--border)',
            transition: 'border-color 0.15s, transform 0.15s',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(201, 168, 76, 0.5)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.transform = 'none';
          }}
        >
          <span style={{ fontSize: 30, textShadow: '0 0 10px rgba(201,168,76,0.5)' }}>{t.icon}</span>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--gold-light)' }}>{t.name}</div>
            <div style={{ fontSize: 12, color: 'var(--gold-dim)', marginTop: 3 }}>{t.desc}</div>
          </div>
          <span style={{ marginLeft: 'auto', color: 'var(--gold)', fontSize: 16 }}>→</span>
        </div>
      ))}
    </div>
  );
}

/** 百宝箱 Modal 浮层 */
export default function ToolboxModal({ onClose }) {
  // activeTool: 当前渲染的子工具（null = 工具列表）
  const [activeTool, setActiveTool] = useState(null);
  // pendingTool: 等待展开动画完成后要切换到的工具
  const [pendingTool, setPendingTool] = useState(null);
  // expanded: modal 是否处于全屏展开状态
  const [expanded, setExpanded] = useState(false);
  // toolListVisible: 工具列表的 opacity（淡入淡出）
  const [toolListVisible, setToolListVisible] = useState(true);
  // subToolVisible: 子工具内容的 opacity
  const [subToolVisible, setSubToolVisible] = useState(false);

  const modalRef = useRef(null);
  // 用 ref 存储最新 activeTool，避免 handleTransitionEnd 因依赖变化频繁重建
  const activeToolRef = useRef(activeTool);

  // 同步 activeToolRef 到最新 activeTool
  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);

  // 注入关键帧 CSS
  useEffect(() => { injectKeyframes(); }, []);

  // ESC 键关闭（展开状态下先收缩）
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (expanded) handleBack();
        else onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [expanded, onClose]);

  // 点击遮罩关闭（仅未展开时）
  const handleMaskClick = useCallback((e) => {
    if (e.target === e.currentTarget && !expanded) onClose();
  }, [onClose, expanded]);

  // 点击工具卡片：先淡出工具列表，再展开 modal
  const handleSelectTool = useCallback((toolId) => {
    setPendingTool(toolId);
    // 第一步：工具列表淡出（150ms）
    setToolListVisible(false);
    // 150ms 后开始展开 modal
    setTimeout(() => {
      setExpanded(true);
    }, 150);
  }, []);

  // 监听 modal transition 结束，切换到子工具内容
  const handleTransitionEnd = useCallback((e) => {
    // 只响应 modal 容器自身的 width/max-width transition
    if (e.target !== modalRef.current) return;
    if (e.propertyName !== 'width' && e.propertyName !== 'max-width') return;

    if (expanded && pendingTool) {
      // 展开完成 → 渲染子工具，淡入
      setActiveTool(pendingTool);
      setPendingTool(null);
      // 下一帧触发淡入
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setSubToolVisible(true));
      });
    } else if (!expanded && activeToolRef.current === null) {
      // 注意：此处依赖 handleBack 中 200ms 淡出 < 350ms 收缩的时序
      // 若调整动画时长，需同步检查此处逻辑
      // 收缩完成 → 工具列表淡入
      setToolListVisible(true);
    }
  }, [expanded, pendingTool]);

  // 返回：全屏状态下直接关闭整个 modal
  const handleBack = useCallback(() => {
    setSubToolVisible(false);
    setTimeout(() => {
      onClose();
    }, 150);
  }, [onClose]);

  // 渲染子工具内容
  const renderSubTool = () => {
    if (activeTool === 'discuss') return <DiscussPage inModal />;
    if (activeTool === 'files') return <FilesPage inModal />;
    if (activeTool === 'sbti') return <SBTITest inModal />;
    if (activeTool === 'menu') return <MenuPage inModal />;
    return null;
  };

  // Modal 容器尺寸样式（根据 expanded 切换）
  const isSpecialBg = document.documentElement.getAttribute('data-theme') !== 'black-gold';

  const modalSizeStyle = expanded
    ? {
        width: '100vw',
        height: '100vh',
        maxWidth: '100vw',
        maxHeight: '100vh',
        borderRadius: 0,
        background: isSpecialBg ? 'var(--bg-card)' : 'var(--bg-card)',
      }
    : {
        width: '90vw',
        maxWidth: 640,
        maxHeight: '80vh',
        borderRadius: 16,
      };

  return (
    <div
      onClick={handleMaskClick}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0, 0, 0, 0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        // 遮罩淡入动画
        animation: 'toolbox-mask-in 200ms ease forwards',
      }}
    >
      <div
        ref={modalRef}
        onTransitionEnd={handleTransitionEnd}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(201,168,76,0.08)',
          // Modal 弹出动画（第一段）
          animation: 'toolbox-bounce-in 400ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          // 尺寸过渡（第二段）
          transition: [
            'width 350ms cubic-bezier(0.4, 0, 0.2, 1)',
            'max-width 350ms cubic-bezier(0.4, 0, 0.2, 1)',
            'height 350ms cubic-bezier(0.4, 0, 0.2, 1)',
            'max-height 350ms cubic-bezier(0.4, 0, 0.2, 1)',
            'border-radius 350ms cubic-bezier(0.4, 0, 0.2, 1)',
          ].join(', '),
          ...modalSizeStyle,
        }}
      >
        {/* 标题栏 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: expanded ? 'flex-start' : 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border),',
          flexShrink: 0,
          gap: expanded ? 12 : 0,
        }}>
          {expanded && (
            <button
              onClick={handleBack}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--gold-dim)',
                fontSize: 20,
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 4,
                lineHeight: 1,
                transition: 'color 0.15s',
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold-light)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--gold-dim)'; }}
            >
              ←
            </button>
          )}
          <h2 style={{ margin: 0, fontSize: 17, color: 'var(--gold)', textShadow: '0 0 12px rgba(201,168,76,0.5)' }}>
            🧰 百宝箱
          </h2>
          {!expanded && (
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--gold-dim)',
                fontSize: 20,
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: 4,
                lineHeight: 1,
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--gold-light)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--gold-dim)'; }}
            >
              ✕
            </button>
          )}
        </div>

        {/* 全屏星空背景 */}
        {expanded && isSpecialBg && <StarryBackground />}
        {/* 内容区（可滚动） */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 20, position: 'relative' }}>
          {/* 工具列表层 */}
          {!activeTool && (
            <div style={{
              opacity: toolListVisible ? 1 : 0,
              transition: 'opacity 150ms ease',
              pointerEvents: toolListVisible ? 'auto' : 'none',
            }}>
              <ToolList onSelect={handleSelectTool} />
            </div>
          )}

          {/* 子工具层 */}
          {activeTool && (
            <div style={{
              opacity: subToolVisible ? 1 : 0,
              transition: 'opacity 200ms ease',
              height: '100%',
            }}>
              {renderSubTool()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

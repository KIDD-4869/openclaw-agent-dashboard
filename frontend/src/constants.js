export const EMOJI_MAP = { main: '🐕', arlecchino: '🔥', ajax: '⚡', columbina: '🕊️' };
export const NAME_MAP = { main: '小葵', arlecchino: '阿蕾奇诺', ajax: '阿贾克斯', columbina: '哥伦比娅' };
export const CATEGORY_ICONS = { main: '🏠', cron: '⏰', feishu: '📱', wechat: '💬', subagent: '🤖', session: '📋' };
export const STATUS_COLORS = { running: 'var(--green)', recent: 'var(--orange)', completed: 'var(--gray)', stale: '#e74c3c', failed: '#e74c3c' };
export const STATUS_LABELS = { running: '运行中', recent: '最近完成', completed: '已完成', stale: '可能卡住', failed: '已失败' };
export const AGENT_ORDER = ['main', 'arlecchino', 'ajax', 'columbina'];
export const AGENT_COLORS = { main: '#448aff', arlecchino: '#ff5722', ajax: '#ffc107', columbina: '#ab47bc' };
export const AGENT_MSG_COLORS = { main: '#448aff', arlecchino: '#e74c3c', ajax: 'var(--orange)', columbina: '#9b59b6' };
export const RUN_STATUS_LABELS = { success: '✅ 成功', skipped: '⏭ 跳过', unknown: '❓ 未知', never: '🚫 未运行', error: '❌ 失败', partial: '⚠️ 部分失败' };

export const FILTER_CATEGORIES = [
  { key: null, label: '全部' },
  { key: 'main', label: '🏠 主会话' },
  { key: 'cron', label: '⏰ 定时' },
  { key: 'feishu', label: '📱 飞书' },
  { key: 'wechat', label: '💬 微信' },
  { key: 'subagent', label: '🤖 子任务' },
];

export const ARCHIVE_CAT_COLORS = {
  main: 'var(--blue)', cron: 'var(--orange)', feishu: 'var(--green)',
  wechat: 'var(--green)', subagent: '#ab47bc',
};

export const TOOL_ICONS = {
  exec: '💻', read: '📖', write: '✏️', process: '⚙️',
};

export const AGENT_ROLES = {
  main: { id: 'main', name: '小葵', emoji: '🐕', color: '#448aff' },
  arlecchino: { id: 'arlecchino', name: '阿蕾奇诺', emoji: '🔥', color: '#e74c3c' },
  ajax: { id: 'ajax', name: '阿贾克斯', emoji: '⚡', color: '#ffc107' },
  columbina: { id: 'columbina', name: '哥伦比娅', emoji: '🕊️', color: '#ab47bc' },
};

export const BUILD_VERSION = 'v2.1-' + Date.now();

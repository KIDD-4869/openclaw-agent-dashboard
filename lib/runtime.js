/**
 * Runtime - 实时获取 subagent 运行状态
 * 通过 OpenClaw Gateway API 获取，带 5 秒缓存
 */

const GATEWAY_URL = 'http://localhost:18789/api/subagents';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN || '14124869';
const CACHE_TTL = 5000;

let _runtimeCache = null;
let _runtimeCacheTime = 0;

/**
 * 获取所有 subagent 的实时运行状态
 * 返回 Map<sessionId, { status, ... }>，失败时返回 null
 */
async function getSubagentRuntime() {
  const now = Date.now();
  if (_runtimeCache && (now - _runtimeCacheTime) < CACHE_TTL) {
    return _runtimeCache;
  }

  try {
    const resp = await fetch(GATEWAY_URL, {
      headers: { 'Authorization': `Bearer ${GATEWAY_TOKEN}` },
      signal: AbortSignal.timeout(3000),
    });
    if (!resp.ok) return _runtimeCache || null;

    const data = await resp.json();
    const map = new Map();

    // Gateway 返回的数据可能是数组或对象
    const list = Array.isArray(data) ? data : (data.subagents || data.sessions || []);
    for (const item of list) {
      const sid = item.sessionId || item.id;
      if (sid) {
        map.set(sid, {
          status: item.status || 'unknown',
          updatedAt: item.updatedAt || null,
        });
      }
    }

    _runtimeCache = map;
    _runtimeCacheTime = now;
    return map;
  } catch (_) {
    // 网络错误，静默降级
    return _runtimeCache || null;
  }
}

module.exports = { getSubagentRuntime };

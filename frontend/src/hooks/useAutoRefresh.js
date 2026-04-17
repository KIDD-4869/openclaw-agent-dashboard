import { useState, useEffect, useCallback, useRef } from 'react';
import { useSSE } from './useSSE';

/**
 * 自动刷新 hook，集成 SSE 实时推送
 * - SSE 连接正常时：收到事件立即刷新，轮询间隔拉长到 30 秒作为兜底
 * - SSE 断连时：自动降级到 8 秒轮询
 */
export function useAutoRefresh(fetchFn, intervalMs = 8000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [enabled, setEnabled] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const timerRef = useRef(null);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchFn();
      setData(result);
      setError(null);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e);
    } finally {
      setLoading(false);
    }
  }, [fetchFn]);

  // SSE 事件回调：收到事件时立即触发一次刷新
  const handleSSEEvent = useCallback((eventData) => {
    refresh();
  }, [refresh]);

  // 订阅 SSE 事件流
  const { connected: sseConnected } = useSSE('/api/events', handleSSEEvent);

  // 根据 SSE 连接状态动态调整轮询间隔
  const effectiveInterval = sseConnected ? 30000 : intervalMs;

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (enabled) {
      timerRef.current = setInterval(refresh, effectiveInterval);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [refresh, enabled, effectiveInterval]);

  const toggle = useCallback(() => setEnabled(e => !e), []);

  return { data, loading, error, enabled, lastRefresh, refresh, toggle, sseConnected };
}

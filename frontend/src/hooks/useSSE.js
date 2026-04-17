import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * 通用 SSE 订阅 hook
 * 订阅指定 URL 的 SSE 事件流，自动重连
 * @param {string} url - SSE endpoint URL
 * @param {function} onEvent - 收到事件时的回调
 * @returns {{ connected: boolean, lastEvent: object|null }}
 */
export function useSSE(url, onEvent) {
  const [connected, setConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const esRef = useRef(null);
  const reconnectTimer = useRef(null);
  const onEventRef = useRef(onEvent);

  // 保持 onEvent 引用最新
  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  const connect = useCallback(() => {
    // 清理旧连接
    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    try {
      const es = new EventSource(url);
      esRef.current = es;

      es.onopen = () => {
        setConnected(true);
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLastEvent(data);
          onEventRef.current?.(data);
        } catch {
          // 跳过非 JSON 数据
        }
      };

      es.onerror = () => {
        setConnected(false);
        es.close();
        esRef.current = null;
        // 3 秒后自动重连
        reconnectTimer.current = setTimeout(() => {
          connect();
        }, 3000);
      };
    } catch {
      setConnected(false);
      // 连接创建失败，3 秒后重试
      reconnectTimer.current = setTimeout(() => {
        connect();
      }, 3000);
    }
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }
      setConnected(false);
    };
  }, [connect]);

  return { connected, lastEvent };
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../../../api/config.js';
import { buildAuditoriaHeaders } from '../../../services/auditoriaCliente.js';
import { getAccessToken } from '../../../api/authTokenStorage.js';
import { getWhatsAppUnreadCount } from '../../../repositories/whatsappRepository.js';

const MAX_NOTIFICATIONS = 50;
const RECONNECT_MS = 5000;

function playNotificationSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
    setTimeout(() => ctx.close().catch(() => {}), 300);
  } catch {
    // ignorar se bloqueado pelo browser
  }
}

function showBrowserNotification(data) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    const body = `${data.contactName || data.phoneNumberFormatted || data.phoneNumber || 'Contato'}: ${data.content || ''}`;
    new Notification('Nova mensagem WhatsApp', {
      body,
      icon: '/favicon.ico',
      tag: `whatsapp-${data.messageId ?? data.phoneNumber ?? Date.now()}`,
    });
  }
}

function parseSseBlocks(buffer, onEvent) {
  const blocks = buffer.split('\n\n');
  const remainder = blocks.pop() ?? '';

  for (const block of blocks) {
    if (!block.trim() || block.startsWith(':')) continue;
    let eventName = 'message';
    let dataLine = '';
    for (const line of block.split('\n')) {
      if (line.startsWith('event:')) eventName = line.slice(6).trim();
      else if (line.startsWith('data:')) dataLine += line.slice(5).trim();
    }
    if (!dataLine) continue;
    try {
      onEvent(eventName, JSON.parse(dataLine));
    } catch {
      // ignorar blocos inválidos
    }
  }

  return remainder;
}

export function useWhatsAppNotifications({ enabled = true } = {}) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [latestInbound, setLatestInbound] = useState(null);
  const [latestMediaReady, setLatestMediaReady] = useState(null);
  const abortRef = useRef(null);
  const reconnectTimerRef = useRef(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await getWhatsAppUnreadCount();
      const count = Number(res?.unreadCount ?? 0);
      if (Number.isFinite(count)) setUnreadCount(count);
    } catch {
      // silencioso
    }
  }, []);

  const handleInbound = useCallback((data) => {
    if (String(data?.direction ?? '').toUpperCase() !== 'INBOUND') return;
    setNotifications((prev) => [data, ...prev].slice(0, MAX_NOTIFICATIONS));
    setUnreadCount((prev) => prev + 1);
    setLatestInbound(data);
    playNotificationSound();
    showBrowserNotification(data);
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    if ('Notification' in window && Notification.permission === 'default') {
      const timer = window.setTimeout(() => {
        Notification.requestPermission().catch(() => {});
      }, 3000);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;

    const connect = async () => {
      if (cancelled) return;
      const token = getAccessToken();
      if (!token) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(`${API_BASE_URL}/api/whatsapp/notifications/stream`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
            ...buildAuditoriaHeaders(),
          },
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!cancelled) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          buffer = parseSseBlocks(buffer, (eventName, data) => {
            if (eventName === 'whatsapp-message') handleInbound(data);
            else if (eventName === 'whatsapp-media-ready') setLatestMediaReady(data);
          });
        }
      } catch (err) {
        if (controller.signal.aborted || cancelled) return;
      }

      if (!cancelled) {
        reconnectTimerRef.current = window.setTimeout(connect, RECONNECT_MS);
      }
    };

    void fetchUnreadCount();
    void connect();

    return () => {
      cancelled = true;
      abortRef.current?.abort();
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
    };
  }, [enabled, fetchUnreadCount, handleInbound]);

  const clearNotifications = useCallback(() => {
    setUnreadCount(0);
    setNotifications([]);
  }, []);

  const dismissNotification = useCallback((messageId) => {
    setNotifications((prev) => prev.filter((n) => n.messageId !== messageId));
  }, []);

  return {
    notifications,
    unreadCount,
    latestInbound,
    latestMediaReady,
    clearNotifications,
    dismissNotification,
    refreshUnreadCount: fetchUnreadCount,
  };
}

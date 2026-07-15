import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../../../api/config.js';
import { buildAuditoriaHeaders } from '../../../services/auditoriaCliente.js';
import { getAccessToken } from '../../../api/authTokenStorage.js';
import { getUnreadTotal } from '../../../repositories/whatsappRepository.js';
import { getWhatsAppSseTabCoordinator } from '../../../utils/whatsappSseTabCoordinator.js';
import { resumoWhatsAppMessageContent } from '../utils/whatsappMessagePreview.js';

const MAX_NOTIFICATIONS = 50;
const RECONNECT_MS = 5000;
const UNREAD_REVALIDATE_MS = 60_000;
const UNREAD_INBOUND_DEBOUNCE_MS = 800;

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
    const resumo = resumoWhatsAppMessageContent(data.messageType, data.content);
    const body = `${data.contactName || data.phoneNumberFormatted || data.phoneNumber || 'Contato'}: ${resumo}`;
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
  const [latestStatusUpdate, setLatestStatusUpdate] = useState(null);
  const [latestConversationRead, setLatestConversationRead] = useState(null);
  const abortRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const revalidateTimerRef = useRef(null);
  const isLeaderRef = useRef(false);
  const coordinatorRef = useRef(null);

  const fetchUnreadTotal = useCallback(async () => {
    try {
      const res = await getUnreadTotal();
      const count = Number(res?.unreadConversations ?? 0);
      if (Number.isFinite(count)) setUnreadCount(count);
    } catch {
      // silencioso
    }
  }, []);

  const scheduleRevalidateUnreadTotal = useCallback(() => {
    if (revalidateTimerRef.current) window.clearTimeout(revalidateTimerRef.current);
    revalidateTimerRef.current = window.setTimeout(() => {
      void fetchUnreadTotal();
    }, UNREAD_INBOUND_DEBOUNCE_MS);
  }, [fetchUnreadTotal]);

  /** Ajuste otimista do total global (nº de conversas não lidas). Revalidação periódica corrige divergência. */
  const adjustUnreadConversations = useCallback((delta) => {
    if (!delta) return;
    setUnreadCount((prev) => Math.max(0, prev + delta));
  }, []);

  const handleInbound = useCallback(
    (data, { playFeedback = true } = {}) => {
      if (String(data?.direction ?? '').toUpperCase() !== 'INBOUND') return;
      const isReaction = String(data?.messageType ?? '').toUpperCase() === 'REACTION';
      if (!isReaction) {
        setNotifications((prev) => [data, ...prev].slice(0, MAX_NOTIFICATIONS));
      }
      setLatestInbound(data);
      if (!isReaction) {
        scheduleRevalidateUnreadTotal();
      }
      if (playFeedback && !isReaction) {
        playNotificationSound();
        showBrowserNotification(data);
      }
    },
    [scheduleRevalidateUnreadTotal],
  );

  const handleConversationRead = useCallback(
    (data) => {
      if (!data?.phoneNumber) return;
      setLatestConversationRead({
        phoneNumber: data.phoneNumber,
        lastReadAt: data.lastReadAt ?? null,
        token: Date.now(),
      });
      void fetchUnreadTotal();
    },
    [fetchUnreadTotal],
  );

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

    const coordinator = getWhatsAppSseTabCoordinator();
    coordinatorRef.current = coordinator;
    coordinator.start();

    let cancelled = false;

    const connectAsLeader = async () => {
      if (cancelled || !isLeaderRef.current) return;
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

        while (!cancelled && isLeaderRef.current) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          buffer = parseSseBlocks(buffer, (eventName, data) => {
            if (
              eventName === 'whatsapp-message' ||
              eventName === 'whatsapp-media-ready' ||
              eventName === 'whatsapp-status' ||
              eventName === 'conversation-read'
            ) {
              coordinator.publishFromLeader(eventName, data);
            }
          });
        }
      } catch {
        if (controller.signal.aborted || cancelled || !isLeaderRef.current) return;
      }

      if (!cancelled && isLeaderRef.current) {
        reconnectTimerRef.current = window.setTimeout(connectAsLeader, RECONNECT_MS);
      }
    };

    const removeEventListener = coordinator.addEventListener((eventName, data, meta) => {
      if (eventName === 'whatsapp-message') {
        handleInbound(data, { playFeedback: !meta.fromBroadcast || isLeaderRef.current });
      } else if (eventName === 'whatsapp-media-ready') {
        setLatestMediaReady(data);
      } else if (eventName === 'whatsapp-status') {
        if (data?.waMessageId && data?.status) {
          setLatestStatusUpdate({ ...data, token: Date.now() });
        }
      } else if (eventName === 'conversation-read') {
        handleConversationRead(data);
      }
    });

    const removeLeaderListener = coordinator.addLeaderListener((isLeader) => {
      isLeaderRef.current = isLeader;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      abortRef.current?.abort();
      abortRef.current = null;
      if (isLeader && !cancelled) {
        void connectAsLeader();
      }
    });

    void fetchUnreadTotal();

    const onFocus = () => void fetchUnreadTotal();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') void fetchUnreadTotal();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    const interval = window.setInterval(() => void fetchUnreadTotal(), UNREAD_REVALIDATE_MS);

    return () => {
      cancelled = true;
      removeEventListener();
      removeLeaderListener();
      abortRef.current?.abort();
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      if (revalidateTimerRef.current) window.clearTimeout(revalidateTimerRef.current);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(interval);
      coordinator.stop();
      coordinatorRef.current = null;
    };
  }, [enabled, fetchUnreadTotal, handleConversationRead, handleInbound]);

  const clearNotifications = useCallback(() => {
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
    latestStatusUpdate,
    latestConversationRead,
    clearNotifications,
    dismissNotification,
    refreshUnreadCount: fetchUnreadTotal,
    adjustUnreadConversations,
  };
}

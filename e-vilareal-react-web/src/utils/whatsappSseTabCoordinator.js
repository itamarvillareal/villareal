const CHANNEL = 'vilareal.whatsapp.sse';
const LEADER_KEY = 'vilareal.whatsapp.sse.leader';
const HEARTBEAT_MS = 2000;
const STALE_MS = 6000;

const TAB_ID =
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/** @type {WhatsAppSseTabCoordinator | null} */
let singleton = null;

function readLeader() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(LEADER_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.id !== 'string' || typeof parsed.ts !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeLeader() {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(LEADER_KEY, JSON.stringify({ id: TAB_ID, ts: Date.now() }));
}

function clearLeaderIfMine() {
  const leader = readLeader();
  if (leader?.id === TAB_ID) {
    localStorage.removeItem(LEADER_KEY);
  }
}

class WhatsAppSseTabCoordinator {
  constructor() {
    /** @type {Set<(eventName: string, data: unknown, meta: { fromBroadcast: boolean }) => void>} */
    this.listeners = new Set();
    /** @type {Set<(isLeader: boolean) => void>} */
    this.leaderListeners = new Set();
    this.isLeader = false;
    /** @type {BroadcastChannel | null} */
    this.bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(CHANNEL) : null;
    this.heartbeatTimer = null;
    this.subscriberCount = 0;
    this.onBeforeUnload = () => {
      if (this.isLeader) clearLeaderIfMine();
    };
  }

  /** @returns {WhatsAppSseTabCoordinator} */
  static getInstance() {
    if (!singleton) singleton = new WhatsAppSseTabCoordinator();
    return singleton;
  }

  start() {
    if (this.subscriberCount === 0) {
      window.addEventListener('beforeunload', this.onBeforeUnload);
      if (this.bc) {
        this.bc.onmessage = (ev) => this.handleBroadcast(ev.data);
      }
      window.addEventListener('storage', this.onStorage);
      this.heartbeatTimer = window.setInterval(() => this.tick(), HEARTBEAT_MS);
      this.tick();
    }
    this.subscriberCount += 1;
  }

  stop() {
    this.subscriberCount = Math.max(0, this.subscriberCount - 1);
    if (this.subscriberCount > 0) return;

    window.removeEventListener('beforeunload', this.onBeforeUnload);
    window.removeEventListener('storage', this.onStorage);
    if (this.heartbeatTimer) {
      window.clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.isLeader) {
      clearLeaderIfMine();
      this.setLeader(false);
    }
    this.bc?.close();
    this.bc = null;
    singleton = null;
  }

  onStorage = (ev) => {
    if (ev.key !== LEADER_KEY) return;
    this.tick();
  };

  tick() {
    const now = Date.now();
    const leader = readLeader();
    const leaderStale = !leader || now - leader.ts > STALE_MS;

    if (leaderStale) {
      writeLeader();
      const claim = readLeader();
      if (claim?.id === TAB_ID) {
        this.setLeader(true);
      } else {
        this.setLeader(false);
      }
      return;
    }

    if (leader.id === TAB_ID) {
      writeLeader();
      this.setLeader(true);
      return;
    }

    this.setLeader(false);
  }

  /** @param {boolean} next */
  setLeader(next) {
    if (this.isLeader === next) return;
    this.isLeader = next;
    for (const fn of this.leaderListeners) fn(next);
  }

  /** @param {(eventName: string, data: unknown, meta: { fromBroadcast: boolean }) => void} listener */
  addEventListener(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** @param {(isLeader: boolean) => void} listener */
  addLeaderListener(listener) {
    this.leaderListeners.add(listener);
    listener(this.isLeader);
    return () => this.leaderListeners.delete(listener);
  }

  /** Só a aba líder deve chamar após evento SSE. */
  publishFromLeader(eventName, data) {
    if (!this.isLeader) return;
    this.bc?.postMessage({ type: 'event', eventName, data });
    this.dispatch(eventName, data, { fromBroadcast: false });
  }

  /** @param {unknown} msg */
  handleBroadcast(msg) {
    if (this.isLeader || !msg || typeof msg !== 'object') return;
    if (msg.type !== 'event') return;
    this.dispatch(msg.eventName, msg.data, { fromBroadcast: true });
  }

  /** @param {string} eventName @param {unknown} data @param {{ fromBroadcast: boolean }} meta */
  dispatch(eventName, data, meta) {
    for (const fn of this.listeners) fn(eventName, data, meta);
  }
}

export function getWhatsAppSseTabCoordinator() {
  return WhatsAppSseTabCoordinator.getInstance();
}

export { TAB_ID as whatsAppSseTabId };

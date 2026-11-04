import { useEffect, useRef } from 'react';

const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

/** Live order updates with a low-frequency refresh fallback for reconnects. */
export function useOrderStatusEvents(orderNumber, status, reload, enabled = true) {
  const statusRef = useRef(status);
  useEffect(() => { statusRef.current = status; }, [status]);

  useEffect(() => {
    if (!enabled || !orderNumber) return undefined;
    const source = new EventSource(`${API_BASE}/api/orders/${encodeURIComponent(orderNumber)}/events`, { withCredentials: true });
    const onStatus = (event) => {
      try {
        const update = JSON.parse(event.data);
        if (update.status && update.status !== statusRef.current) reload();
      } catch {
        // Ignore malformed event data; the timed refresh remains available.
      }
    };
    source.addEventListener('order-status', onStatus);
    const refresh = () => { if (!document.hidden) reload(); };
    const timer = window.setInterval(refresh, 45000);
    window.addEventListener('focus', refresh);
    return () => {
      source.close();
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [orderNumber, reload, enabled]);
}

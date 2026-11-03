import { useCallback, useEffect, useRef, useState } from 'react';
import { get } from '../services/api.js';

/**
 * Fetches `path` and re-fetches when it changes. In-flight requests are aborted
 * when the path changes or the component unmounts.
 */
export function useApi(path, { enabled = true, keepPrevious = true } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: Boolean(enabled && path) });
  const controller = useRef(null);

  const load = useCallback(async () => {
    if (!enabled || !path) return;
    controller.current?.abort();
    const ac = new AbortController();
    controller.current = ac;
    setState((s) => ({ data: keepPrevious ? s.data : null, error: null, loading: true }));
    try {
      const data = await get(path, { signal: ac.signal });
      if (!ac.signal.aborted) setState({ data, error: null, loading: false });
    } catch (error) {
      if (error.name === 'AbortError') return;
      setState((s) => ({ data: s.data, error, loading: false }));
    }
  }, [path, enabled, keepPrevious]);

  useEffect(() => {
    load();
    return () => controller.current?.abort();
  }, [load]);

  return { ...state, reload: load };
}

export function useDebounced(value, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

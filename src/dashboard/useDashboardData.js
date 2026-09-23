import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api';

// Small in-memory cache so switching back and forth between filter
// combinations is instant, without re-hitting the aggregation endpoint.
const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // queryString → { at, data }

export function invalidateDashboardCache() { cache.clear(); }

// Fetches /analytics/dashboard for a query string. Keeps the last good payload
// visible while a new one loads (so filter changes don't flash to skeletons).
export function useDashboardData(queryString) {
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  const reqId = useRef(0);

  const load = useCallback((force = false) => {
    const id = ++reqId.current;
    const hit = cache.get(queryString);
    if (!force && hit && Date.now() - hit.at < CACHE_TTL_MS) {
      setState({ data: hit.data, loading: false, error: '' });
      return;
    }
    setState((s) => ({ ...s, loading: true, error: '' }));
    api(`/analytics/dashboard${queryString ? `?${queryString}` : ''}`)
      .then((data) => {
        cache.set(queryString, { at: Date.now(), data });
        if (id === reqId.current) setState({ data, loading: false, error: '' });
      })
      .catch((e) => {
        if (id === reqId.current) setState((s) => ({ data: s.data, loading: false, error: e.message || 'Failed to load analytics' }));
      });
  }, [queryString]);

  useEffect(() => { load(false); }, [load]);

  return { ...state, refresh: () => load(true) };
}

"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Runs `fetcher` when `deps` change. Stale responses are ignored, and reload() re-runs the fetch.
 * Returns { loading, error, data, reload, setData }.
 */
export function useAsync(fetcher, deps = []) {
  const [tick, setTick] = useState(0);
  const [state, setState] = useState({ loading: true, error: "", data: null });

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    Promise.resolve()
      .then(() => fetcher())
      .then((data) => alive && setState({ loading: false, error: "", data }))
      .catch((err) => alive && setState({ loading: false, error: err?.message || "Something went wrong.", data: null }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  const setData = useCallback((data) => setState((s) => ({ ...s, data })), []);
  return { ...state, reload, setData };
}

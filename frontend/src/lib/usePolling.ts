import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api";

// Fetches now and every `ms`. Keeps the last good data if a refresh fails.
export function usePolling<T>(fn: () => Promise<T>, ms = 5000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const refresh = useCallback(async () => {
    try {
      const result = await fnRef.current();
      setData(result);
      setError(null);
      setErrorStatus(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setErrorStatus(e instanceof ApiError ? e.status : null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, ms);
    return () => clearInterval(id);
  }, [refresh, ms]);

  return { data, error, errorStatus, loading, refresh };
}

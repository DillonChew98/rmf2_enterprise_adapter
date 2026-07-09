import { useCallback, useEffect, useState } from "react";
import { apiErrorMessage } from "@/shared/api/axios";

export type FetchState<T> =
  | { status: "loading" }
  | { status: "ok"; data: T }
  | { status: "error"; error: string };

export interface UseFetchOptions {
  intervalMs?: number;
}

export interface UseFetchResult<T> {
  state: FetchState<T>;
  refetch: () => void;
}

export function useFetch<T>(
  fn: () => Promise<T>,
  options: UseFetchOptions = {}
): UseFetchResult<T> {
  const { intervalMs } = options;
  const [state, setState] = useState<FetchState<T>>({ status: "loading" });
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;

    const load = (initial: boolean) => {
      if (initial) setState({ status: "loading" });
      fn()
        .then((data) => {
          if (!cancelled) setState({ status: "ok", data });
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          // On a poll, keep the last good data on screen rather than
          // replacing it with an error flash.
          if (initial) {
            setState({ status: "error", error: apiErrorMessage(err) });
          }
        });
    };

    load(true);

    const id =
      intervalMs && intervalMs > 0
        ? setInterval(() => load(false), intervalMs)
        : null;

    return () => {
      cancelled = true;
      if (id !== null) clearInterval(id);
    };
    // fn is intentionally not in deps — callers pass an inline lambda;
    // they trigger refetches via `tick`.
  }, [tick, intervalMs]); // eslint-disable-line react-hooks/exhaustive-deps

  return { state, refetch };
}

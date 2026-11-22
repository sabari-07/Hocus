import { createContext, useContext, useSyncExternalStore } from 'react';
import { useStore } from 'zustand';
import type { CoreState } from '@hocus/core';
import type { HocusRuntime, UiState } from './runtime.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const RuntimeContext = createContext<HocusRuntime<any> | null>(null);

export function useRuntime<S = unknown>(): HocusRuntime<S> {
  const r = useContext(RuntimeContext);
  if (!r) throw new Error('useRuntime must be used inside <HocusApp>');
  return r as HocusRuntime<S>;
}

export function useUi<T>(sel: (s: UiState) => T): T {
  const r = useRuntime();
  return useStore(r.ui, sel);
}

/** Engine state; re-renders on every non-pointer event. */
export function useCore<S = unknown>(): CoreState<S> {
  const r = useRuntime<S>();
  return useSyncExternalStore(
    (fn) => r.subscribe(fn),
    () => r.state,
  );
}

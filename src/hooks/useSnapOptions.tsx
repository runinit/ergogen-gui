import { createContext, useContext, useState, type ReactNode } from 'react';
import { defaultSnapping, type SnapOptions } from '../utils/layoutSnapping';

const SnapContext = createContext<
  [SnapOptions, (value: SnapOptions) => void] | null
>(null);
export function SnapProvider({ children }: { children: ReactNode }) {
  const state = useState(defaultSnapping);
  return <SnapContext.Provider value={state}>{children}</SnapContext.Provider>;
}
export function useSnapOptions() {
  const shared = useContext(SnapContext);
  const local = useState(defaultSnapping);
  return shared || local;
}

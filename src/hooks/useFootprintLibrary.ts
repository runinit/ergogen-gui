import { useEffect, useState, useSyncExternalStore } from 'react';
import {
  librarySnapshot,
  loadLibrary,
  watchLibrary,
} from '../utils/footprintLibrary';

export function useFootprintLibrary() {
  const entries = useSyncExternalStore(
    watchLibrary,
    librarySnapshot,
    librarySnapshot
  );
  const [error, setError] = useState('');
  useEffect(() => {
    void loadLibrary().catch((error) => setError(String(error)));
  }, []);
  return { entries, error };
}

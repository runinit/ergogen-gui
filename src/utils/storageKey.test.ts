import { afterEach, expect, it, vi } from 'vitest';
import { storageKey } from './storageKey';

afterEach(() => vi.unstubAllEnvs());

it('preserves production keys and separates every preview key including legacy imports', () => {
  vi.stubEnv('REACT_APP_DEPLOYMENT_CHANNEL', 'production');
  expect(storageKey('ergogen:config')).toBe('ergogen:config');
  vi.stubEnv('REACT_APP_DEPLOYMENT_CHANNEL', 'preview');
  expect(storageKey('ergogen:config')).toBe('preview:ergogen:config');
  expect(storageKey('LOCAL_STORAGE_CONFIG')).toBe(
    'preview:LOCAL_STORAGE_CONFIG'
  );
  expect(storageKey(storageKey('ergogen:config'))).toBe(
    'preview:ergogen:config'
  );
});

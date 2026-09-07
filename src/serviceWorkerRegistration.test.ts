import { afterEach, expect, it, vi } from 'vitest';
import { register } from './serviceWorkerRegistration';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

it('registers when React mounts after the window load event', async () => {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('PUBLIC_URL', '/ergogen-gui');
  vi.spyOn(document, 'readyState', 'get').mockReturnValue('complete');
  const registerWorker = vi
    .fn()
    .mockResolvedValue({ addEventListener: vi.fn() });
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: { register: registerWorker, ready: Promise.resolve({}) },
  });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    status: 200,
    headers: new Headers({ 'content-type': 'application/javascript' }),
  } as Response);

  register();

  await vi.waitFor(() => {
    expect(registerWorker).toHaveBeenCalledWith(
      '/ergogen-gui/service-worker.js'
    );
  });
});

const VIEWER_REVISION = 'kicad10-unconnected-pads-1';
let pending: Promise<void> | undefined;

// Load on demand, with a revisioned URL so offline caches cannot retain an older parser.
export function loadPcbViewer(): Promise<void> {
  if (
    customElements.get('kicanvas-embed') &&
    customElements.get('kicanvas-source')
  ) {
    return Promise.resolve();
  }
  if (!pending) {
    const url = `${import.meta.env.BASE_URL}dependencies/kicanvas.js?v=${VIEWER_REVISION}`;
    pending = import(/* @vite-ignore */ url)
      .then(() => {
        if (
          !customElements.get('kicanvas-embed') ||
          !customElements.get('kicanvas-source')
        ) {
          throw new Error('KiCanvas did not initialize.');
        }
      })
      .catch((error: unknown) => {
        pending = undefined;
        throw error;
      });
  }
  return pending;
}

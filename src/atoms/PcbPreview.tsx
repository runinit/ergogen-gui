import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { loadPcbViewer } from '../utils/pcbViewer';

/**
 * Props for the PcbPreview component.
 * @typedef {object} Props
 * @property {string} pcb - The KiCad PCB file content as a string.
 * @property {string} key - A unique key for the component, important for React's rendering logic.
 * @property {string} [aria-label] - An optional aria-label for the preview container.
 * @property {string} [data-testid] - An optional data-testid for testing purposes.
 */
type Props = {
  pcb: string;
  previewKey: string;
  'aria-label'?: string;
  'data-testid'?: string;
};

/**
 * A React component that embeds a KiCad PCB preview using the `<kicanvas-embed>` custom element.
 * This component takes the PCB data as a string and renders it within an interactive canvas.
 *
 * @param {Props} props - The props for the component.
 * @returns {JSX.Element} A `<kicanvas-embed>` element containing the PCB source.
 */
const PcbPreview = ({
  pcb,
  previewKey,
  'aria-label': ariaLabel,
  'data-testid': dataTestId,
}: Props): JSX.Element => {
  const ref = useRef<HTMLElement>(null);
  const [error, setError] = useState<string | null>(null);

  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setError(null);
    void loadPcbViewer()
      .then(() => {
        if (active) {
          setReady(true);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(`Viewer startup failed: ${String(reason)}`);
        }
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  // Listen before the custom element loads; regeneration clears stale failures.
  useLayoutEffect(() => {
    const viewer = ref.current;
    if (!viewer) {
      return;
    }
    setError(null);
    const loaded = () => setError(null);
    const failed = (event: Event) => {
      setError(
        (event as CustomEvent<{ message?: string }>).detail?.message ||
          'Unable to load board'
      );
    };
    viewer.addEventListener('kicanvas:load', loaded);
    viewer.addEventListener('kicanvas:error', failed);
    return () => {
      viewer.removeEventListener('kicanvas:load', loaded);
      viewer.removeEventListener('kicanvas:error', failed);
    };
  }, [pcb, previewKey]);

  return (
    <>
      {error && (
        <p role="alert">
          PCB preview unavailable: {error}. Download remains available.
          {!ready && (
            <button onClick={() => setAttempt((value) => value + 1)}>
              Retry viewer
            </button>
          )}
        </p>
      )}
      {!ready && !error && <p role="status">Loading PCB viewer…</p>}
      <kicanvas-embed
        hidden={!ready}
        ref={ref}
        key={previewKey}
        controls="full"
        controlslist="nodownload nooverlay"
        theme="kicad"
        aria-label={ariaLabel}
        data-testid={dataTestId}
      >
        <kicanvas-source type="board" hidden style={{ display: 'none' }}>
          {pcb}
        </kicanvas-source>
      </kicanvas-embed>
    </>
  );
};

export default PcbPreview;

import { saveAs } from 'file-saver';
import { useEffect, useState } from 'react';
import type { GeometryJob } from '../hooks/useCasePreview';
import { caseReadiness } from '../utils/caseReadiness';
import { Results } from '../types/results';
import { createZip } from '../utils/zip';
import { CaseAssets } from '../utils/caseAssets';
import ShareDialog from './ShareDialog';
import { StudioActions, StudioMain, StudioStatus } from './StudioStyles';
import { theme } from '../theme/theme';

export default function StudioExport({
  source,
  injections,
  assets,
  result,
  stale,
  blockers,
  review,
  preview,
  analysis,
}: {
  source: string;
  injections?: string[][];
  assets: CaseAssets;
  result?: Results | null;
  stale: boolean;
  blockers: number;
  review: () => void;
  preview: GeometryJob;
  analysis: GeometryJob;
}) {
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const hasOutputs =
    Object.keys(result?.pcbs || {}).length > 0 ||
    Object.values(result?.outlines || {}).some(
      (files) => files.svg || files.dxf
    );
  const ready = hasOutputs && !stale && blockers === 0;
  const caseError = caseReadiness(source, preview, analysis);
  const [reviewed, setReviewed] = useState<Results | null>(null);
  const confirmed =
    !caseError && reviewed !== null && reviewed === preview.result;
  useEffect(() => {
    if (caseError) {
      setReviewed(null);
    }
  }, [caseError]);
  const download = (name: string, content: string) =>
    saveAs(new Blob([content]), name);
  const archive = (outputs: Results, kind: 'board' | 'case' = 'board') => {
    setError('');
    void createZip(
      outputs,
      source,
      injections,
      false,
      kind === 'case',
      assets
    ).catch((error) => setError(String(error)));
  };
  return (
    <StudioMain style={{ padding: theme.spacing.lg, flex: 1 }}>
      <h2>Export project</h2>
      <p>
        {stale
          ? 'Geometry needs updating. Your source is always available.'
          : blockers
            ? `${blockers} blockers need review before geometry export.`
            : hasOutputs
              ? 'PCB and outline files match the current project.'
              : 'This project has no PCB or outline outputs yet.'}
      </p>
      {error && <StudioStatus role="alert">{error}</StudioStatus>}
      <h3>Editable project</h3>
      <StudioActions>
        <button onClick={() => download('config.yaml', source)}>
          Download YAML
        </button>
        <button onClick={() => archive({})}>Download project ZIP</button>
        <button onClick={() => setSharing(true)}>Share source link</button>
      </StudioActions>
      <p>
        The project ZIP includes custom footprints and imported assets. Source
        links contain YAML and footprints.
      </p>
      <h3>PCB and outlines</h3>
      <StudioActions>
        <button
          disabled={!ready}
          onClick={() =>
            archive({ pcbs: result?.pcbs, outlines: result?.outlines })
          }
        >
          Download PCB and outlines ZIP
        </button>
      </StudioActions>
      {Object.entries(result?.pcbs || {}).map(([name, content]) => (
        <StudioActions key={name}>
          <button
            disabled={!ready}
            onClick={() =>
              download(
                name.endsWith('.kicad_pcb') ? name : `${name}.kicad_pcb`,
                content
              )
            }
          >
            {name} · KiCad PCB
          </button>
        </StudioActions>
      ))}
      {Object.entries(result?.outlines || {})
        .filter(([name]) => !name.startsWith('_'))
        .map(([name, files]) => (
          <StudioActions key={name}>
            {(['dxf', 'svg'] as const).map(
              (type) =>
                files[type] && (
                  <button
                    key={type}
                    disabled={!ready}
                    onClick={() => download(`${name}.${type}`, files[type]!)}
                  >
                    {name} · {type.toUpperCase()}
                  </button>
                )
            )}
          </StudioActions>
        ))}
      <h3>Case parts</h3>
      <p>{caseError || 'Generated case files match the current project.'}</p>
      <button onClick={review}>Review case and manufacturing</button>
      <label>
        <input
          type="checkbox"
          checked={confirmed}
          disabled={!!caseError}
          onChange={(event) =>
            setReviewed(event.target.checked ? preview.result : null)
          }
        />{' '}
        I reviewed dimensions, hardware and manufacturing findings.
      </label>
      <StudioActions>
        <button
          disabled={!confirmed}
          onClick={() => preview.result && archive(preview.result, 'case')}
        >
          Download case ZIP
        </button>
      </StudioActions>
      <p>Physical fit requires a fabricated prototype.</p>
      {sharing && (
        <ShareDialog
          config={source}
          injections={injections}
          onClose={() => setSharing(false)}
        />
      )}
    </StudioMain>
  );
}

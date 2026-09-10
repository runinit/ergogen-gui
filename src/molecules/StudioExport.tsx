import { saveAs } from 'file-saver';
import { useState } from 'react';
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
}: {
  source: string;
  injections?: string[][];
  assets: CaseAssets;
  result?: Results | null;
  stale: boolean;
  blockers: number;
  review: () => void;
}) {
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const ready = !!result && !stale && blockers === 0;
  const download = (name: string, content: string) =>
    saveAs(new Blob([content]), name);
  const archive = (outputs: Results) => {
    void createZip(outputs, source, injections, false, false, assets).catch(
      (error) => setError(String(error))
    );
  };
  return (
    <StudioMain style={{ padding: theme.spacing.lg, flex: 1 }}>
      <h2>Export project</h2>
      <p>
        {stale
          ? 'Geometry needs updating. Your source is always available.'
          : blockers
            ? `${blockers} blockers need review before geometry export.`
            : 'PCB and outline files match the current project.'}
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
      <p>
        Generate the case, review clearances and process checks, then download
        its STEP, STL and manufacturing package.
      </p>
      <button onClick={review}>Review case and manufacturing</button>
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

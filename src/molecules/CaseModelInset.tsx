import { useEffect, useState } from 'react';
import styled from 'styled-components';
import { inspectFootprint } from '../utils/footprintService';
import { modelList } from '../utils/modelGeometry';
import { findAsset, CaseAssets } from '../utils/caseAssets';
import { BoardInventory, CaseConfig } from '../types/case';
import type { FootprintInfo, ModelBinding } from '../types/footprint';
import FootprintCanvas from './FootprintCanvas';
import { theme } from '../theme/theme';
const Inset = styled.section`
  position: absolute;
  bottom: ${theme.spacing.md};
  left: ${theme.spacing.md};
  width: ${theme.cad.insetWidth};
  height: ${theme.cad.insetHeight};
  display: flex;
  flex-direction: column;
  border: 1px solid ${theme.colors.accent};
  border-radius: ${theme.caseWizard.radius};
  overflow: hidden;
  z-index: 1;
  background: ${theme.colors.background};
  > div {
    flex: 1;
    min-height: 0;
  }
  && button {
    padding: ${theme.spacing.xs} ${theme.spacing.sm};
  }
  strong {
    width: 100%;
  }
  header {
    display: flex;
    flex-wrap: wrap;
    gap: ${theme.spacing.xs};
    padding: ${theme.spacing.xs};
    font-size: ${theme.fontSizes.bodySmall};
  }
  @media (max-width: ${theme.caseWizard.smallScreen}) {
    width: ${theme.cad.narrowInsetWidth};
    height: ${theme.cad.narrowInsetHeight};
  }
`;
export default function CaseModelInset({
  board,
  id,
  spec,
  assets,
  selected,
  onSelect,
  onChange,
}: {
  board: BoardInventory;
  id: string;
  spec: CaseConfig;
  assets: CaseAssets;
  selected: number;
  onSelect: (index: number) => void;
  onChange: (models: ModelBinding[]) => void;
}) {
  const [info, setInfo] = useState<FootprintInfo>();
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'translate' | 'rotate' | 'scale'>(
    'translate'
  );
  const component = board.components.find((component) => component.id === id);
  useEffect(() => {
    const controller = new AbortController();
    setInfo(undefined);
    setError('');
    void inspectFootprint(board.source, { id }, controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) {
          setInfo(value);
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setError(String(error));
        }
      });
    return () => controller.abort();
  }, [board.source, id]);
  if (!component) {
    return null;
  }
  let models: ModelBinding[];
  try {
    models = modelList(
      spec.board?.models?.[id] ||
        (component.models.map((model) => ({
          ...model,
          asset: findAsset(model.path, assets),
        })) as ModelBinding[])
    );
  } catch (error) {
    return <p role="alert">{String(error)}</p>;
  }
  return (
    <Inset aria-label="Model alignment inset">
      <header>
        <strong>{component.reference} · model alignment</strong>
        {(['translate', 'rotate', 'scale'] as const).map((value) => (
          <button
            key={value}
            aria-label={`Inset ${value}`}
            aria-pressed={mode === value}
            onClick={() => setMode(value)}
          >
            {value === 'translate' ? 'Move' : value}
          </button>
        ))}
      </header>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <FootprintCanvas
          info={info}
          models={models}
          assets={assets}
          selected={selected}
          onSelect={onSelect}
          mode={mode}
          side={component.side === 'bottom' ? 'B' : 'F'}
          onChange={(model) =>
            onChange(
              models.map((previous, index) =>
                index === selected ? model : previous
              )
            )
          }
        />
      )}
    </Inset>
  );
}

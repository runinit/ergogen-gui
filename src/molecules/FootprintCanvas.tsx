import { modelPreview } from '../utils/cachedModelPreview';
import {
  graphicPoints,
  padOutline,
  footprintView,
} from '../utils/footprintGeometry';
/* eslint-disable react/no-unknown-property -- React Three Fiber scene properties. */
import { Component, ReactNode, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { previewBounds } from '../utils/previewBounds';
import {
  Bounds,
  OrbitControls,
  TransformControls,
  Line,
  useBounds,
} from '@react-three/drei';
import { Group, Euler, Shape, ShapeGeometry, DoubleSide } from 'three';
import { STLLoader } from 'three-stdlib';
import styled from 'styled-components';
import type { FootprintInfo, ModelBinding, Vec3 } from '../types/footprint';
import { assetBytes, CaseAssets } from '../utils/caseAssets';
import { theme } from '../theme/theme';

const Surface = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  min-height: ${theme.caseWizard.previewHeight};
  background: ${theme.colors.backgroundLight};
  svg[role='img'] {
    width: 100%;
    height: 100%;
    min-height: ${theme.caseWizard.planHeight};
  }
`;
class Boundary extends Component<{ children: ReactNode }, { error: string }> {
  state = { error: '' };
  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }
  render() {
    return this.state.error ? (
      <p role="alert">Preview unavailable: {this.state.error}</p>
    ) : (
      this.props.children
    );
  }
}
type Props = {
  info?: FootprintInfo;
  models: ModelBinding[];
  assets: CaseAssets;
  selected: number;
  onSelect: (index: number) => void;
  onChange?: (model: ModelBinding) => void;
  mode?: 'translate' | 'rotate' | 'scale';
  view?: '2d' | '3d';
  pad?: string;
  onPad?: (number: string) => void;
  side?: 'F' | 'B';
};
function Fit({ revision }: { revision: unknown }) {
  const bounds = useBounds();
  const scene = useThree((state) => state.scene);
  useEffect(() => {
    bounds.refresh(previewBounds(scene)).clip().fit();
  }, [bounds, revision, scene]);
  return null;
}
function ModelMesh({
  model,
  assets,
  active,
  mode,
  onChange,
  onSelect,
}: {
  model: ModelBinding;
  assets: CaseAssets;
  active: boolean;
  mode: Props['mode'];
  onChange: Props['onChange'];
  onSelect: () => void;
}) {
  const object = useRef<Group>(null);
  const source = modelPreview(model, assets);
  const geometry = useMemo(() => {
    if (!source) {
      return null;
    }
    return new STLLoader().parse(
      assetBytes(JSON.parse(source).stl).buffer as ArrayBuffer
    );
  }, [source]);
  useEffect(() => () => geometry?.dispose(), [geometry]);
  if (!geometry) {
    return null;
  }
  const mesh = (
    <group
      ref={object}
      position={model.offset}
      rotation={[
        ...(model.rotate.map((value) => (-value * Math.PI) / 180) as Vec3),
        'ZYX',
      ]}
      scale={model.scale}
    >
      <mesh
        geometry={geometry}
        userData={{ footprint: true }}
        onClick={(event) => {
          event.stopPropagation();
          onSelect();
        }}
      >
        <meshStandardMaterial
          color={active ? theme.colors.accent : theme.colors.textDark}
          metalness={0.2}
          roughness={0.6}
        />
      </mesh>
    </group>
  );
  if (!active || !onChange) {
    return mesh;
  }
  return (
    <TransformControls
      mode={mode}
      onObjectChange={() => {
        if (!object.current) {
          return;
        }
        const rotation = new Euler().setFromQuaternion(
          object.current.quaternion,
          'ZYX'
        );
        onChange({
          ...model,
          offset: object.current.position.toArray() as Vec3,
          scale: object.current.scale.toArray() as Vec3,
          rotate: [rotation.x, rotation.y, rotation.z].map(
            (value) => (-value * 180) / Math.PI
          ) as Vec3,
        });
      }}
    >
      {mesh}
    </TransformControls>
  );
}
function PadPlan({ info, pad, onPad }: Pick<Props, 'info' | 'pad' | 'onPad'>) {
  const candidates =
    info?.pads.flatMap((p) => [
      [p.at[0] - p.size[0], p.at[1] - p.size[1]],
      [p.at[0] + p.size[0], p.at[1] + p.size[1]],
    ]) || [];
  candidates.push(...(info?.graphics.flatMap(graphicPoints) || []));
  const points = candidates.length
    ? candidates
    : [
        [-10, -10],
        [10, 10],
      ];
  const low = [0, 1].map((axis) => Math.min(...points.map((p) => p[axis])) - 3);
  const high = [0, 1].map(
    (axis) => Math.max(...points.map((p) => p[axis])) + 3
  );
  return (
    <svg
      role="img"
      aria-label="Footprint pads and geometry"
      viewBox={`${low[0]} ${low[1]} ${high[0] - low[0]} ${high[1] - low[1]}`}
    >
      {info?.graphics.map((g, index) => (
        <polyline
          key={index}
          points={graphicPoints(g)
            .map((p) => p.join(','))
            .join(' ')}
          fill="none"
          stroke={theme.colors.textDarker}
          strokeWidth={0.15}
        />
      ))}
      {info?.pads.map((p) => (
        <g
          key={p.index}
          transform={`translate(${p.at[0]} ${p.at[1]}) rotate(${-Number(p.at[2] || 0)})`}
          onClick={() => onPad?.(p.number)}
        >
          <title>{p.mechanical ? 'Mechanical pad' : `Pad ${p.number}`}</title>
          {p.shape === 'circle' ? (
            <ellipse
              rx={p.size[0] / 2}
              ry={p.size[1] / 2}
              fill={
                p.number === pad
                  ? theme.colors.accent
                  : theme.colors.warningDark
              }
            />
          ) : (
            <rect
              x={-p.size[0] / 2}
              y={-p.size[1] / 2}
              width={p.size[0]}
              height={p.size[1]}
              rx={
                p.shape === 'oval'
                  ? Math.min(...p.size) / 2
                  : p.shape === 'roundrect'
                    ? Math.min(...p.size) * (p.roundrect || 0)
                    : 0
              }
              fill={
                p.number === pad
                  ? theme.colors.accent
                  : theme.colors.warningDark
              }
            />
          )}
          <text
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={Math.min(...p.size) * 0.55}
            fill={theme.colors.text}
          >
            {p.number}
          </text>
        </g>
      ))}
      <path
        d="M -1 0 H 1 M 0 -1 V 1"
        stroke={theme.colors.accent}
        strokeWidth={0.1}
      />
    </svg>
  );
}
export default function FootprintCanvas({
  info: sourceInfo,
  models,
  assets,
  selected,
  onSelect,
  onChange,
  mode = 'translate',
  view = '3d',
  pad,
  onPad,
  side = 'F',
}: Props) {
  const info = useMemo(
    () => footprintView(sourceInfo, side),
    [sourceInfo, side]
  );
  const pads = useMemo(
    () =>
      info?.pads.map((p) => {
        const shape = new Shape();
        padOutline(p).forEach(([x, y], index) =>
          index ? shape.lineTo(x, y) : shape.moveTo(x, y)
        );
        shape.closePath();
        return new ShapeGeometry(shape);
      }) || [],
    [info]
  );
  useEffect(() => () => pads.forEach((pad) => pad.dispose()), [pads]);
  const assetRevision = models.map((model) => model.asset).join(',');
  const revision = useMemo(() => [info, assetRevision], [info, assetRevision]);
  return (
    <Surface aria-label="Footprint preview">
      <Boundary>
        {view === '2d' ? (
          <PadPlan info={info} pad={pad} onPad={onPad} />
        ) : (
          <Canvas
            frameloop="demand"
            camera={{ position: [25, -35, 30], up: [0, 0, 1] }}
          >
            <ambientLight intensity={1.4} />
            <directionalLight position={[20, -20, 50]} intensity={2} />
            <Bounds margin={1.5} maxDuration={0}>
              <Fit revision={revision} />
              <group>
                {info?.pads.map((p, index) => (
                  <mesh
                    key={p.index}
                    geometry={pads[index]}
                    userData={{ footprint: true }}
                    position={[p.at[0], -p.at[1], 0]}
                    rotation={[0, 0, ((p.at[2] || 0) * Math.PI) / 180]}
                    onClick={(event) => {
                      event.stopPropagation();
                      onPad?.(p.number);
                    }}
                  >
                    <meshStandardMaterial
                      side={DoubleSide}
                      color={
                        p.number === pad
                          ? theme.colors.accent
                          : theme.colors.warningDark
                      }
                    />
                  </mesh>
                ))}
                {info?.graphics.map((g, index) => {
                  const points = graphicPoints(g);
                  return points.length > 1 ? (
                    <Line
                      key={index}
                      userData={{ footprint: true }}
                      points={points.map(
                        (point) => [point[0], -point[1], 0] as Vec3
                      )}
                      color={theme.colors.textDarker}
                    />
                  ) : null;
                })}
                <group rotation={side === 'B' ? [Math.PI, 0, 0] : [0, 0, 0]}>
                  {models.map((model, index) => (
                    <ModelMesh
                      key={`${index}:${model.asset || model.path}`}
                      model={model}
                      assets={assets}
                      active={index === selected}
                      onSelect={() => onSelect(index)}
                      onChange={onChange}
                      mode={mode}
                    />
                  ))}
                  <axesHelper args={[5]} />
                </group>
              </group>
            </Bounds>
            <OrbitControls makeDefault />
          </Canvas>
        )}
      </Boundary>
    </Surface>
  );
}

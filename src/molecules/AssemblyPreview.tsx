/* eslint-disable react/no-unknown-property -- React Three Fiber declares these scene properties. */
import { Component, ReactNode, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, OrbitControls, useBounds } from '@react-three/drei';
import { STLLoader } from 'three-stdlib';
import { DoubleSide, Plane, Vector3 } from 'three';
import styled from 'styled-components';
import { theme } from '../theme/theme';
import { CaseOutput } from '../types/results';
import { DesignReport } from '../types/design';

const Viewport = styled.div`
  width: 100%;
  height: 100%;
  min-height: ${theme.caseWizard.previewHeight};
  background: ${theme.colors.backgroundLight};
`;
type Props = {
  parts: DesignReport['assemblies'][string]['parts'];
  cases: Record<string, CaseOutput>;
  exploded: boolean;
  selected: string;
  onSelect: (name: string) => void;
  onPick?: (point: number[]) => void;
  mode?: 'assembly' | 'section' | 'part';
  lateral?: number;
  travel?: number;
  angle?: number;
};

// A missing GPU must leave the design editor and exports usable.
class PreviewBoundary extends Component<
  { children: ReactNode },
  { error: string }
> {
  state = { error: '' };

  static getDerivedStateFromError(error: Error) {
    return { error: error.message };
  }

  render() {
    if (this.state.error) {
      return <p role="alert">3D preview unavailable: {this.state.error}</p>;
    }
    return this.props.children;
  }
}

// Refit when generated geometry or the inspected part changes.
function Fit({ revision }: { revision: unknown }) {
  const bounds = useBounds();
  useEffect(() => {
    bounds.refresh().clip().fit();
  }, [bounds, revision]);
  return null;
}

// STL parts retain their assembly coordinates; only exploded offsets move them.
function AssemblyScene({
  parts,
  cases,
  exploded,
  selected,
  onSelect,
  onPick,
  mode = 'assembly',
  travel = 0,
  lateral = 0,
  angle = 0,
}: Props) {
  const meshes = useMemo(() => {
    const loader = new STLLoader();
    return Object.entries(parts).flatMap(([name, part]) => {
      const stl = cases[name]?.stl;
      if (!stl) {
        return [];
      }
      const data =
        stl instanceof Uint8Array
          ? (stl.buffer.slice(
              stl.byteOffset,
              stl.byteOffset + stl.byteLength
            ) as ArrayBuffer)
          : stl;
      const geometry = loader.parse(data);
      geometry.computeBoundingBox();
      return [
        {
          name,
          geometry,
          explode: part.explode,
          role: part.role,
          motion: part.motion,
          reference: part.reference,
        },
      ];
    });
  }, [parts, cases]);
  useEffect(
    () => () => meshes.forEach((mesh) => mesh.geometry.dispose()),
    [meshes]
  );
  const revision = useMemo(
    () => ({ meshes, mode, selected, exploded }),
    [meshes, mode, selected, exploded]
  );
  if (!meshes.length) {
    return <p role="status">Generate STL parts to preview the assembly.</p>;
  }
  return (
    <Viewport aria-label="3D assembly preview">
      <Canvas
        gl={{ localClippingEnabled: true }}
        camera={{ position: [100, -100, 120], up: [0, 0, 1] }}
      >
        <ambientLight intensity={1.5} />
        <directionalLight position={[50, -50, 100]} intensity={2} />
        <Bounds fit clip observe margin={1.3} maxDuration={0}>
          <Fit revision={revision} />
          <group>
            {meshes
              .filter(
                (mesh) =>
                  mode !== 'part' || mesh.name === (selected || meshes[0].name)
              )
              .map((mesh) => (
                <mesh
                  key={mesh.name}
                  geometry={mesh.geometry}
                  visible={
                    mode !== 'part' ||
                    mesh.name === (selected || meshes[0].name)
                  }
                  position={[
                    mesh.role === 'plate' ||
                    mesh.role === 'pcb' ||
                    mesh.motion === 'floating'
                      ? lateral
                      : 0,
                    mesh.role === 'plate' ||
                    mesh.role === 'pcb' ||
                    mesh.motion === 'floating'
                      ? -travel * Math.sin((angle * Math.PI) / 180)
                      : 0,
                    exploded
                      ? mesh.explode
                      : mesh.role === 'plate' ||
                          mesh.role === 'pcb' ||
                          mesh.motion === 'floating'
                        ? travel * Math.cos((angle * Math.PI) / 180)
                        : 0,
                  ]}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(mesh.name);
                    onPick?.(
                      event.object.worldToLocal(event.point.clone()).toArray()
                    );
                  }}
                >
                  <meshStandardMaterial
                    color={
                      selected === mesh.name
                        ? theme.colors.accent
                        : mesh.reference
                          ? theme.colors.infoDark
                          : theme.colors.textDarker
                    }
                    side={DoubleSide}
                    clippingPlanes={
                      mode === 'section'
                        ? [
                            new Plane(
                              new Vector3(-1, 0, 0),
                              ((meshes[0]?.geometry.boundingBox?.min.x || 0) +
                                (meshes[0]?.geometry.boundingBox?.max.x || 0)) /
                                2
                            ),
                          ]
                        : []
                    }
                    metalness={0.1}
                    roughness={0.6}
                  />
                </mesh>
              ))}
          </group>
        </Bounds>
        <OrbitControls makeDefault />
      </Canvas>
    </Viewport>
  );
}

export default function AssemblyPreview(props: Props) {
  return (
    <PreviewBoundary>
      <AssemblyScene {...props} />
    </PreviewBoundary>
  );
}

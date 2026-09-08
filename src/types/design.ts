import type { IModel } from 'makerjs';
export type Vec2 = [number, number];
export interface SketchEntity {
  type: string;
  points?: string[];
  center?: string;
  radius?: number;
  start?: string;
  end?: string;
  construction?: boolean;
  model: IModel;
}
export interface DesignFeature {
  source: string;
  model: IModel;
  bounds?: { low: Vec2; high: Vec2; width: number; height: number };
  contours: number;
  sketch?: {
    points: Record<string, Vec2>;
    frames?: Record<string, { angle: number; handedness: number }>;
    dimensions?: Record<
      string,
      {
        type: string;
        actual: number;
        points?: string[];
        geometry?: string;
        lines?: string[];
      }
    >;
    entities: Record<string, SketchEntity>;
  };
  constraints?: Record<string, unknown>;
}
export interface DesignReport {
  analysis?: Record<string, import('./case').CaseAnalysis>;
  boards?: Record<string, import('./case').BoardInventory>;
  features: Record<string, DesignFeature>;
  diagnostics: { feature: string; message: string; code: string }[];
  adjustments: {
    feature: string;
    target: number;
    actual: number;
    min: number;
    max: number;
  }[];
  assemblies: Record<
    string,
    {
      preset?: string;
      placement?: { origin: number[]; angle: number; lift: number };
      features?: { id: string; bounds: [number[], number[]] }[];
      mounting?: string;
      step?: string;
      parameters?: Record<string, unknown>;
      manufacturing?: {
        feature: string;
        code: string;
        message: string;
        severity: string;
      }[];
      parts: Record<
        string,
        {
          slices: { model: IModel; z: number; thickness: number }[];
          explode: number;
          role?: string;
          motion?: string;
          reference?: boolean;
        }
      >;
      suggestions: {
        id: string;
        kind: 'mount' | 'gasket';
        position: Vec2;
        definition: Record<string, unknown>;
      }[];
    }
  >;
}

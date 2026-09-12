import { IModel } from 'makerjs';
import { CaseFinding } from '../hooks/useCasePreview';
// Raw YAML retains expressions and extension fields until engine analysis resolves them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CaseConfig = Record<string, any>;
export type CasePlacement = {
  id: string;
  kind: 'mount' | 'gasket';
  position: number[];
  definition: CaseConfig;
  model?: IModel;
};
export type CaseEdge = { id: string; points: number[][]; length: number };
export type CaseAnalysis = {
  model?: IModel;
  exterior?: IModel;
  bounds?: { low: number[]; high: number[]; width: number; height: number };
  edges: CaseEdge[];
  placements: CasePlacement[];
  suggestions: CasePlacement[];
  findings: CaseFinding[];
  holeProposals?: { id: string; position: number[]; diameter: number }[];
  parts: Record<string, unknown>;
  parameters: CaseConfig;
};
export type BoardComponent = {
  native?: { matrix: number[] };
  id: string;
  reference: string;
  footprint: string;
  position: number[];
  rotation: number;
  side: string;
  family: string | null;
  size: number[] | null;
  height: number[] | null;
  models: {
    asset?: string;
    path: string;
    offset: number[];
    rotate: number[];
    scale: number[];
  }[];
  populated: boolean;
};
export type BoardInventory = {
  native?: boolean;
  name: string;
  source: string;
  model: IModel;
  thickness: number;
  components: BoardComponent[];
  holes: { id: string; position: number[]; diameter: number }[];
  findings: CaseFinding[];
};

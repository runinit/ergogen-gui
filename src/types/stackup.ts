import type { Dimension } from '../utils/designUnits';
export interface SheetLayer {
  label?: string;
  material: 'foam' | 'silicone' | 'gasket';
  lower: string;
  upper: string;
  thickness: Dimension;
  compression?: Dimension;
  inset?: Dimension;
  clearance?: Dimension;
  profile?: string;
  cutouts?: string[];
}
export interface StackupSpec {
  pcb: string;
  plate?: { thickness?: Dimension; gap?: Dimension };
  layers?: Record<string, SheetLayer>;
}
interface SheetReport extends SheetLayer {
  stock?: number;
  installed?: number;
  z?: number;
  available?: number;
  remaining?: number;
  status: 'ready' | 'interference' | 'unresolved';
  message?: string;
  output?: string;
  holes?: number;
}
export interface StackupReport {
  pcb: string;
  plate?: number;
  gap?: number;
  surfaces?: Record<string, number>;
  layers: Record<string, SheetReport>;
  error?: string;
}

import * as footprintTools from 'ergogen/src/footprint-tools';
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import type { ModelBinding, Vec3 } from '../types/footprint';
import type { CaseAssets } from './caseAssets';

const DEGREE = Math.PI / 180;
export function modelMatrix(model: ModelBinding) {
  return new Matrix4().compose(
    new Vector3(...model.offset),
    new Quaternion().setFromEuler(
      new Euler(...(model.rotate.map((v) => -v * DEGREE) as Vec3), 'ZYX')
    ),
    new Vector3(...model.scale)
  );
}
export function modelList(
  model: ModelBinding | ModelBinding[] | undefined
): ModelBinding[] {
  return model ? (Array.isArray(model) ? model : [model]) : [];
}
export function modelEnvelope(models: ModelBinding[], assets: CaseAssets) {
  return footprintTools.envelope(models, assets) as {
    size: number[];
    height: number[];
    body_offset: number[];
  } | null;
}

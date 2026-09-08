import { DesignReport } from '../types/design';

type Assembly = DesignReport['assemblies'][string];
const PICK_ALLOWANCE_MM = 1;

// Convert a picked solid point into the declared feature coordinate frame.
export function pickCaseFeature(
  assembly: Assembly,
  point: number[]
): string | undefined {
  if (!assembly.placement) {
    return;
  }
  const { origin, angle, lift } = assembly.placement;
  const radians = (angle * Math.PI) / 180;
  const y = point[1] - origin[1],
    z = point[2] - lift;
  const local = [
    point[0],
    y * Math.cos(radians) + z * Math.sin(radians) + origin[1],
    -y * Math.sin(radians) + z * Math.cos(radians),
  ];
  return assembly.features?.find((feature) =>
    local.every(
      (value, axis) =>
        value >= feature.bounds[0][axis] - PICK_ALLOWANCE_MM &&
        value <= feature.bounds[1][axis] + PICK_ALLOWANCE_MM
    )
  )?.id;
}

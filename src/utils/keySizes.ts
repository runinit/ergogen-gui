// Nominal MX envelopes: 19.05 mm pitch with the starter's 18 mm 1u cap.
const MX_PITCH = 19.05;
const MX_CAP = 18;
const MX_UNITS = [1, 1.25, 1.5, 1.75, 2, 2.25, 2.75, 6.25, 7];
const dimension = (units: number) =>
  Number((MX_CAP + (units - 1) * MX_PITCH).toFixed(4));
export const KEY_SIZES = [
  ...MX_UNITS.map((units) => ({
    id: `mx-${units}`,
    label: `MX ${units}u`,
    size: [dimension(units), MX_CAP],
  })),
  ...[1.25, 1.5, 2].map((units) => ({
    id: `mx-${units}-tall`,
    label: `MX ${units}u · tall`,
    size: [MX_CAP, dimension(units)],
  })),
];

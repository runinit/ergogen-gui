const KICAD_VRML_UNIT_MM = 2.54;

// KiCad needs an explicit material to display an IndexedFaceSet.
export function kiCadVrml(positions: number[]) {
  const points = positions.map((value) => value / KICAD_VRML_UNIT_MM);
  const indices = Array.from(
    { length: positions.length / 9 },
    (_, i) => `${i * 3}, ${i * 3 + 1}, ${i * 3 + 2}, -1`
  ).join(', ');
  return `#VRML V2.0 utf8\nShape { appearance Appearance { material Material { diffuseColor 0.65 0.65 0.65 } } geometry IndexedFaceSet { coord Coordinate { point [${points.join(', ')}] } coordIndex [${indices}] } }`;
}

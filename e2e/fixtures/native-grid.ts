export default `# Keep the original layout
schema: ergogen/v1
units: {pitch: 19}
parts:
  mx:
    revision: "1"
    envelopes:
      pcb: {size: [18, 18]}
      plate: {size: [14, 14], corner_relief: 0.5}
layout:
  clusters:
    keys:
      arrangement: {type: columns, columns: [left, right, far], rows: [home, top], pitch: [pitch, pitch]}
  objects:
    keys_left_home: {kind: key, part: mx, cluster: keys, cell: [left, home]}
    keys_left_top: {kind: key, part: mx, cluster: keys, cell: [left, top]}
    keys_right_home: {kind: key, part: mx, cluster: keys, cell: [right, home]}
    keys_right_top: {kind: key, part: mx, cluster: keys, cell: [right, top]}
    keys_far_home: {kind: key, part: mx, cluster: keys, cell: [far, home]}
    keys_far_top: {kind: key, part: mx, cluster: keys, cell: [far, top]}
`;

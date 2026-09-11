import grid from './native-grid';

export default `${grid}
designs:
  regions:
    board: {shape: {size: [80, 60], at: [19, 0, 0]}}
    switches: {select: {kind: key}, envelope: plate}
  profiles:
    board: {from: regions.board}
  assemblies:
    case:
      preset: enclosure
      profile: profiles.board
      mounting: gasket
      wall: 3
      floor: 2
      height: 24
      plate: 1.5
      plate_z: 13
      bezel: 8
      fit: 0.3
      cutouts: [regions.switches]
      gaskets:
        left:
          anchor: {shift: [-21, 0]}
          size: [6, 10]
`;

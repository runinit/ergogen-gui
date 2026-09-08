// A synthetic layout keeps offline CAD coverage independent of user designs.
export default `points:
  zones:
    keys:
      columns: {left: {}, right: {}}
      rows: {home: {}, top: {}}
outlines:
  source: [{what: rectangle, size: [60, 60]}]
designs:
  regions:
    board: {outline: source}
    switches: {where: true, size: 14}
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
          anchor: {shift: [-30, 0]}
          size: [6, 10]
`;

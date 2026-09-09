export default {
  label: 'Imported PCB',
  author: 'RunInit',
  value:
    'schema: ergogen/v1\nmeta:\n  name: Imported PCB\n  note: Import a KiCad board named board.kicad_pcb before generating.\nlayout:\n  objects: {}\ndesigns:\n  assemblies:\n    imported:\n      preset: enclosure\n      profile: profiles.__pcb_imported\n      board:\n        source: asset\n        name: board.kicad_pcb\n      mounting: bottom\n      wall: 3\n      floor: 2\n      height: 24\n      plate_z: 13\n      bezel: 10\n      fit: 0.5\n      ledge:\n        width: 2\n        thickness: 2\n',
};

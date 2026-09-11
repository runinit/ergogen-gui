export default {
  label: 'Starter',
  author: 'RunInit',
  value:
    'schema: ergogen/v1\nmeta:\n  name: Starter\nparts:\n  mx:\n    revision: "1"\n    envelopes:\n      pcb:\n        size:\n          - 18\n          - 18\n      plate:\n        size:\n          - 14\n          - 14\n      body:\n        size:\n          - 14\n          - 14\n        height:\n          - 0\n          - 11.6\n    footprints:\n      switch:\n        what: mx\n        params:\n          from: "{{column_net}}"\n          to: "{{row_net}}"\nlayout:\n  objects:\n    key:\n      kind: key\n      part: mx\ndesigns:\n  regions:\n    keys:\n      select:\n        kind: key\n      envelope: pcb\n  profiles:\n    board:\n      from: regions.keys\n      clearance: 2\n',
};

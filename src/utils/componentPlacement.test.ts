import { parse } from 'yaml';
import { insertComponent } from './componentPlacement';
import { createBoard } from './boardDefaults';
import { addCluster } from './studioSource';
it('allocates pins from placed keys without a controller in setup', () => {
  const source = addCluster(createBoard(), 'keys', 'columns', {
    columns: 2,
    rows: 1,
  });
  const next = insertComponent(source, 'mcu', 'nice_nano');
  const objects = parse(next).layout.objects;
  const key = Object.values(objects).find(
    (item: any) => item.kind === 'key'
  ) as any;
  expect(Object.values(objects.mcu.footprints.main.params)).toContain(
    key.properties.column_net
  );
  expect(Object.values(objects.mcu.footprints.main.params)).toContain(
    key.properties.row_net
  );
});
it('requires measured battery dimensions and places its body below the PCB', () => {
  expect(() => insertComponent(createBoard(), 'battery', 'battery')).toThrow(
    /measured/
  );
  const item = parse(
    insertComponent(createBoard(), 'battery', 'battery', [40, 20, 5])
  ).layout.objects.battery;
  expect(item.envelopes.body.height).toEqual([-5, 0]);
});
it('inserts a split connector on the chosen board and preserves custom layers', () => {
  const data = parse(createBoard());
  data.pcbs.right = { thickness: 1.6 };
  data.layout.layers.custom = {
    surface: 'pcb.right.top',
    placement: { at: [2, 0, 0] },
  };
  const next = parse(
    insertComponent(
      require('yaml').stringify(data),
      'link',
      'connector',
      undefined,
      'right'
    )
  );
  expect(next.layout.objects.link.pcb).toBe('right');
  expect(next.layout.objects.link.layer).toBe('custom');
  expect(next.layout.layers.custom.placement.at).toEqual([2, 0, 0]);
});

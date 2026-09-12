import { describe, expect, it } from 'vitest';
import { prepareEntry } from './footprintEngine';
import { createEntry } from './footprintLibrary';

describe('Footprint worker preparation', () => {
  it('previews dynamic footprints with required nets without changing their source parameters', async () => {
    const source =
      'module.exports={params:{from:undefined,to:undefined},body:p=>`(module "Dynamic" (layer F.Cu) ${p.at} (pad 1 smd rect (at 0 0) (size 1 1) (layers F.Cu) ${p.from}) (pad 2 smd rect (at 1 0) (size 1 1) (layers F.Cu) ${p.to}))`}';
    const prepared = await prepareEntry(
      createEntry('Dynamic', source, 'ergogen')
    );
    expect(prepared.info.pads).toHaveLength(2);
    expect(prepared.module).toBe(source);
    expect(prepared.parameters.from.type).toBe('net');
  });
});

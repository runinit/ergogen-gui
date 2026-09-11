import { describe, expect, it } from 'vitest';
import {
  entryInjection,
  resolveLibrary,
  linkedUses,
  createEntry,
  saveRevision,
} from './footprintLibrary';

describe('Reusable footprint identity', () => {
  it('updates linked projects while preserving instance overrides and unrelated names', () => {
    const entry = createEntry(
      'Controller',
      'module.exports = {params:{},body:()=>""}',
      'ergogen'
    );
    const injection = entryInjection(entry);
    const projects = [
      {
        config: `pcbs:\n  one:\n    footprints:\n      controller:\n        what: ${entry.alias}\n        params: {side: B, custom: 7}`,
      },
      {
        config: `pcbs:\n  two:\n    footprints:\n      controller:\n        what: ${entry.alias}`,
      },
    ];
    const next = { ...entry, revision: 2, resolved: 'new body' };
    const source = projects[0].config;
    const resolved = resolveLibrary(
      [injection, ['footprint', 'Controller', 'unrelated']],
      [next]
    );

    expect(resolved?.[0][2]).toContain('new body');
    expect(resolved?.[1][2]).toBe('unrelated');
    expect(projects[0].config).toBe(source);
    expect(linkedUses(projects, entry.alias)).toEqual({
      projects: 2,
      declarations: 2,
    });
  });

  it('does not replace an injection whose alias collides without an identity binding', () => {
    const entry = createEntry('Same name', 'original', 'ergogen');
    expect(
      resolveLibrary([['footprint', entry.alias, 'unrelated']], [entry])?.[0][2]
    ).toBe('unrelated');
  });

  it('rejects an obsolete draft instead of losing a later saved revision', () => {
    const entry = createEntry('Draft', 'original', 'ergogen');
    const saved = saveRevision(entry, undefined);
    expect(saved.revision).toBe(1);
    expect(() => saveRevision(entry, saved)).toThrow(/changed.*reopen/i);
    expect(saveRevision({ ...saved, name: 'updated' }, saved).revision).toBe(2);
  });
});

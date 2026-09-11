import { createHistory } from './projectHistory';

it('shares source history across code and visual commands', () => {
  const history = createHistory('initial');
  history.record('typing', 'code', 100);
  history.record('formula', 'code', 200);
  history.record('moved', 'command', 210);
  expect(history.undo()).toBe('formula');
  expect(history.undo()).toBe('initial');
  expect(history.redo()).toBe('formula');
  history.record('different move');
  expect(history.redo()).toBeUndefined();
});

it('keeps an invalid source draft recoverable and resets between projects', () => {
  const history = createHistory('layout: {}');
  history.record('layout: [');
  expect(history.undo()).toBe('layout: {}');
  expect(history.redo()).toBe('layout: [');
  history.reset('another project');
  expect(history.undo()).toBeUndefined();
});

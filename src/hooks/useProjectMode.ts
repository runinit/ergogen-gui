import { useRef } from 'react';
import yaml from 'js-yaml';

export function useProjectMode(
  source: string | undefined,
  project: string | null | undefined
) {
  const mode = useRef({ project, native: false });
  if (mode.current.project !== project) {
    mode.current = { project, native: false };
  }
  try {
    const document = yaml.load(source || '') as {
      schema?: string;
    } | null;
    mode.current.native = document?.schema === 'ergogen/v1';
  } catch {
    // Keep the current editor available while the user repairs unfinished YAML.
  }
  return mode.current.native ? 'native' : 'legacy';
}

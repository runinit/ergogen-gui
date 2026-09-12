import type { GeometryJob } from '../hooks/useCasePreview';
import type { CaseConfig } from '../types/case';
import { sourceValue } from './sourceSnapshot';

// Review and downloads refer to the same generated snapshot, including every case.
export function caseReadiness(
  source: string,
  preview: GeometryJob,
  analysis: GeometryJob
) {
  try {
    const specs = (sourceValue(source, ['designs', 'assemblies']) ||
      {}) as Record<string, CaseConfig>;
    const cases = Object.entries(specs);
    if (!cases.length) {
      return 'Create a case to generate enclosure files.';
    }
    if (preview.pending) {
      return 'Generating case geometry…';
    }
    if (preview.error || analysis.error) {
      return preview.error || analysis.error;
    }
    if (
      preview.stale ||
      analysis.stale ||
      analysis.pending ||
      !preview.result
    ) {
      return 'Generate the current case before downloading.';
    }
    for (const [name, spec] of cases) {
      const assembly = preview.result.designs?.assemblies?.[name];
      if (!assembly) {
        return `Generate ${name} before downloading.`;
      }
      const parts = [
        'bottom',
        'top',
        'plate',
        ...(spec.construction === 'midframe' ? ['middle'] : []),
      ];
      if (
        spec.preset === 'enclosure' &&
        parts.some((part) => !spec.manufacturing?.[part]?.process)
      ) {
        return `Choose manufacturing processes for ${name}.`;
      }
      const findings = [
        ...(analysis.result?.designs?.analysis?.[name]?.findings || []),
        ...(assembly.manufacturing || []),
      ];
      if (findings.some((finding) => finding.severity === 'error')) {
        return `Review the blockers in ${name}.`;
      }
    }
    if (preview.diagnostics.some((finding) => finding.severity === 'error')) {
      return 'Review generation blockers.';
    }
    return '';
  } catch {
    return 'Repair the project YAML before downloading case files.';
  }
}

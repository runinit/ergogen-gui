import { CaseFinding } from '../hooks/useCasePreview';

export default function CaseReview({
  findings,
  onReview,
}: {
  findings: CaseFinding[];
  onReview: (path: string) => void;
}) {
  const groups = new Map<string, CaseFinding[]>();
  const seen = new Set<string>();
  for (const finding of [...findings].sort(
    (a, b) => Number(b.severity === 'error') - Number(a.severity === 'error')
  )) {
    const identity = `${finding.code}:${finding.feature}:${finding.message}`;
    if (seen.has(identity)) {
      continue;
    }
    seen.add(identity);
    const category =
      finding.severity === 'error'
        ? 'Blockers'
        : /height|unresolved|missing|clearance/.test(finding.code)
          ? 'Incomplete checks'
          : 'Review';
    const key = `${category} · ${finding.code}`;
    groups.set(key, [...(groups.get(key) || []), finding]);
  }
  return (
    <section aria-label="Grouped findings">
      {Array.from(groups).map(([key, items]) => (
        <div key={key}>
          <h3>
            {key} ({items.length})
          </h3>
          <p>
            {items[0].code === 'component-height'
              ? 'Missing component envelopes are optional. Clearance for these bodies has not been validated.'
              : items[0].message}
          </p>
          {items[0].code === 'component-height' ? (
            <button onClick={() => onReview(items[0].feature)}>
              Set up components
            </button>
          ) : null}
          <details>
            <summary>Affected features ({items.length})</summary>
            {items.map((item) => (
              <p key={`${item.feature}:${item.message}`}>
                <button onClick={() => onReview(item.feature)}>
                  {item.feature.split('.').at(-1)}
                </button>{' '}
                · {item.message}
              </p>
            ))}
          </details>
        </div>
      ))}
    </section>
  );
}

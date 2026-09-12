import { resolve } from 'ergogen/src/native/layout';
import type { LayoutReport, ResolvedObject } from 'ergogen/src/native';
import { readStudio, getValue, setValue, removeValue } from './studioSource';
import {
  polygonPoints,
  layoutSpacing,
  hasSpacing,
  edgeGap,
} from './snapSpacing';
import type { SourcePath } from './designSource';

const EPSILON = 0.00001;
const PRECISION = 1_000_000;
const OWNERSHIP = ['meta', 'studio', 'resizeSpacing'];
type Compensation = { path: SourcePath; before?: unknown; after: unknown };
type Ownership = { edits: Compensation[]; conflicts: string[] };
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const rounded = (value: number) => Math.round(value * PRECISION) / PRECISION;
const dot = (a: number[], b: number[]) =>
  a.reduce((sum, value, i) => sum + value * b[i], 0);

// Find a separating polygon edge along the permitted direction of travel.
function separation(
  a: ResolvedObject,
  b: ResolvedObject,
  direction: number[],
  spacing: ReturnType<typeof layoutSpacing>
) {
  const left = polygonPoints(a),
    right = polygonPoints(b);
  let distance = Infinity;
  for (const points of [left, right]) {
    for (let i = 0; i < points.length; i++) {
      const p = points[i],
        q = points[(i + 1) % points.length];
      const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (length < EPSILON) {
        continue;
      }
      const axis = [(p[1] - q[1]) / length, (q[0] - p[0]) / length];
      const l = left.map((point) => dot(point, axis));
      const r = right.map((point) => dot(point, axis));
      const gap = Math.max(
        edgeGap(a, axis, 0, spacing),
        edgeGap(b, axis, 0, spacing)
      );
      if (!Number.isFinite(gap)) {
        throw new Error('Resolve key pitch before resizing.');
      }
      if (
        Math.min(...r) - Math.max(...l) >= gap - EPSILON ||
        Math.min(...l) - Math.max(...r) >= gap - EPSILON
      ) {
        return 0;
      }
      const velocity = dot(direction, axis);
      if (Math.abs(velocity) < EPSILON) {
        continue;
      }
      const needed =
        velocity > 0
          ? (Math.max(...l) + gap - Math.min(...r)) / velocity
          : (Math.min(...l) - gap - Math.max(...r)) / velocity;
      distance = Math.min(distance, needed);
    }
  }
  return Number.isFinite(distance) ? Math.max(0, distance) : 0;
}

// Only undo a generated field when its saved value has not been edited.
export function clearResizeSpacing(source: string, clusters: string[]) {
  let result = source;
  for (const cluster of clusters) {
    const owned = getValue(result, [...OWNERSHIP, cluster]) as
      | Ownership
      | undefined;
    const retained: Compensation[] = [];
    for (const edit of [...(owned?.edits || [])].reverse()) {
      if (!equal(getValue(result, edit.path), edit.after)) {
        continue;
      }
      const section = edit.path[1] as 'objects' | 'clusters';
      const id = String(edit.path[2]);
      const data = readStudio(result);
      if (
        data.layout[section]?.[id]?.locked ||
        data.layout.clusters?.[cluster]?.locked ||
        Object.values(data.layout.constraints || {}).some((rule) =>
          rule.refs.some(
            (ref) =>
              ref.includes(`clusters.${cluster}`) ||
              Object.entries(data.layout.objects || {}).some(
                ([key, item]) =>
                  item.cluster === cluster &&
                  (ref === key ||
                    ref === `objects.${key}` ||
                    ref.startsWith(`objects.${key}.`) ||
                    ref.startsWith(`${key}.`))
              )
          )
        )
      ) {
        retained.unshift(edit);
        continue;
      }
      const candidate =
        edit.before === undefined
          ? removeValue(result, edit.path)
          : setValue(result, edit.path, edit.before);
      const before = resolve(readStudio(result)),
        after = resolve(readStudio(candidate));
      if (
        Object.values(before.objects).some(
          (item) =>
            item.locked && !equal(item.matrix, after.objects[item.id]?.matrix)
        )
      ) {
        retained.unshift(edit);
        continue;
      }
      result = candidate;
    }
    if (owned) {
      result = setValue(result, [...OWNERSHIP, cluster], {
        edits: retained,
        conflicts: [],
      });
    }
  }
  return result;
}

export function spaceResizedKeys(
  source: string,
  clusters: string[],
  original: LayoutReport
): string {
  let result = source;
  for (const cluster of clusters) {
    const edits = [
        ...((getValue(result, [...OWNERSHIP, cluster]) as Ownership | undefined)
          ?.edits || []),
      ],
      conflicts: string[] = [];
    const data = readStudio(result),
      spec = data.layout.clusters?.[cluster];
    if (spec?.arrangement?.type !== 'columns' || spec.mirror) {
      continue;
    }
    let report = resolve(readStudio(result));
    const spacing = layoutSpacing(result, report);
    const keys = Object.values(report.objects).filter(
      (item) => item.cluster === cluster && item.kind === 'key' && item.cell
    );
    const columns = spec.arrangement.columns || [],
      rows = spec.arrangement.rows || [];
    const matrix = report.clusters[cluster].matrix;
    const axis = [matrix[0], matrix[4]];
    const persist = (
      path: SourcePath,
      delta: number[],
      affected: ResolvedObject[]
    ) => {
      const blocked =
        affected.some((item) => item.locked) ||
        spec.locked ||
        Object.values(data.layout.constraints || {}).some((rule) =>
          rule.refs.some(
            (ref) =>
              ref.includes(`clusters.${cluster}`) ||
              affected.some(
                (item) =>
                  ref === item.id ||
                  ref === `objects.${item.id}` ||
                  ref.startsWith(`${item.id}.`) ||
                  ref.startsWith(`objects.${item.id}.`)
              )
          )
        );
      if (blocked) {
        conflicts.push(
          `Resize clearance in ${cluster} is blocked by a lock or authored constraint.`
        );
        return;
      }
      const before = getValue(result, path);
      const current = (before || [0, 0, 0]) as (number | string)[];
      const after = current.map((value, i) =>
        Math.abs(delta[i] || 0) < EPSILON
          ? value
          : typeof value === 'string'
            ? `(${value}) + ${rounded(delta[i])}`
            : rounded(value + delta[i])
      );
      const candidate = setValue(result, path, after);
      const checked = resolve(readStudio(candidate));
      if (
        Object.values(report.objects).some(
          (item) =>
            item.locked && !equal(item.matrix, checked.objects[item.id]?.matrix)
        )
      ) {
        conflicts.push(
          `Resize clearance in ${cluster} would move a locked attachment or mirror.`
        );
        return;
      }
      result = candidate;
      edits.push({ path, before, after });
      report = checked;
    };
    // Rows move in their column's axes. Attachments retain their native references.
    for (const column of columns) {
      const members = keys
        .filter((key) => key.cell![0] === column)
        .sort((a, b) => rows.indexOf(a.cell![1]) - rows.indexOf(b.cell![1]));
      for (let i = 1; i < members.length; i++) {
        const item = report.objects[members[i].id];
        const direction = [item.editMatrix[1], item.editMatrix[5]];
        const distance = Math.max(
          0,
          ...members
            .slice(0, i)
            .map((other) =>
              separation(report.objects[other.id], item, direction, spacing)
            )
        );
        if (distance < EPSILON) {
          continue;
        }
        // Each later row receives the same delta, preserving authored row offsets.
        for (const member of members.slice(i)) {
          persist(
            ['layout', 'objects', member.id, 'placement', 'override', 'at'],
            [0, distance, 0],
            [report.objects[member.id]]
          );
        }
      }
    }
    for (let i = 1; i < columns.length; i++) {
      const current = keys.filter((key) => key.cell![0] === columns[i]);
      const previous = keys.filter((key) =>
        columns.slice(0, i).includes(key.cell![0])
      );
      const distance = Math.max(
        0,
        ...current.flatMap((key) =>
          previous.map((other) =>
            separation(
              report.objects[other.id],
              report.objects[key.id],
              axis,
              spacing
            )
          )
        )
      );
      if (distance < EPSILON) {
        continue;
      }
      const affected = Object.values(report.objects).filter(
        (item) =>
          item.cluster === cluster &&
          columns.slice(i).includes(item.cell?.[0] || '')
      );
      for (const column of columns.slice(i)) {
        persist(
          ['layout', 'clusters', cluster, 'arrangement', 'offsets', column],
          [distance, 0, 0],
          affected
        );
      }
    }
    const constrained = keys.some(
      (key) =>
        !equal(
          original.objects[key.id]?.matrix,
          report.objects[key.id].matrix
        ) &&
        Object.values(data.layout.constraints || {}).some((rule) =>
          rule.refs.some(
            (ref) =>
              ref === key.id ||
              ref === `objects.${key.id}` ||
              ref.startsWith(`${key.id}.`) ||
              ref.startsWith(`objects.${key.id}.`)
          )
        )
    );
    if (constrained) {
      conflicts.push(
        `Resizing ${cluster} changes an authored constraint's anchor. Review its solved clearance before exporting.`
      );
    }
    // External objects stay in place; unresolved clearance remains an export blocker.
    for (const key of keys) {
      if (!hasSpacing(report, [key.id], [0, 0], 0, spacing)) {
        conflicts.push(
          `Keycap clearance remains unresolved in ${cluster}. Review locks, constraints and nearby keys.`
        );
        break;
      }
    }
    result = setValue(result, [...OWNERSHIP, cluster], {
      edits,
      conflicts: Array.from(new Set(conflicts)),
    });
  }
  return result;
}

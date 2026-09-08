import { DesignFeature, Vec2 } from '../types/design';
import { theme } from '../theme/theme';

export default function SketchDimensions({
  sketch,
}: {
  sketch: DesignFeature['sketch'];
}) {
  return (
    <>
      {Object.entries(sketch?.dimensions || {}).map(([id, dimension]) => {
        let from: Vec2 | undefined, to: Vec2 | undefined;
        if (dimension.type === 'distance') {
          [from, to] = (dimension.points || []).map((id) => sketch?.points[id]);
        } else if (dimension.type === 'radius') {
          const circle = sketch?.entities[dimension.geometry || ''];
          from = sketch?.points[circle?.center || ''];
          if (from) {
            to = [from[0] + dimension.actual, from[1]];
          }
        } else {
          const line = sketch?.entities[dimension.lines?.[0] || ''];
          from = sketch?.points[line?.points?.[0] || ''];
          to = from;
        }
        if (!from || !to) {
          return null;
        }
        return (
          <g key={id} aria-label={`Dimension ${id}`}>
            <line
              x1={from[0]}
              y1={-from[1]}
              x2={to[0]}
              y2={-to[1]}
              stroke={theme.colors.warning}
              strokeWidth="0.2"
              strokeDasharray="1 1"
            />
            <text
              x={(from[0] + to[0]) / 2}
              y={-(from[1] + to[1]) / 2 - 2}
              fill={theme.colors.warning}
              fontSize="2.5"
              textAnchor="middle"
            >
              {dimension.actual.toFixed(2)}
              {dimension.type === 'angle' ? '°' : ' mm'}
              <title>{id}</title>
            </text>
          </g>
        );
      })}
    </>
  );
}

/**
 * Douglas-Peucker polyline simplification.
 * Reduces the number of points in a stroke while preserving its visual shape.
 * @param points  Array of [lat, lng] pairs.
 * @param epsilon Maximum allowed perpendicular distance (in degrees) to drop a point.
 *                A value of 0.00001 (≈1 m) is a good default for freehand strokes.
 */
export function simplifyStroke(
  points: [number, number][],
  epsilon = 0.00001,
): [number, number][] {
  if (points.length <= 2) return points;

  const sqEpsilon = epsilon * epsilon;

  function sqSegDist(
    p: [number, number],
    a: [number, number],
    b: [number, number],
  ): number {
    let [ax, ay] = a;
    const [bx, by] = b;
    const [px, py] = p;
    let dx = bx - ax;
    let dy = by - ay;
    if (dx !== 0 || dy !== 0) {
      const t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
      if (t > 1) {
        // Beyond the end of the segment — snap to b
        ax = bx;
        ay = by;
      } else if (t > 0) {
        // Projection falls on the segment — move a to the closest point
        ax += dx * t;
        ay += dy * t;
      }
      // else t <= 0: before the start of the segment — keep a as-is
    }
    dx = px - ax;
    dy = py - ay;
    return dx * dx + dy * dy;
  }

  function dp(start: number, end: number, result: boolean[]): void {
    let maxSqDist = 0;
    let index = 0;
    for (let i = start + 1; i < end; i++) {
      const d = sqSegDist(points[i], points[start], points[end]);
      if (d > maxSqDist) {
        maxSqDist = d;
        index = i;
      }
    }
    if (maxSqDist > sqEpsilon) {
      result[index] = true;
      dp(start, index, result);
      dp(index, end, result);
    }
  }

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;
  dp(0, points.length - 1, keep);

  return points.filter((_, i) => keep[i]);
}

// Grid helpers: neighbors, BFS reachability, A* paths.

export const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
export const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

// BFS flood with uniform cost. passable(x,y) -> bool. Returns Map key->{x,y,d,prev}
export function reachable(sx, sy, maxSteps, passable, canStop = null) {
  const key = (x, y) => y * 100000 + x;
  const out = new Map();
  out.set(key(sx, sy), { x: sx, y: sy, d: 0, prev: null });
  let frontier = [{ x: sx, y: sy }];
  for (let step = 1; step <= maxSteps && frontier.length; step++) {
    const next = [];
    for (const p of frontier) {
      for (const [dx, dy] of DIRS) {
        const nx = p.x + dx, ny = p.y + dy, k = key(nx, ny);
        if (out.has(k) || !passable(nx, ny)) continue;
        out.set(k, { x: nx, y: ny, d: step, prev: key(p.x, p.y) });
        next.push({ x: nx, y: ny });
      }
    }
    frontier = next;
  }
  if (canStop) for (const [k, v] of out) if (!(v.x === sx && v.y === sy) && !canStop(v.x, v.y)) v.noStop = true;
  out.key = key;
  return out;
}

export function pathFromReach(reach, x, y) {
  const path = [];
  let k = reach.key(x, y), n = reach.get(k);
  while (n) { path.unshift({ x: n.x, y: n.y }); n = n.prev == null ? null : reach.get(n.prev); }
  return path;
}

// A* with cost(x,y) -> number|Infinity
export function astar(sx, sy, tx, ty, cost, W, H, maxNodes = 20000) {
  const key = (x, y) => y * W + x;
  const g = new Map(), came = new Map();
  const open = [{ x: sx, y: sy, f: 0 }];
  g.set(key(sx, sy), 0);
  let n = 0;
  while (open.length && n++ < maxNodes) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur.x === tx && cur.y === ty) {
      const path = [{ x: tx, y: ty }];
      let k = key(tx, ty);
      while (came.has(k)) { k = came.get(k); path.unshift({ x: k % W, y: Math.floor(k / W) }); }
      return path;
    }
    const cg = g.get(key(cur.x, cur.y));
    for (const [dx, dy] of DIRS) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const c = cost(nx, ny);
      if (!isFinite(c)) continue;
      const ng = cg + c, k = key(nx, ny);
      if (!g.has(k) || ng < g.get(k)) {
        g.set(k, ng); came.set(k, key(cur.x, cur.y));
        open.push({ x: nx, y: ny, f: ng + Math.abs(tx - nx) + Math.abs(ty - ny) });
      }
    }
  }
  return null;
}

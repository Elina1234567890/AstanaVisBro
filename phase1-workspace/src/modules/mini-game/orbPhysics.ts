export type Vector = { x: number; y: number };
export type Bounds = { min: Vector; max: Vector };

export interface Body {
  id: number;
  label: string;
  isStatic: boolean;
  position: Vector;
  velocity: Vector;
  angle: number;
  angularVelocity: number;
  mass: number;
  speed: number;
  restitution: number;
  frictionAir: number;
  bounds: Bounds;
  plugin: Record<string, unknown>;
  shape: "circle" | "rectangle";
  radius: number;
  width: number;
  height: number;
}

type Pair = { bodyA: Body; bodyB: Body };
export type IEventCollision<T> = { source: T; pairs: Pair[] };
type CollisionName = "collisionStart" | "collisionActive";
type Listener = (event: IEventCollision<Engine>) => void;

export interface Engine {
  gravity: Vector;
  positionIterations: number;
  velocityIterations: number;
  world: { bodies: Body[] };
  listeners: Record<CollisionName, Set<Listener>>;
  contacts: Set<string>;
}

let nextBodyID = 1;

function sync(body: Body) {
  const halfW = body.shape === "circle" ? body.radius : body.width / 2;
  const halfH = body.shape === "circle" ? body.radius : body.height / 2;
  body.bounds = {
    min: { x: body.position.x - halfW, y: body.position.y - halfH },
    max: { x: body.position.x + halfW, y: body.position.y + halfH },
  };
  body.speed = Math.hypot(body.velocity.x, body.velocity.y);
}

function makeBody(
  shape: Body["shape"],
  x: number,
  y: number,
  size: { radius?: number; width?: number; height?: number },
  options: Partial<Body> & Record<string, unknown> = {},
): Body {
  const body: Body = {
    id: nextBodyID++,
    label: options.label ?? "Body",
    isStatic: options.isStatic ?? false,
    position: { x, y },
    velocity: { x: 0, y: 0 },
    angle: 0,
    angularVelocity: 0,
    mass: options.mass ?? 1,
    speed: 0,
    restitution: options.restitution ?? 0.82,
    frictionAir: options.frictionAir ?? 0.02,
    bounds: { min: { x, y }, max: { x, y } },
    plugin: {},
    shape,
    radius: size.radius ?? 0,
    width: size.width ?? 0,
    height: size.height ?? 0,
  };
  sync(body);
  return body;
}

export const Bodies = {
  circle(x: number, y: number, radius: number, options: Partial<Body> & Record<string, unknown> = {}) {
    return makeBody("circle", x, y, { radius }, options);
  },
  rectangle(x: number, y: number, width: number, height: number, options: Partial<Body> & Record<string, unknown> = {}) {
    return makeBody("rectangle", x, y, { width, height }, options);
  },
};

export const Body = {
  setMass(body: Body, mass: number) { body.mass = Math.max(0.001, mass); },
  setStatic(body: Body, value: boolean) { body.isStatic = value; },
  setVelocity(body: Body, velocity: Vector) { body.velocity = { ...velocity }; sync(body); },
  setAngularVelocity(body: Body, velocity: number) { body.angularVelocity = velocity; },
  setPosition(body: Body, position: Vector) { body.position = { ...position }; sync(body); },
};

export const Composite = {
  add(world: Engine["world"], value: Body | Body[]) {
    for (const body of Array.isArray(value) ? value : [value]) if (!world.bodies.includes(body)) world.bodies.push(body);
  },
  remove(world: Engine["world"], body: Body) {
    const index = world.bodies.indexOf(body);
    if (index >= 0) world.bodies.splice(index, 1);
  },
};

function pairKey(a: Body, b: Body) {
  return a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
}

function circlePair(a: Body, b: Body): boolean {
  const dx = b.position.x - a.position.x;
  const dy = b.position.y - a.position.y;
  const reach = a.radius + b.radius;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared > reach * reach) return false;
  const distance = Math.sqrt(distanceSquared) || 0.001;
  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = reach - distance;
  const totalMass = a.mass + b.mass;
  a.position.x -= nx * overlap * (b.mass / totalMass);
  a.position.y -= ny * overlap * (b.mass / totalMass);
  b.position.x += nx * overlap * (a.mass / totalMass);
  b.position.y += ny * overlap * (a.mass / totalMass);
  const relative = (b.velocity.x - a.velocity.x) * nx + (b.velocity.y - a.velocity.y) * ny;
  if (relative < 0) {
    const bounce = Math.min(a.restitution, b.restitution);
    const impulse = -(1 + bounce) * relative / (1 / a.mass + 1 / b.mass);
    a.velocity.x -= impulse * nx / a.mass;
    a.velocity.y -= impulse * ny / a.mass;
    b.velocity.x += impulse * nx / b.mass;
    b.velocity.y += impulse * ny / b.mass;
  }
  const tangentX = -ny;
  const tangentY = nx;
  const slide = (b.velocity.x - a.velocity.x) * tangentX + (b.velocity.y - a.velocity.y) * tangentY;
  a.angularVelocity -= slide * 0.0008;
  b.angularVelocity += slide * 0.0008;
  sync(a); sync(b);
  return true;
}

function wallPair(circle: Body, wall: Body): boolean {
  const closestX = Math.max(wall.bounds.min.x, Math.min(circle.position.x, wall.bounds.max.x));
  const closestY = Math.max(wall.bounds.min.y, Math.min(circle.position.y, wall.bounds.max.y));
  let dx = circle.position.x - closestX;
  let dy = circle.position.y - closestY;
  const distanceSquared = dx * dx + dy * dy;
  if (distanceSquared > circle.radius * circle.radius) return false;
  let distance = Math.sqrt(distanceSquared);
  if (distance < 0.001) {
    const left = Math.abs(circle.position.x - wall.bounds.min.x);
    const right = Math.abs(wall.bounds.max.x - circle.position.x);
    const top = Math.abs(circle.position.y - wall.bounds.min.y);
    const bottom = Math.abs(wall.bounds.max.y - circle.position.y);
    const edge = Math.min(left, right, top, bottom);
    dx = edge === left ? -1 : edge === right ? 1 : 0;
    dy = edge === top ? -1 : edge === bottom ? 1 : 0;
    distance = 1;
  }
  const nx = dx / distance;
  const ny = dy / distance;
  const overlap = circle.radius - Math.sqrt(distanceSquared);
  circle.position.x += nx * Math.max(0.2, overlap);
  circle.position.y += ny * Math.max(0.2, overlap);
  const normalSpeed = circle.velocity.x * nx + circle.velocity.y * ny;
  if (normalSpeed < 0) {
    const bounce = Math.min(circle.restitution, wall.restitution);
    circle.velocity.x -= (1 + bounce) * normalSpeed * nx;
    circle.velocity.y -= (1 + bounce) * normalSpeed * ny;
  }
  sync(circle);
  return true;
}

function emit(engine: Engine, name: CollisionName, pairs: Pair[]) {
  if (!pairs.length) return;
  const event = { source: engine, pairs };
  for (const listener of engine.listeners[name]) listener(event);
}

export const Engine = {
  create(_options: Record<string, unknown> = {}): Engine {
    return {
      gravity: { x: 0, y: 0 },
      positionIterations: 6,
      velocityIterations: 4,
      world: { bodies: [] },
      listeners: { collisionStart: new Set(), collisionActive: new Set() },
      contacts: new Set(),
    };
  },
  update(engine: Engine, deltaMs: number) {
    const step = Math.max(0, Math.min(2, deltaMs / (1000 / 60)));
    for (const body of engine.world.bodies) {
      if (body.isStatic) continue;
      body.velocity.x += engine.gravity.x * 0.28 * step;
      body.velocity.y += engine.gravity.y * 0.28 * step;
      const drag = Math.pow(Math.max(0, 1 - body.frictionAir), step);
      body.velocity.x *= drag;
      body.velocity.y *= drag;
      body.position.x += body.velocity.x * step;
      body.position.y += body.velocity.y * step;
      body.angle += body.angularVelocity * step;
      body.angularVelocity *= Math.pow(0.982, step);
      if (body.speed < 0.08 && Math.abs(body.angularVelocity) < 0.012) body.angularVelocity = 0;
      sync(body);
    }
    const pairs: Pair[] = [];
    const bodies = engine.world.bodies;
    for (let i = 0; i < bodies.length; i++) {
      for (let j = i + 1; j < bodies.length; j++) {
        const a = bodies[i]!;
        const b = bodies[j]!;
        if (a.isStatic && b.isStatic) continue;
        let hit = false;
        if (a.shape === "circle" && b.shape === "circle") hit = circlePair(a, b);
        else if (a.shape === "circle" && b.shape === "rectangle") hit = wallPair(a, b);
        else if (a.shape === "rectangle" && b.shape === "circle") hit = wallPair(b, a);
        if (hit) pairs.push({ bodyA: a, bodyB: b });
      }
    }
    const current = new Set(pairs.map(({ bodyA, bodyB }) => pairKey(bodyA, bodyB)));
    emit(engine, "collisionStart", pairs.filter(({ bodyA, bodyB }) => !engine.contacts.has(pairKey(bodyA, bodyB))));
    emit(engine, "collisionActive", pairs);
    engine.contacts = current;
  },
  clear(engine: Engine) {
    engine.world.bodies.length = 0;
    engine.contacts.clear();
    engine.listeners.collisionStart.clear();
    engine.listeners.collisionActive.clear();
  },
};

export const Events = {
  on(engine: Engine, name: CollisionName, listener: Listener) { engine.listeners[name].add(listener); },
  off(engine: Engine, name: CollisionName, listener: Listener) { engine.listeners[name].delete(listener); },
};

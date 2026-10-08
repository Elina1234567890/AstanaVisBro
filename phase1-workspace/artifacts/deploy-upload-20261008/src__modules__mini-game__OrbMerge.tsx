import { Bodies, Body, Composite, Engine, Events, type IEventCollision } from "matter-js";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useIDosGamesClient } from "@idosgames/react";
import { configSection, screenBackground, useSound, v } from "@idosgames/react/ui";
import { createProgressService, type RoundResult, type Session } from "../astanavis-progress/service";
import { GameResult } from "../astanavis-progress/GameResult";
import { findMergeGroups, ORB_CONFIG, orbTier } from "./orbConfig";
import { OrbScore, mergeCause, type MergeCause } from "./orbScore";
import { wallAxisFromBounds, wallSpinVelocity, wallSpringScale, type WallAxis } from "./orbMotion";
import { pickLeaderboard, type LeaderboardSection } from "./model";
import "./orbMerge.css";

type OrbMeta = MergeCause & { id: number; tier: number; merging: boolean; impactAt: number; impactStrength: number; wallImpactAt: number; wallImpactStrength: number; wallAxis: WallAxis };
type Particle = { x: number; y: number; vx: number; vy: number; born: number; color: string };
type Popup = { x: number; y: number; text: string; born: number; color: string };
type Aim = { pointerId: number; origin: { x: number; y: number }; pointer: { x: number; y: number } };

export function OrbMerge({ navigateToHub }: { navigateToHub: () => void }): ReactNode {
  const client = useIDosGamesClient();
  const [service] = useState(() => createProgressService(client));
  const sound = useSound();
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const orbImagesRef = useRef(new Map<number, HTMLImageElement>());
  const orbsRef = useRef(new Map<number, OrbMeta>());
  const particlesRef = useRef<Particle[]>([]);
  const popupsRef = useRef<Popup[]>([]);
  const sessionRef = useRef<Session | null>(null);
  const nextTierRef = useRef(1);
  const scoreRef = useRef(0);
  const scoringRef = useRef(new OrbScore());
  const actionRef = useRef(0);
  const aimRef = useRef<Aim | null>(null);
  const shotReadyRef = useRef(true);
  const lastContactFeedbackRef = useRef(0);
  const blockedSinceRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const resolvingRef = useRef(false);
  const finishingRef = useRef(false);
  const beginningRef = useRef(false);
  const [status, setStatus] = useState<"ready" | "starting" | "playing" | "submitting" | "retry" | "result">("ready");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(() => readBest());
  const [nextTier, setNextTier] = useState(1);
  const [combo, setCombo] = useState(0);
  const [chain, setChain] = useState(0);
  const [shotReady, setShotReady] = useState(true);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<RoundResult | null>(null);
  const [shake, setShake] = useState(false);
  const [retryScore, setRetryScore] = useState<number | null>(null);

  const chooseNext = useCallback(() => {
    const choices = ORB_CONFIG.board.nextOrbTiers;
    const tier = choices[Math.floor(Math.random() * choices.length)] ?? 1;
    nextTierRef.current = tier;
    setNextTier(tier);
  }, []);

  const addOrb = useCallback((x: number, y: number, tier: number, cause: MergeCause = { actionId: actionRef.current, depth: 0 }) => {
    const engine = engineRef.current;
    if (!engine) return null;
    const config = orbTier(tier);
    const body = Bodies.circle(x, y, config.radius, {
      label: "orb-merge:orb",
      density: ORB_CONFIG.physics.density * config.mass,
      restitution: config.bounce,
      friction: ORB_CONFIG.physics.friction,
      frictionAir: ORB_CONFIG.physics.frictionAir,
      slop: ORB_CONFIG.physics.slop,
      render: { visible: false },
    });
    orbsRef.current.set(body.id, { ...cause, id: body.id, tier, merging: false, impactAt: 0, impactStrength: 0, wallImpactAt: -Infinity, wallImpactStrength: 0, wallAxis: "y" });
    Body.setMass(body, config.mass);
    const { width, height, wallThickness } = ORB_CONFIG.board;
    if (!engine.world.bodies.some((item) => item.label === "orb-merge:floor")) {
      const wallOptions = { isStatic: true, label: "orb-merge:wall", restitution: 0.9, friction: 0.012, render: { visible: false } };
      const walls = [
        Bodies.rectangle(width / 2, height + wallThickness / 2, width + wallThickness * 2, wallThickness, { ...wallOptions, label: "orb-merge:floor" }),
        Bodies.rectangle(width / 2, -wallThickness / 2, width + wallThickness * 2, wallThickness, { ...wallOptions, label: "orb-merge:ceiling" }),
        Bodies.rectangle(-wallThickness / 2, height / 2, wallThickness, height + wallThickness * 2, wallOptions),
        Bodies.rectangle(width + wallThickness / 2, height / 2, wallThickness, height + wallThickness * 2, wallOptions),
      ];
      for (const wall of walls) Body.setStatic(wall, true);
      Composite.add(engine.world, walls);
    }
    body.plugin = { bornAt: performance.now() };
    Composite.add(engine.world, body);
    return body;
  }, []);

  const startGame = useCallback(async () => {
    if (beginningRef.current || status === "starting" || status === "playing" || status === "submitting") return;
    beginningRef.current = true;
    setStatus("starting"); setError(""); setReceipt(null); setRetryScore(null);
    try {
      sessionRef.current = await service.begin("orb-merge");
      scoreRef.current = 0; setScore(0); setCombo(0); setChain(0); scoringRef.current = new OrbScore(); actionRef.current = 0;
      const engine = engineRef.current;
      if (engine) for (const body of [...engine.world.bodies]) if (!body.isStatic) Composite.remove(engine.world, body);
      orbsRef.current.clear(); particlesRef.current = []; popupsRef.current = []; finishingRef.current = false;
      aimRef.current = null; shotReadyRef.current = true; blockedSinceRef.current = null; setShotReady(true);
      runningRef.current = true; setStatus("playing"); chooseNext();
    } catch (e) {
      setError(e instanceof Error && /CloudCode.*disabled/i.test(e.message) ? "Игра временно недоступна. Попробуй позже." : "Не удалось начать игру. Попробуй ещё раз."); setStatus("ready");
    } finally {
      beginningRef.current = false;
    }
  }, [service, status, chooseNext]);

  const finishGame = useCallback(async (finalScore: number) => {
    if (finishingRef.current || !sessionRef.current) return;
    finishingRef.current = true;
    runningRef.current = false; setRetryScore(finalScore); setStatus("submitting"); setError("");
    try {
      const session = sessionRef.current;
      if (!session) { finishingRef.current = false; return; }
      const waitMs = Math.max(0, session.startedAt + session.minDurationMs - Date.now());
      if (waitMs) await new Promise<void>((resolve) => window.setTimeout(resolve, waitMs));
      const result = await service.complete({ gameId: "orb-merge", sessionId: session.sessionId, score: finalScore });
      setReceipt(result);
      sessionRef.current = null;
      setStatus("result");
      setBestScore((previous) => {
        const best = Math.max(previous, finalScore);
        saveBest(best);
        return best;
      });
      const board = pickLeaderboard(configSection<LeaderboardSection>(client, "Leaderboard"));
      if (board) {
        try {
          const submitted = await client.leaderboard.submitScore(board.LeaderboardID, result.score);
          if (!submitted.ok) setError(`Leaderboard: ${submitted.error}`);
        } catch { setError("Leaderboard unavailable. Your game result was saved."); }
      }
      void service.refreshVis().catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Связь прервалась. Повтори отправку результата.");
      setStatus("retry");
    } finally {
      finishingRef.current = false;
    }
  }, [service, client]);

  const retryResult = useCallback(() => {
    if (retryScore !== null && status === "retry") void finishGame(retryScore);
  }, [retryScore, status, finishGame]);

  useEffect(() => {
    const images = orbImagesRef.current;
    for (const tier of ORB_CONFIG.tiers) {
      const image = new Image();
      image.decoding = "async";
      image.src = tier.image;
      images.set(tier.tier, image);
      void image.decode().catch(() => undefined);
    }
    return () => { images.clear(); };
  }, []);

  useEffect(() => {
    const engine = Engine.create({ enableSleeping: true });
    engine.gravity.x = ORB_CONFIG.physics.gravityX;
    engine.gravity.y = ORB_CONFIG.physics.gravityY;
    engine.positionIterations = ORB_CONFIG.physics.positionIterations;
    engine.velocityIterations = ORB_CONFIG.physics.velocityIterations;
    engineRef.current = engine;
    let raf = 0, previous = performance.now();

    const draw = (now: number) => {
      const canvas = canvasRef.current, ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== ORB_CONFIG.board.width * dpr || canvas.height !== ORB_CONFIG.board.height * dpr) {
        canvas.width = ORB_CONFIG.board.width * dpr; canvas.height = ORB_CONFIG.board.height * dpr;
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, ORB_CONFIG.board.width, ORB_CONFIG.board.height);
      const { width, height, wallThickness } = ORB_CONFIG.board;
      ctx.fillStyle = "#111"; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = "#1b2924"; ctx.fillRect(wallThickness, wallThickness, width - wallThickness * 2, height - wallThickness * 2);
      ctx.strokeStyle = "rgba(255,255,255,.08)"; ctx.lineWidth = 1;
      ctx.strokeRect(wallThickness + 1, wallThickness + 1, width - wallThickness * 2 - 2, height - wallThickness * 2 - 2);

      const launch = runningRef.current ? findLauncherPoint(engine, orbsRef.current, nextTierRef.current) : null;
      if (runningRef.current && launch) {
        const currentAim = aimRef.current;
        if (currentAim) drawAimGuide(ctx, currentAim.origin, currentAim.pointer, orbTier(nextTierRef.current).radius);
        drawOrb(ctx, launch.x, launch.y, nextTierRef.current, orbImagesRef.current.get(nextTierRef.current), now, true);
      }
      for (const body of engine.world.bodies) {
        const meta = orbsRef.current.get(body.id);
        if (!meta) continue;
        const age = now - Number((body.plugin as { bornAt?: number }).bornAt ?? 0);
        const spring = wallSpringScale(now - meta.wallImpactAt, meta.wallImpactStrength, meta.wallAxis);
        const impactAge = now - meta.impactAt;
        const impact = impactAge < ORB_CONFIG.effects.impactFlashMs ? meta.impactStrength * (1 - impactAge / ORB_CONFIG.effects.impactFlashMs) : 0;
        drawOrb(ctx, body.position.x, body.position.y, meta.tier, orbImagesRef.current.get(meta.tier), now, false, spring, meta.merging, impact, body.angle);
        if (age < ORB_CONFIG.effects.spawnGlowMs) {
          ctx.beginPath(); ctx.arc(body.position.x, body.position.y, orbTier(meta.tier).radius + 7, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,255,255,${1 - age / ORB_CONFIG.effects.spawnGlowMs})`; ctx.lineWidth = 2; ctx.stroke();
        }
      }
      particlesRef.current = particlesRef.current.filter((p) => now - p.born < ORB_CONFIG.effects.particleLifeMs);
      for (const p of particlesRef.current) {
        const age = (now - p.born) / ORB_CONFIG.effects.particleLifeMs;
        ctx.globalAlpha = 1 - age; ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x + p.vx * age * 26, p.y + p.vy * age * 26, 2.5 * (1 - age * 0.5), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      popupsRef.current = popupsRef.current.filter((p) => now - p.born < 760);
      for (const p of popupsRef.current) {
        const age = (now - p.born) / 760; ctx.globalAlpha = 1 - age; ctx.fillStyle = p.color; ctx.font = "900 16px system-ui"; ctx.textAlign = "center"; ctx.fillText(p.text, p.x, p.y - age * 28);
      }
      ctx.globalAlpha = 1; ctx.textAlign = "start";
    };

    const trackContacts = (event: IEventCollision<Engine>) => {
      const contactAt = performance.now();
      for (const { bodyA, bodyB } of event.pairs) {
        const metaA = orbsRef.current.get(bodyA.id), metaB = orbsRef.current.get(bodyB.id);
        if ((metaA && bodyB.isStatic) || (metaB && bodyA.isStatic)) {
          const body = metaA ? bodyA : bodyB;
          const wall = metaA ? bodyB : bodyA;
          const meta = metaA ?? metaB!;
          const axis = wallAxisFromBounds(wall.bounds);
          const strength = Math.min(1, body.speed / ORB_CONFIG.board.shot.maxSpeed);
          meta.wallImpactAt = contactAt;
          meta.wallImpactStrength = Math.max(0.28, strength);
          meta.wallAxis = axis;
          Body.setAngularVelocity(body, wallSpinVelocity(axis, body.velocity, body.angularVelocity));
          continue;
        }
        if (!metaA || !metaB || metaA.merging || metaB.merging) continue;
        const relativeSpeed = Math.hypot(bodyA.velocity.x - bodyB.velocity.x, bodyA.velocity.y - bodyB.velocity.y);
        if (relativeSpeed < 0.65) continue;
        const strength = Math.min(1, relativeSpeed / ORB_CONFIG.board.shot.maxSpeed);
        metaA.impactAt = contactAt; metaA.impactStrength = strength;
        metaB.impactAt = contactAt; metaB.impactStrength = strength;
        const x = (bodyA.position.x + bodyB.position.x) / 2, y = (bodyA.position.y + bodyB.position.y) / 2;
        const count = Math.round(ORB_CONFIG.effects.contactParticles * strength);
        for (let i = 0; i < count; i++) {
          const angle = (i / Math.max(1, count)) * Math.PI * 2;
          particlesRef.current.push({ x, y, vx: Math.cos(angle) * 0.8, vy: Math.sin(angle) * 0.8, born: contactAt, color: "#fff0b5" });
        }
        if (strength > 0.25 && contactAt - lastContactFeedbackRef.current >= ORB_CONFIG.effects.contactSoundCooldownMs) {
          lastContactFeedbackRef.current = contactAt;
          soundRef.current("countTick");
          if (strength > 0.62) {
            setShake(true);
            window.setTimeout(() => setShake(false), ORB_CONFIG.effects.contactShakeMs);
            if (navigator.vibrate) navigator.vibrate(ORB_CONFIG.effects.contactVibrationMs);
          }
        }
      }
    };

    const resolveContacts = (event: IEventCollision<Engine>) => {
      if (!runningRef.current || resolvingRef.current || event.pairs.length === 0) return;
      const nodes = [...orbsRef.current.values()].filter((orb) => !orb.merging && orb.tier < ORB_CONFIG.tiers.length);
      const edges = event.pairs.map(({ bodyA, bodyB }) => ({ a: bodyA.id, b: bodyB.id }));
      // Matter can report only one pair for a contact frame. Recheck nearby same-tier
      // orbs so a barely-separated chain still joins the same connected group.
      const liveBodies = new Map(engine.world.bodies.map((body) => [body.id, body]));
      for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
        const left = liveBodies.get(nodes[i]!.id), right = liveBodies.get(nodes[j]!.id);
        if (!left || !right) continue;
        const dx = left.position.x - right.position.x, dy = left.position.y - right.position.y;
        const reach = orbTier(nodes[i]!.tier).radius + orbTier(nodes[j]!.tier).radius + ORB_CONFIG.physics.mergeContactTolerance;
        if (dx * dx + dy * dy <= reach * reach) edges.push({ a: nodes[i]!.id, b: nodes[j]!.id });
      }
      const groups = findMergeGroups(nodes, edges);
      if (!groups.length) return;
      resolvingRef.current = true;
      const engineNow = engineRef.current;
      if (!engineNow) { resolvingRef.current = false; return; }
      for (const group of groups) for (const id of group.ids) {
        const meta = orbsRef.current.get(id);
        if (meta) meta.merging = true;
      }
      const used = new Set<number>();
      for (const group of groups) {
        if (group.ids.length !== 3 || group.ids.some((id) => used.has(id))) continue;
        const members = group.ids.map((id) => ({ id, body: engineNow.world.bodies.find((b) => b.id === id), meta: orbsRef.current.get(id) }));
        if (members.some((member) => !member.body || !member.meta)) continue;
        group.ids.forEach((id) => used.add(id));
        const bodies = members.map((member) => member.body!);
        const momentum = bodies.reduce((sum, body) => ({ x: sum.x + body.mass * body.velocity.x, y: sum.y + body.mass * body.velocity.y }), { x: 0, y: 0 });
        members.forEach((member) => { member.meta!.merging = true; });
        const x = bodies.reduce((sum, body) => sum + body.position.x, 0) / 3;
        const y = bodies.reduce((sum, body) => sum + body.position.y, 0) / 3;
        const next = group.tier + 1, spec = orbTier(next);
        const cause = mergeCause(members.map(member => member.meta!), actionRef.current);
        const awarded = scoringRef.current.merge(next, cause.depth, performance.now());
        const { earned, milestone, combo: comboCount } = awarded;
        scoreRef.current = awarded.score; setScore(awarded.score); setCombo(comboCount); setChain(cause.depth);
        for (const body of bodies) { Composite.remove(engineNow.world, body); orbsRef.current.delete(body.id); }
        const safeX = Math.max(spec.radius + 2, Math.min(ORB_CONFIG.board.width - spec.radius - 2, x));
        const safeY = Math.max(spec.radius + 1, Math.min(ORB_CONFIG.board.height - spec.radius - 2, y));
        const mergedOrb = addOrb(safeX, safeY, next, cause);
        if (mergedOrb) Body.setVelocity(mergedOrb, {
          x: momentum.x / mergedOrb.mass * ORB_CONFIG.physics.mergeMomentumRetention,
          y: momentum.y / mergedOrb.mass * ORB_CONFIG.physics.mergeMomentumRetention,
        });
        if (mergedOrb) Body.setAngularVelocity(mergedOrb, bodies.reduce((sum, body) => sum + body.angularVelocity, 0) / bodies.length * ORB_CONFIG.physics.mergeMomentumRetention);
        popupsRef.current.push({ x, y, text: `+${earned}`, born: performance.now(), color: spec.color });
        if (milestone) popupsRef.current.push({ x, y: y - 26, text: `NEW TIER! +${milestone}`, born: performance.now(), color: "#fff0b5" });
        for (let i = 0; i < ORB_CONFIG.effects.particlesPerMerge; i++) particlesRef.current.push({ x, y, vx: Math.cos(i / ORB_CONFIG.effects.particlesPerMerge * Math.PI * 2), vy: Math.sin(i / ORB_CONFIG.effects.particlesPerMerge * Math.PI * 2), born: performance.now(), color: spec.color });
        soundRef.current("coin"); setShake(true); window.setTimeout(() => setShake(false), ORB_CONFIG.effects.shakeMs);
        if (navigator.vibrate) navigator.vibrate(10);
      }
      queueMicrotask(() => { resolvingRef.current = false; });
    };
    Events.on(engine, "collisionStart", trackContacts);
    Events.on(engine, "collisionStart", resolveContacts);
    Events.on(engine, "collisionActive", resolveContacts);

    const loop = (now: number) => {
      const delta = Math.min(ORB_CONFIG.physics.maxDeltaMs, now - previous); previous = now;
      if (runningRef.current) {
        Engine.update(engine, delta);
        for (const body of engine.world.bodies) {
          const meta = orbsRef.current.get(body.id);
          if (meta) keepOrbInsideBoard(body, meta.tier);
        }
        const launchAvailable = findLauncherPoint(engine, orbsRef.current, nextTierRef.current) !== null;
        const readyNow = launchAvailable;
        if (readyNow !== shotReadyRef.current) { shotReadyRef.current = readyNow; setShotReady(readyNow); }
        if (!launchAvailable) {
          blockedSinceRef.current ??= now;
          if (now - blockedSinceRef.current >= ORB_CONFIG.board.blockedHoldMs) { runningRef.current = false; void finishGame(scoreRef.current); }
        } else blockedSinceRef.current = null;
        if (!scoringRef.current.expire(now)) { setCombo(0); setChain(0); }
      }
      draw(now); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); Events.off(engine, "collisionStart", trackContacts); Events.off(engine, "collisionStart", resolveContacts); Events.off(engine, "collisionActive", resolveContacts); Engine.clear(engine); engineRef.current = null; };
  }, [addOrb, finishGame]);

  const startAim = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!runningRef.current || !engineRef.current || status !== "playing" || !shotReadyRef.current || aimRef.current) return;
    const point = pointerToBoard(event.currentTarget, event.clientX, event.clientY);
    const origin = findLauncherPoint(engineRef.current, orbsRef.current, nextTierRef.current);
    if (!origin || Math.hypot(point.x - origin.x, point.y - origin.y) > ORB_CONFIG.board.launcher.grabRadius) return;
    aimRef.current = { pointerId: event.pointerId, origin, pointer: point };
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [status]);

  const moveAim = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const aim = aimRef.current;
    if (!aim || aim.pointerId !== event.pointerId) return;
    aim.pointer = pointerToBoard(event.currentTarget, event.clientX, event.clientY);
  }, []);

  const fire = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    const aim = aimRef.current;
    if (!aim || aim.pointerId !== event.pointerId || !runningRef.current || !engineRef.current || status !== "playing") return;
    aimRef.current = null;
    aim.pointer = pointerToBoard(event.currentTarget, event.clientX, event.clientY);
    const { pull, power, direction } = shotSolution(aim.origin, aim.pointer);
    if (pull < ORB_CONFIG.board.shot.minPull) return;
    const speed = ORB_CONFIG.board.shot.minSpeed + (ORB_CONFIG.board.shot.maxSpeed - ORB_CONFIG.board.shot.minSpeed) * power;
    const tier = nextTierRef.current, radius = orbTier(tier).radius;
    actionRef.current += 1; setChain(0);
    const body = addOrb(aim.origin.x + direction.x * (radius + 2), aim.origin.y + direction.y * (radius + 2), tier);
    if (!body) return;
    Body.setVelocity(body, { x: direction.x * speed, y: direction.y * speed });
    const spinDirection = Math.abs(direction.x) > 0.04 ? Math.sign(direction.x) : (actionRef.current % 2 === 0 ? 1 : -1);
    Body.setAngularVelocity(body, spinDirection * Math.min(ORB_CONFIG.effects.maxSpin, speed * ORB_CONFIG.effects.launchSpin));
    chooseNext(); soundRef.current("countTick");
    if (navigator.vibrate) navigator.vibrate(12);
  }, [status, addOrb, chooseNext]);

  const cancelAim = useCallback((event: React.PointerEvent<HTMLCanvasElement>) => {
    if (aimRef.current?.pointerId === event.pointerId) aimRef.current = null;
  }, []);

  return (
    <div className="orb-game" style={{ background: screenBackground, color: v.text, minHeight: "100%", height: "100%", overflowY: "auto", fontFamily: v.font, boxSizing: "border-box" }}>
      <div className="orb-shell">
        <header className="orb-header">
          <div className="orb-heading"><div className="orb-kicker"><span className="orb-kicker-mark">03</span> ASTANAVIS BRO <i /> ARCADE</div><h1>ORB <em>MERGE</em></h1></div>
        </header>
        <main className="orb-content">
          <div className={`orb-board ${shake ? "orb-shake" : ""}`}>
            <canvas ref={canvasRef} width={ORB_CONFIG.board.width} height={ORB_CONFIG.board.height} aria-label="Orb Merge table. Pull the orb down and release to shoot upward." onPointerMove={moveAim} onPointerDown={startAim} onPointerUp={fire} onPointerCancel={cancelAim} style={{ display: "block", width: "100%", height: "100%", touchAction: "none", cursor: status === "playing" ? (shotReady ? "grab" : "wait") : "default" }} />
            {status !== "playing" && <div className="orb-overlay">
              {status === "ready" && <><p className="orb-overlay-kicker">PULL · AIM · SHOOT UP</p><button className="orb-action" type="button" onClick={() => void startGame()}>START GAME</button></>}
              {status === "starting" && <p>CONNECTING…</p>}
              {status === "submitting" && <p>GAME OVER · SAVING RESULT…</p>}
              {status === "retry" && <><p>RESULT NOT SAVED YET</p><p>{error}</p><button className="orb-action" type="button" onClick={retryResult}>RETRY RESULT</button></>}
            </div>}
          </div>
          <aside className="orb-sidebar">
            <div className="orb-side-label">ROUND STATUS <span className={shotReady ? "orb-status-ready" : "orb-status-moving"}>{shotReady ? "READY TO SHOOT" : "NO SPACE"}</span></div>
            <div className="orb-hud">
              <div className="orb-stat orb-stat-score"><span>SCORE</span><strong>{score.toLocaleString("ru-RU")}</strong></div>
              <div className="orb-stat orb-stat-next"><span>NEXT ORB</span><OrbBadge tier={nextTier} /></div>
              <div className="orb-stat orb-stat-combo"><span>COMBO</span><strong>{combo > 1 ? `x${combo}` : "—"}</strong></div>
            </div>
            {chain > 1 && <div className="orb-chain" role="status"><strong>CHAIN x{chain}</strong></div>}
            <div className="orb-best"><span>PERSONAL BEST</span><strong>{bestScore.toLocaleString("ru-RU")}</strong></div>
            <div className="orb-help"><div className="orb-help-icon">↑</div><div><strong>PULL DOWN. SHOOT UP.</strong><p>Потяни шар у нижнего борта вниз, наведи в сторону и отпусти. Для слияния нужны ровно три шара одного Tier.</p></div></div>
          </aside>
        </main>
        <footer className="orb-footer"><span>ASTANAVIS BRO</span><span>ONE MORE MERGE?</span></footer>
      </div>
      {status === "result" && receipt && <GameResult result={receipt} bestScore={bestScore} onAgain={() => void startGame()} onClose={navigateToHub} />}
      {error && status !== "retry" && <div role="alert" style={{ color: v.red, textAlign: "center", padding: 8 }}>{error}</div>}
    </div>
  );
}

function OrbBadge({ tier }: { tier: number }) {
  const orb = orbTier(tier);
  return <span aria-label={`Tier ${tier}`} title={`Tier ${tier}`} style={{ width: 38, height: 38, display: "grid", placeItems: "center" }}><img src={orb.image} alt="" width={38} height={38} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} /></span>;
}

function pointerToBoard(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(ORB_CONFIG.board.width, (clientX - rect.left) / rect.width * ORB_CONFIG.board.width)),
    y: Math.max(0, Math.min(ORB_CONFIG.board.height, (clientY - rect.top) / rect.height * ORB_CONFIG.board.height)),
  };
}

function findLauncherPoint(engine: Engine, metas: Map<number, OrbMeta>, tier: number) {
  const { width, height, wallThickness, launcher } = ORB_CONFIG.board;
  const radius = orbTier(tier).radius;
  const step = Math.max(launcher.laneStep, radius * 0.65);
  const y = Math.min(launcher.centerY, height - wallThickness - radius - 8);
  const maxOffset = Math.ceil((width / 2 - radius - wallThickness - 8) / step);
  const candidates: number[] = [launcher.centerX];
  for (let i = 1; i <= maxOffset; i++) candidates.push(launcher.centerX - i * step, launcher.centerX + i * step);
  const dynamic = engine.world.bodies.filter((body) => !body.isStatic && metas.has(body.id));
  for (const x of candidates) {
    if (x - radius < wallThickness || x + radius > width - wallThickness || y + radius > height - wallThickness) continue;
    const clear = dynamic.every((body) => {
      const otherRadius = orbTier(metas.get(body.id)!.tier).radius;
      return Math.hypot(x - body.position.x, y - body.position.y) >= radius + otherRadius + 7;
    });
    if (clear) return { x, y };
  }
  return null;
}

function keepOrbInsideBoard(body: Body, tier: number) {
  const radius = orbTier(tier).radius;
  const minX = radius + 1, maxX = ORB_CONFIG.board.width - radius - 1;
  const minY = radius + 1, maxY = ORB_CONFIG.board.height - radius - 1;
  const x = Math.max(minX, Math.min(maxX, body.position.x));
  const y = Math.max(minY, Math.min(maxY, body.position.y));
  if (x === body.position.x && y === body.position.y) return;
  const hitX = x !== body.position.x, hitY = y !== body.position.y;
  Body.setPosition(body, { x, y });
  Body.setVelocity(body, {
    x: hitX ? -body.velocity.x * 0.72 : body.velocity.x,
    y: hitY ? -body.velocity.y * 0.72 : body.velocity.y,
  });
}

function shotSolution(origin: { x: number; y: number }, pointer: { x: number; y: number }) {
  const pullX = origin.x - pointer.x, pullY = origin.y - pointer.y;
  const pull = Math.hypot(pullX, pullY);
  const angle = Math.max(-ORB_CONFIG.board.shot.maxAngle, Math.min(ORB_CONFIG.board.shot.maxAngle, Math.atan2(pullX, Math.max(1, -pullY))));
  const power = Math.min(1, pull / ORB_CONFIG.board.shot.maxPull);
  return { pull, power, direction: { x: Math.sin(angle), y: -Math.cos(angle) } };
}

function drawAimGuide(ctx: CanvasRenderingContext2D, origin: { x: number; y: number }, pointer: { x: number; y: number }, radius: number) {
  const { pull, power, direction } = shotSolution(origin, pointer);
  const start = { x: origin.x + direction.x * (radius + 5), y: origin.y + direction.y * (radius + 5) };
  const length = 90 + power * 240;
  const end = { x: start.x + direction.x * length, y: start.y + direction.y * length };
  ctx.save();
  ctx.lineWidth = 2; ctx.strokeStyle = `rgba(255,225,116,${0.5 + power * 0.45})`; ctx.setLineDash([7, 7]);
  ctx.beginPath(); ctx.moveTo(start.x, start.y); ctx.lineTo(end.x, end.y); ctx.stroke(); ctx.setLineDash([]);
  ctx.strokeStyle = "rgba(255,255,255,.72)"; ctx.lineWidth = Math.max(2, radius * 0.12);
  ctx.beginPath(); ctx.moveTo(origin.x - direction.x * Math.min(pull, 54), origin.y - direction.y * Math.min(pull, 54)); ctx.lineTo(origin.x - direction.x * (radius + 3), origin.y - direction.y * (radius + 3)); ctx.stroke();
  ctx.strokeStyle = "#ffe174"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(end.x, end.y, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawOrb(ctx: CanvasRenderingContext2D, x: number, y: number, tier: number, image: HTMLImageElement | undefined, now: number, ghost: boolean, spring = { x: 1, y: 1 }, merging = false, impact = 0, angle = 0) {
  const orb = orbTier(tier), pulse = ghost ? 0.68 + Math.sin(now / 180) * 0.08 : 1;
  const radius = orb.radius * pulse;
  ctx.save(); ctx.globalAlpha = ghost ? 0.64 : 1;
  ctx.translate(x, y); ctx.rotate(angle); ctx.scale(spring.x, spring.y);
  if (image?.complete && image.naturalWidth > 0) {
    const maxEdge = radius * 1.94;
    const imageScale = Math.min(maxEdge / image.naturalWidth, maxEdge / image.naturalHeight);
    const width = image.naturalWidth * imageScale, height = image.naturalHeight * imageScale;
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
  } else {
    ctx.fillStyle = orb.color; ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.lineWidth = Math.max(1.5, radius * 0.08); ctx.strokeStyle = orb.stroke; ctx.stroke();
    ctx.fillStyle = "#171717"; ctx.font = `900 ${Math.max(10, radius * 0.72)}px system-ui`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(String(tier), 0, 1);
  }
  if (merging) { ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, radius + 3, 0, Math.PI * 2); ctx.stroke(); }
  if (impact > 0) { ctx.globalAlpha = Math.min(1, impact); ctx.strokeStyle = "#fff"; ctx.lineWidth = 2 + impact * 3; ctx.beginPath(); ctx.arc(0, 0, radius + 4 + impact * 5, 0, Math.PI * 2); ctx.stroke(); }
  ctx.restore();
}

function readBest() { try { return Number(localStorage.getItem("av-orb-merge-best") ?? 0) || 0; } catch { return 0; } }
function saveBest(score: number) { try { localStorage.setItem("av-orb-merge-best", String(score)); } catch { /* best score is optional local convenience */ } }

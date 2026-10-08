import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function load(path, imports = {}) {
  const output = ts.transpileModule(fs.readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(output, { exports, require: name => imports[name] });
  return exports;
}

const { ORB_CONFIG } = load("src/modules/mini-game/orbConfig.ts");
const { wallAxisFromBounds, wallSpringScale, wallSpinVelocity } = load(
  "src/modules/mini-game/orbMotion.ts",
  { "./orbConfig": { ORB_CONFIG } },
);

const side = wallSpringScale(0, 1, "x");
assert.ok(side.x < 1 && side.y > 1, "side hit squashes horizontally");
const floor = wallSpringScale(0, 1, "y");
assert.ok(floor.y < 1 && floor.x > 1, "floor hit squashes vertically");
const overshoot = wallSpringScale(ORB_CONFIG.effects.wallSpringMs / 3, 1, "x");
assert.ok(overshoot.x > 1 && overshoot.y < 1, "spring overshoots before settling");
assert.equal(wallSpringScale(ORB_CONFIG.effects.wallSpringMs, 1, "x").x, 1);
assert.equal(wallSpringScale(ORB_CONFIG.effects.wallSpringMs, 1, "x").y, 1);
assert.equal(wallSpringScale(9999, 1, "y").x, 1);
assert.equal(wallSpringScale(9999, 1, "y").y, 1);
assert.ok(Math.abs(wallSpinVelocity("x", { x: 0, y: 100 }, 0)) <= ORB_CONFIG.effects.maxSpin);
assert.ok(Math.abs(wallSpinVelocity("y", { x: -100, y: 0 }, 0)) <= ORB_CONFIG.effects.maxSpin);
assert.equal(wallSpinVelocity("x", { x: 0, y: 0 }, 0.1), 0.1);
assert.ok(ORB_CONFIG.effects.maxSpin <= 0.12, "spin cap stays subtle");
assert.ok(ORB_CONFIG.effects.launchSpin <= 0.045, "launch spin stays subtle");
assert.ok(ORB_CONFIG.physics.wallRestitution < ORB_CONFIG.physics.restitution, "walls bounce less than moving toys");
assert.ok(ORB_CONFIG.physics.boundaryBounce <= ORB_CONFIG.physics.wallRestitution, "boundary fallback does not add bounce");
assert.equal(wallAxisFromBounds({ min: { x: 0, y: 0 }, max: { x: 200, y: 20 } }), "y");
assert.equal(wallAxisFromBounds({ min: { x: 0, y: 0 }, max: { x: 20, y: 200 } }), "x");
console.log("PASS: directional squash, overshoot, settle and capped wall spin");

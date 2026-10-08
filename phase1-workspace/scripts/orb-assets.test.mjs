import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

const source = fs.readFileSync("src/modules/mini-game/orbConfig.ts", "utf8");
const output = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exports = {};
vm.runInNewContext(output, { exports });

assert.equal(exports.ORB_CONFIG.tiers.length, 10, "all ten supplied toys have a tier");
let total = 0;
const contents = new Set();
for (let tier = 1; tier <= 10; tier += 1) {
  const definition = exports.ORB_CONFIG.tiers[tier - 1];
  assert.equal(definition.tier, tier);
  assert.equal(definition.image, `./assets/orb-merge/tier-${tier}.webp`);
  const path = `public/${definition.image.slice(2)}`;
  const data = fs.readFileSync(path);
  assert.equal(data.subarray(0, 4).toString("ascii"), "RIFF", `${path} is RIFF WebP`);
  assert.equal(data.subarray(8, 12).toString("ascii"), "WEBP", `${path} is WebP`);
  assert.ok(data.length < 64 * 1024, `${path} stays below 64 KiB`);
  contents.add(data.toString("base64"));
  total += data.length;
}
assert.equal(contents.size, 10, "tier textures are distinct");
assert.ok(total < 200 * 1024, `texture budget is below 200 KiB (actual ${total})`);
let guideTotal = 0;
for (let pose = 1; pose <= 3; pose += 1) {
  const path = `public/assets/orb-merge/guide-${pose}.webp`;
  const data = fs.readFileSync(path);
  assert.equal(data.subarray(0, 4).toString("ascii"), "RIFF", `${path} is RIFF WebP`);
  assert.equal(data.subarray(8, 12).toString("ascii"), "WEBP", `${path} is WebP`);
  assert.ok(data.length < 100 * 1024, `${path} stays below 100 KiB`);
  guideTotal += data.length;
}
assert.ok(guideTotal < 300 * 1024, `guide budget is below 300 KiB (actual ${guideTotal})`);
assert.equal(exports.orbTier(10).tier, 10);
assert.equal(exports.orbTier(11).tier, 10, "unknown higher tiers clamp to the final toy");
console.log(`PASS: 10 distinct WebP tier textures (${total} bytes) and 3 guide poses (${guideTotal} bytes)`);

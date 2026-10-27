import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

async function importFixture(name) {
  const source = readFileSync(new URL(`../src/data/demo/${name}.ts`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  });
  return import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
}
const { DEMO_MODELS } = await importFixture("transit-models");
const { buildAuthenticityPreview } = await importFixture("transit-authenticity");
const levels = new Set();
for (const [platform, models] of Object.entries(DEMO_MODELS)) {
  for (const model of models) {
    const result = buildAuthenticityPreview(platform, model, models);
    assert.deepEqual(result, buildAuthenticityPreview(platform, model, models), "stable previews, no random flashing");
    assert.equal(result.claimedModel, model);
    assert.ok(result.authenticity >= 0 && result.authenticity <= 100);
    assert.equal(result.candidates.length, 3);
    assert.equal(new Set(result.candidates.map((r) => r.model)).size, 3);
    assert.equal(result.candidates.find((r) => r.model === model).similarity, result.authenticity);
    assert.ok(result.candidates.every((r, i, all) => models.includes(r.model)
      && r.similarity >= 0 && r.similarity <= 100 && (!i || all[i - 1].similarity >= r.similarity)));
    levels.add(result.authenticity >= 90 ? "high" : result.authenticity >= 70 ? "medium" : "low");
  }
}
assert.equal(levels.size, 3, "preview high / medium / low consistency");
assert.notDeepEqual(buildAuthenticityPreview("chatgpt", DEMO_MODELS.chatgpt[0], DEMO_MODELS.chatgpt),
  buildAuthenticityPreview("chatgpt", DEMO_MODELS.chatgpt[1], DEMO_MODELS.chatgpt), "selection updates data");
console.log("PASS authenticity preview: all platforms incl. image/video, stable scores, sorted candidates, model selection and three score levels");

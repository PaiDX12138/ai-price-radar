#!/usr/bin/env node
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/transit/availability-tone.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
});
const { transitAvailabilityTone } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const cases = [
  [100, "emerald"], [99.95, "emerald"], [99, "emerald"],
  [98.999, "emerald"], [98.96, "emerald"], [97.34, "emerald"], [96.63, "emerald"], [95, "emerald"],
  [94.999, "emerald"], [90, "emerald"],
  [89.999, "amber"], [80, "amber"], [79.999, "amber"], [70, "amber"],
  [69.999, "rose"], [51.22, "rose"], [0, "rose"],
  [null, "muted"], [undefined, "muted"], [NaN, "muted"], [Infinity, "muted"], [-1, "muted"], [101, "muted"],
];
for (const [value, expected] of cases) {
  assert.equal(transitAvailabilityTone(value), expected, `availability ${value}`);
}
for (const name of ["transit-monitor", "transit-model-monitor", "transit-detail", "transit-infrastructure"]) {
  const component = readFileSync(new URL(`../src/components/transit/${name}.tsx`, import.meta.url), "utf8");
  assert.match(component, /transitAvailabilityTone\(/, `${name} must share the availability thresholds`);
  assert.doesNotMatch(component, /bandClassName=/, `${name} must use the shared TextBand palette without overrides`);
}
console.log(`PASS transit availability bands: ${cases.length} boundaries/empty states; 4 consumers share the palette`);

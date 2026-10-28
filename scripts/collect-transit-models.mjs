import { loadEnvLocal } from "./load-env-local.mjs";
import { refreshTransitModelCatalog } from "../collectors/transit/model-catalog.mjs";
loadEnvLocal();
const result = await refreshTransitModelCatalog({ force: !process.argv.includes("--due") });
console.log(JSON.stringify(result));
if (result.status === "failed") process.exitCode = 1;

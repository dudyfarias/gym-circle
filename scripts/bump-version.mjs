#!/usr/bin/env node
/**
 * Bump de versão do Gym Circle — os 3 lugares de uma vez (achado da
 * auditoria de 11/jun: bump manual em 3 arquivos = erro humano em release).
 *
 * Uso:
 *   node scripts/bump-version.mjs --build            # só CURRENT_PROJECT_VERSION +1 (TestFlight)
 *   node scripts/bump-version.mjs --marketing 1.2.0  # MARKETING_VERSION + package.json (root e web) + build +1
 *
 * Toca:
 *   - ios/App/App.xcodeproj/project.pbxproj (MARKETING_VERSION / CURRENT_PROJECT_VERSION)
 *   - package.json (root) e apps/web/package.json ("version") — só com --marketing
 *
 * NÃO toca o ios-native (GymCircleNative tem versionamento próprio até o
 * cutover da Sprint 20.8).
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const pbxprojPath = join(repoRoot, "ios/App/App.xcodeproj/project.pbxproj");

const args = process.argv.slice(2);
const buildOnly = args.includes("--build");
const marketingIdx = args.indexOf("--marketing");
const marketing = marketingIdx >= 0 ? args[marketingIdx + 1] : null;

if (!buildOnly && !marketing) {
  console.error("Uso: bump-version.mjs --build | --marketing X.Y.Z");
  process.exit(1);
}
if (marketing && !/^\d+\.\d+\.\d+$/.test(marketing)) {
  console.error(`--marketing inválido: "${marketing}" (esperado X.Y.Z)`);
  process.exit(1);
}

let pbx = readFileSync(pbxprojPath, "utf8");

const buildMatch = pbx.match(/CURRENT_PROJECT_VERSION = (\d+);/);
if (!buildMatch) {
  console.error("CURRENT_PROJECT_VERSION não encontrado no pbxproj");
  process.exit(1);
}
const nextBuild = Number(buildMatch[1]) + 1;
pbx = pbx.replaceAll(/CURRENT_PROJECT_VERSION = \d+;/g, `CURRENT_PROJECT_VERSION = ${nextBuild};`);
console.log(`CURRENT_PROJECT_VERSION: ${buildMatch[1]} → ${nextBuild}`);

if (marketing) {
  pbx = pbx.replaceAll(/MARKETING_VERSION = [\d.]+;/g, `MARKETING_VERSION = ${marketing};`);
  console.log(`MARKETING_VERSION → ${marketing}`);
  for (const rel of ["package.json", "apps/web/package.json"]) {
    const p = join(repoRoot, rel);
    const pkg = JSON.parse(readFileSync(p, "utf8"));
    const old = pkg.version;
    pkg.version = marketing;
    writeFileSync(p, JSON.stringify(pkg, null, 2) + "\n");
    console.log(`${rel}: ${old} → ${marketing}`);
  }
}

writeFileSync(pbxprojPath, pbx);
console.log("Bump concluído. Revise com `git diff` antes de commitar.");

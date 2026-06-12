#!/usr/bin/env node
/**
 * Gerador de arte de achievements via Leonardo AI (Phoenix 1.0).
 *
 * Uso:
 *   node scripts/generate-achievement-art.mjs --pilot        # 4 artes (1 por categoria)
 *   node scripts/generate-achievement-art.mjs --spec arq.json # lote custom
 *
 * A chave NUNCA vive no repo: lê LEONARDO_API_KEY do ambiente ou de
 * ~/.keys/gymcircle/leonardo.env (mesma casa do AuthKey .p8).
 * Saída: output/achievement-art/<id>.png (dir fora do deploy e sem commit —
 * a curadoria escolhe o que vira asset em apps/web/public/achievements/).
 *
 * Estilo: paridade com o Hall (Sprint 15) — award metálico 3D estilo
 * Apple Fitness sobre fundo preto, 1 por kind/tone do KIND_TONE.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const API = "https://cloud.leonardo.ai/api/rest/v1";
const PHOENIX_1 = "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(repoRoot, "output", "achievement-art");

function loadKey() {
  if (process.env.LEONARDO_API_KEY) return process.env.LEONARDO_API_KEY;
  const envPath = join(homedir(), ".keys/gymcircle/leonardo.env");
  if (existsSync(envPath)) {
    const match = readFileSync(envPath, "utf8").match(/LEONARDO_API_KEY=(.+)/);
    if (match) return match[1].trim();
  }
  console.error("LEONARDO_API_KEY não encontrada (env ou ~/.keys/gymcircle/leonardo.env)");
  process.exit(1);
}

const KEY = loadKey();
const headers = {
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};

// Estilo base — paridade com os tones do AchievementArtifact3D/KIND_TONE.
// NÃO citar marcas ("Apple Fitness" no prompt gerou logos da Apple na arte).
const STYLE =
  "premium 3D fitness award render, floating centered on pure black background, " +
  "studio lighting, glossy metallic reflections, subtle rim light, octane render, " +
  "symmetrical, ultra detailed, no text, no logos";
const NEGATIVE =
  "text, letters, words, watermark, logo, brand symbol, apple logo, fruit, " +
  "hands, person, blurry, low quality, frame, border";

const PILOT = [
  {
    id: "medal-gold",
    prompt: `round gold medal with laurel wreath engraving and orange flame emblem at center, hanging from dark ribbon with thin cyan stripe, ${STYLE}`,
  },
  {
    id: "trophy-cyan",
    prompt: `tall trophy cup in polished chrome with glowing electric cyan accents and cyan energy core, plain surface, ${STYLE}`,
  },
  {
    id: "relic-purple",
    prompt: `mystical diamond-shaped relic gem in iridescent purple crystal with floating golden ring, ${STYLE}`,
  },
  {
    id: "badge-silver",
    prompt: `hexagonal silver badge shield with embossed dumbbell emblem, brushed platinum finish, ${STYLE}`,
  },
];

async function api(path, options = {}) {
  const res = await fetch(`${API}${path}`, { headers, ...options });
  if (!res.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} → ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function generateOne(spec) {
  const body = {
    prompt: spec.prompt,
    negative_prompt: NEGATIVE,
    modelId: PHOENIX_1,
    width: 1024,
    height: 1024,
    num_images: 1,
    // Phoenix: contrast médio-alto valoriza metal sobre preto.
    contrast: 3.5,
  };
  const created = await api("/generations", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const genId = created?.sdGenerationJob?.generationId;
  if (!genId) throw new Error(`resposta sem generationId: ${JSON.stringify(created)}`);

  // Poll até COMPLETE (timeout ~120s)
  for (let i = 0; i < 40; i += 1) {
    await new Promise((r) => setTimeout(r, 3000));
    const status = await api(`/generations/${genId}`);
    const gen = status?.generations_by_pk;
    if (gen?.status === "COMPLETE") {
      const url = gen.generated_images?.[0]?.url;
      if (!url) throw new Error("COMPLETE sem URL de imagem");
      const img = await fetch(url);
      const buf = Buffer.from(await img.arrayBuffer());
      const outPath = join(outDir, `${spec.id}.png`);
      writeFileSync(outPath, buf);
      return outPath;
    }
    if (gen?.status === "FAILED") throw new Error(`geração FAILED: ${spec.id}`);
  }
  throw new Error(`timeout esperando geração: ${spec.id}`);
}

async function main() {
  const args = process.argv.slice(2);
  let specs = PILOT;
  const specIdx = args.indexOf("--spec");
  if (specIdx >= 0) {
    specs = JSON.parse(readFileSync(args[specIdx + 1], "utf8"));
  } else if (!args.includes("--pilot")) {
    console.error("Uso: --pilot | --spec arquivo.json");
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  console.log(`Gerando ${specs.length} arte(s) com Phoenix 1.0 → ${outDir}`);
  for (const spec of specs) {
    process.stdout.write(`  ${spec.id}... `);
    try {
      const path = await generateOne(spec);
      console.log(`✓ ${path}`);
    } catch (err) {
      console.log(`✗ ${err.message}`);
    }
  }
}

await main();

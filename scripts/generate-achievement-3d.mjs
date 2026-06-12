#!/usr/bin/env node
/**
 * Pipeline 3D de achievements — 100% via API do Leonardo:
 *   1. imagem base (Phoenix 1.0)  →  2. remoção de fundo (nobg)
 *   3. upload init image          →  4. Rodin V2 (mesh GLB + PBR)
 *
 * Uso:
 *   node scripts/generate-achievement-3d.mjs --id founder --prompt "..."
 *   node scripts/generate-achievement-3d.mjs --id popstar --image caminho/arte-nobg.png
 *     (--image pula as etapas 1-2 e usa um PNG já recortado)
 *
 * Chave: LEONARDO_API_KEY do ambiente ou ~/.keys/gymcircle/leonardo.env
 * (nunca no repo). Saída: output/achievement-art/<id>.glb (gitignored).
 * Custo: imagem ~11 tokens; Rodin V2 medium ~US$0,60 por mesh (cobrado à parte).
 *
 * GLB → interação no app: web via <model-viewer> (girar/zoom);
 * iOS converte pra USDZ (QuickLook/RealityKit) na fase nativa.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const V1 = "https://cloud.leonardo.ai/api/rest/v1";
const V2 = "https://cloud.leonardo.ai/api/rest/v2";
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
const H = { authorization: `Bearer ${KEY}`, accept: "application/json" };
const JH = { ...H, "content-type": "application/json" };

async function api(base, path, options = {}) {
  const res = await fetch(`${base}${path}`, { headers: options.body ? JH : H, ...options });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${options.method ?? "GET"} ${path} → ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function download(url, outPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`download ${res.status}: ${url}`);
  writeFileSync(outPath, Buffer.from(await res.arrayBuffer()));
  return outPath;
}

// 1) Imagem base com Phoenix (mesma família de estilo do pilot 2D)
async function generateBaseImage(id, prompt) {
  const body = {
    prompt,
    negative_prompt:
      "text, letters, words, watermark, logo, brand symbol, apple logo, fruit, " +
      "hands, person, blurry, low quality, frame, border",
    modelId: PHOENIX_1,
    width: 1024,
    height: 1024,
    num_images: 1,
    contrast: 3.5,
  };
  const created = await api(V1, "/generations", { method: "POST", body: JSON.stringify(body) });
  const genId = created?.sdGenerationJob?.generationId;
  if (!genId) throw new Error(`sem generationId: ${JSON.stringify(created)}`);
  for (let i = 0; i < 40; i += 1) {
    await sleep(3000);
    const st = await api(V1, `/generations/${genId}`);
    const gen = st?.generations_by_pk;
    if (gen?.status === "COMPLETE") {
      const img = gen.generated_images?.[0];
      if (!img?.url) throw new Error("COMPLETE sem imagem");
      await download(img.url, join(outDir, `${id}-base.png`));
      console.log(`  imagem base ✓ (${img.id})`);
      return img;
    }
    if (gen?.status === "FAILED") throw new Error("imagem base FAILED");
  }
  throw new Error("timeout imagem base");
}

// 2) Remoção de fundo (variation nobg)
async function removeBackground(id, generatedImageId) {
  const created = await api(V1, "/variations/nobg", {
    method: "POST",
    body: JSON.stringify({ id: generatedImageId, isVariation: false }),
  });
  const jobId = created?.sdNobgJob?.id;
  if (!jobId) throw new Error(`sem nobg job: ${JSON.stringify(created)}`);
  for (let i = 0; i < 40; i += 1) {
    await sleep(3000);
    const st = await api(V1, `/variations/${jobId}`);
    const v = st?.generated_image_variation_generic?.[0];
    if (v?.status === "COMPLETE" && v?.url) {
      const out = join(outDir, `${id}-nobg.png`);
      await download(v.url, out);
      console.log("  fundo removido ✓");
      return out;
    }
    if (v?.status === "FAILED") throw new Error("nobg FAILED");
  }
  throw new Error("timeout nobg");
}

// 3) Upload do PNG transparente como init image
async function uploadInitImage(pngPath) {
  const created = await api(V1, "/init-image", {
    method: "POST",
    body: JSON.stringify({ extension: "png" }),
  });
  const up = created?.uploadInitImage;
  if (!up) throw new Error(`init-image falhou: ${JSON.stringify(created)}`);
  const form = new FormData();
  for (const [k, v] of Object.entries(JSON.parse(up.fields))) form.append(k, v);
  form.append("file", new Blob([readFileSync(pngPath)], { type: "image/png" }), "ref.png");
  const res = await fetch(up.url, { method: "POST", body: form });
  if (!res.ok && res.status !== 204) throw new Error(`S3 upload ${res.status}`);
  console.log(`  init image ✓ (${up.id})`);
  return up.id;
}

// 4) Rodin V2 → GLB
async function generateMesh(id, initImageId) {
  const created = await api(V2, "/generations", {
    method: "POST",
    body: JSON.stringify({
      model: "rodin-v2",
      public: false,
      parameters: {
        quantity: 1,
        output_format: "glb",
        mesh_mode: "Quad",
        quality: "medium",
        material: "PBR",
        use_original_alpha: true,
        guidances: {
          image_reference: [{ image: { id: initImageId, type: "UPLOADED" }, strength: "HIGH" }],
        },
      },
    }),
  });
  const genId = created?.generate?.generationId;
  const cost = created?.generate?.cost;
  if (!genId) throw new Error(`rodin sem generationId: ${JSON.stringify(created)}`);
  console.log(`  rodin submetido ✓ (${genId}, custo ${cost?.amount} ${cost?.unit})`);

  // status reportado pelo endpoint v1 (o v2 não tem GET por id)
  for (let i = 0; i < 180; i += 1) {
    await sleep(5000);
    const st = await api(V1, `/generations/${genId}`);
    const gen = st?.generations_by_pk ?? st;
    const status = String(gen?.status ?? "").toUpperCase();
    if (i % 6 === 0) console.log(`  poll ${i}: ${status}`);
    if (status === "COMPLETE" || status === "COMPLETED") {
      const flat = JSON.stringify(gen);
      const m = flat.match(/https:[^"]+\.glb[^"]*/);
      if (!m) throw new Error(`COMPLETE sem URL .glb: ${flat.slice(0, 800)}`);
      const url = m[0].replace(/\\u0026/g, "&");
      const out = join(outDir, `${id}.glb`);
      await download(url, out);
      console.log(`  GLB ✓ ${out}`);
      return out;
    }
    if (status === "FAILED" || status === "DECLINED") {
      throw new Error(`rodin FAILED: ${JSON.stringify(gen).slice(0, 800)}`);
    }
  }
  throw new Error("timeout rodin");
}

async function main() {
  const args = process.argv.slice(2);
  const get = (flag) => {
    const i = args.indexOf(flag);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const id = get("--id");
  const prompt = get("--prompt");
  const image = get("--image");
  if (!id || (!prompt && !image)) {
    console.error("Uso: --id <slug> (--prompt \"...\" | --image arte-nobg.png)");
    process.exit(1);
  }

  mkdirSync(outDir, { recursive: true });
  console.log(`[${id}] pipeline 3D Leonardo`);

  let nobgPath = image;
  if (!nobgPath) {
    const baseImg = await generateBaseImage(id, prompt);
    nobgPath = await removeBackground(id, baseImg.id);
  }
  const initId = await uploadInitImage(nobgPath);
  await generateMesh(id, initId);
  console.log(`[${id}] concluído`);
}

await main();

#!/usr/bin/env node
/**
 * Patch ios/App/App/Info.plist com:
 *   - Descrições de permissão em PT-BR (Apple Guideline 5.1.1)
 *   - Export compliance pra encryption (ITSAppUsesNonExemptEncryption)
 *
 * O encryption flag ITSAppUsesNonExemptEncryption=false declara que o
 * app só usa encryption padrão (HTTPS/TLS). Sem ele, App Store Connect
 * pede pra preencher um formulário de export compliance a CADA release.
 *
 * Por que script ao invés de manual no Xcode?
 * - Manualmente é fácil esquecer alguma string e o app é rejeitado.
 * - Apple lê literalmente: "Required reason API: NSCameraUsageDescription
 *   has no usage string" rejeita imediatamente.
 * - Texto vago tipo "to use camera" também é rejeitado. Tem que falar
 *   por que VOCÊ está pedindo, não que tipo de tecnologia é.
 *
 * Idempotente: se a chave já existe, troca o texto pra última versão.
 * Se não existe, insere antes de </dict>.
 *
 * Roda automaticamente no `npm run cap:sync`. Se ios/ não existir
 * (ainda não rodou `npx cap add ios`), só avisa e sai com 0.
 */

import { readFile, writeFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const INFO_PLIST = resolve(REPO_ROOT, "ios/App/App/Info.plist");

/**
 * Texto exato que a Apple vai mostrar ao usuário no diálogo de permissão.
 * Bem específico e em PT-BR — Apple rejeita texto genérico.
 *
 * Cada permissão deve dizer:
 *   1. O que o app faz com aquilo, em ação
 *   2. Por que o user se beneficia, não o app
 */
const PERMISSIONS = {
  NSCameraUsageDescription:
    "O Gym Circle usa a câmera para você publicar fotos e vídeos do seu treino na hora que tá rolando.",
  NSPhotoLibraryUsageDescription:
    "Para você selecionar fotos e vídeos do treino diretamente da galeria quando publicar no feed ou nos stories.",
  NSPhotoLibraryAddUsageDescription:
    "Para salvar a foto ou vídeo do seu treino na galeria depois que publicar.",
  NSMicrophoneUsageDescription:
    "Necessária para gravar o áudio dos vídeos do seu treino, igual nos stories e posts em vídeo.",
  NSLocationWhenInUseUsageDescription:
    "Para mostrar onde foi o treino e descobrir gente que treina na sua região. Você sempre escolhe se vai compartilhar a localização.",
  NSUserNotificationsUsageDescription:
    "Para te avisar quando alguém curtir, comentar ou seguir você no Gym Circle.",
};

/**
 * Insere ou substitui um par <key>/<string> dentro de um Info.plist.
 * Plist é XML com formato bem previsível — regex serve aqui.
 */
function upsertKey(plist, key, value) {
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Procura por "<key>NomeDaKey</key>\s*<string>...qualquer coisa...</string>"
  const existing = new RegExp(
    `<key>${key}</key>\\s*<string>[^<]*</string>`,
    "g",
  );
  if (existing.test(plist)) {
    return plist.replace(
      existing,
      `<key>${key}</key>\n\t<string>${escaped}</string>`,
    );
  }

  // Não existe → injetar antes do </dict> do nó raiz.
  // Pega o ÚLTIMO </dict> seguido de </plist> para garantir que é o root.
  return plist.replace(
    /(\s*)<\/dict>(\s*<\/plist>)/,
    `$1\t<key>${key}</key>\n\t<string>${escaped}</string>\n</dict>$2`,
  );
}

/**
 * Insere ou substitui uma chave booleana (<true/> ou <false/>).
 * Usado pra ITSAppUsesNonExemptEncryption — não tem <string>.
 */
function upsertBoolKey(plist, key, value) {
  const tag = value ? "<true/>" : "<false/>";
  const existing = new RegExp(
    `<key>${key}</key>\\s*<(?:true|false)\\s*/?>`,
    "g",
  );
  if (existing.test(plist)) {
    return plist.replace(existing, `<key>${key}</key>\n\t${tag}`);
  }
  return plist.replace(
    /(\s*)<\/dict>(\s*<\/plist>)/,
    `$1\t<key>${key}</key>\n\t${tag}\n</dict>$2`,
  );
}

async function fileExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await fileExists(INFO_PLIST))) {
    console.log(
      `[patch-ios-permissions] ios/App/App/Info.plist não existe ainda — pule este passo até rodar 'npx cap add ios'.`,
    );
    process.exit(0);
  }

  let plist = await readFile(INFO_PLIST, "utf8");

  for (const [key, value] of Object.entries(PERMISSIONS)) {
    plist = upsertKey(plist, key, value);
  }

  // Export compliance — declarar que só usamos encryption padrão (TLS).
  // Sem isso, App Store Connect pede formulário a cada release.
  plist = upsertBoolKey(plist, "ITSAppUsesNonExemptEncryption", false);

  await writeFile(INFO_PLIST, plist, "utf8");
  console.log(
    `[patch-ios-permissions] ${Object.keys(PERMISSIONS).length} chaves de permissão + ITSAppUsesNonExemptEncryption atualizadas em ${INFO_PLIST}`,
  );
}

main().catch((err) => {
  console.error("[patch-ios-permissions] erro:", err);
  process.exit(1);
});

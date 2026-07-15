// Mantido isolado do handler Deno para permitir testes unitários no Vitest.
export function cleanUsername(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^@/, "")
    .replace(/[^a-z0-9_.]/g, "");
}

export function escapeIlikeLiteral(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "./migrations/20260716133638_places_p0_5_privacy_and_provenance.sql",
  import.meta.url,
);

describe("Places P0.5 migration contract", () => {
  it("makes user_gyms owner-only and exposes a limited profile RPC", async () => {
    const sql = await readFile(migrationUrl, "utf8");

    expect(sql).toContain('drop policy if exists "user_gyms_select_all"');
    expect(sql).toContain("revoke select on public.user_gyms from anon");
    expect(sql).toContain('create policy "user_gyms_select_self"');
    expect(sql).toContain("using ((select auth.uid()) = user_id)");
    expect(sql).toContain("create or replace function public.get_visible_profile_gym");
    expect(sql).toContain("create or replace view public.visible_profile_main_gyms");
    expect(sql).toContain("with (security_invoker = true)");
    expect(sql).not.toMatch(/get_visible_profile_gym[\s\S]*preferred_(days|times)/);
  });

  it("keeps external refs private and only auto-matches a provider external ID", async () => {
    const sql = await readFile(migrationUrl, "utf8");

    expect(sql).toContain("create table if not exists public.gym_place_external_refs");
    expect(sql).toContain("unique (provider, external_id)");
    expect(sql).toContain(
      "revoke all on public.gym_place_external_refs from public, anon, authenticated",
    );
    expect(sql).toContain("external_gym_requires_manual_review");
    expect(sql).not.toContain("raw_provider_payload");
  });
});

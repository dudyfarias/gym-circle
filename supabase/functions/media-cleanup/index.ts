import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const CLEANUP_BUCKETS = ["posts", "stories", "chat-media"] as const;
const MIN_AGE_HOURS = 24;
const MAX_DELETE_PER_RUN = 500;
const PAGE_SIZE = 1_000;
const USER_FOLDER_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\//i;

type CleanupBody = {
  dryRun?: boolean;
  force?: boolean;
  scheduled?: boolean;
  olderThanHours?: number;
};

type StorageFile = {
  bucket: string;
  path: string;
  createdAt: string | null;
  size: number;
};

function json(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function safePath(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function referencedObjectKey(value: unknown) {
  if (typeof value !== "string" || value.length === 0) return null;
  for (const bucket of CLEANUP_BUCKETS) {
    for (const marker of [
      `/storage/v1/object/public/${bucket}/`,
      `/storage/v1/object/sign/${bucket}/`,
      `/storage/v1/object/authenticated/${bucket}/`,
    ]) {
      const index = value.indexOf(marker);
      if (index >= 0) {
        return `${bucket}/${safePath(value.slice(index + marker.length).split("?")[0])}`;
      }
    }
  }
  return null;
}

async function rowsForTable(
  client: ReturnType<typeof createClient>,
  table: string,
  columns: string,
) {
  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as Record<string, unknown>[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return rows;
}

async function referencedMediaKeys(
  client: ReturnType<typeof createClient>,
) {
  const queries: Array<[string, string]> = [
    ["posts", "image_url,thumbnail_url,poster_url"],
    ["post_media", "image_url,thumbnail_url,poster_url"],
    ["stories", "media_url,thumbnail_url,poster_url"],
    [
      "direct_messages",
      "media_url,thumbnail_url,poster_url,story_preview_url",
    ],
    ["conversations", "image_url"],
  ];
  const pages = await Promise.all(
    queries.map(([table, columns]) => rowsForTable(client, table, columns)),
  );
  const references = new Set<string>();
  for (const rows of pages) {
    for (const row of rows) {
      for (const value of Object.values(row)) {
        const key = referencedObjectKey(value);
        if (key) references.add(key);
      }
    }
  }
  return references;
}

async function listBucketFiles(
  client: ReturnType<typeof createClient>,
  bucket: string,
) {
  const files: StorageFile[] = [];

  async function walk(prefix: string, depth: number) {
    if (depth > 4) return;
    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await client.storage.from(bucket).list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) throw error;
      const page = data ?? [];
      for (const item of page) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id) {
          files.push({
            bucket,
            path,
            createdAt: item.created_at ?? null,
            size:
              typeof item.metadata?.size === "number"
                ? item.metadata.size
                : 0,
          });
        } else if (item.name !== ".emptyFolderPlaceholder") {
          await walk(path, depth + 1);
        }
      }
      if (page.length < PAGE_SIZE) break;
    }
  }

  await walk("", 0);
  return files;
}

async function parseBody(req: Request): Promise<CleanupBody> {
  try {
    return (await req.json()) as CleanupBody;
  } catch {
    return {};
  }
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const expectedKey = Deno.env.get("MEDIA_CLEANUP_KEY");
  const suppliedKey = req.headers.get("x-cleanup-key");
  if (!expectedKey || !suppliedKey || suppliedKey !== expectedKey) {
    return json({ error: "unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return json({ error: "missing_server_configuration" }, 500);
  }

  const body = await parseBody(req);
  const dryRun = body.dryRun === true;
  const force = body.force === true;
  const olderThanHours = Math.max(
    MIN_AGE_HOURS,
    Math.min(24 * 30, Math.floor(body.olderThanHours ?? MIN_AGE_HOURS)),
  );
  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (!force && !dryRun) {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1_000).toISOString();
    const { data: recentRun } = await client
      .from("media_cleanup_runs")
      .select("id")
      .gte("started_at", thirtyMinutesAgo)
      .in("status", ["running", "succeeded"])
      .limit(1)
      .maybeSingle();
    if (recentRun) {
      return json({ status: "skipped", reason: "recent_run" });
    }
  }

  let runId: string | null = null;
  if (!dryRun) {
    const { data, error } = await client
      .from("media_cleanup_runs")
      .insert({
        status: "running",
        metadata: {
          scheduled: body.scheduled === true,
          older_than_hours: olderThanHours,
        },
      })
      .select("id")
      .single();
    if (error) return json({ error: "run_log_failed" }, 500);
    runId = data.id;
  }

  let scannedCount = 0;
  let candidateCount = 0;
  let deletedCount = 0;
  let deletedBytes = 0;

  try {
    const [references, ...bucketFiles] = await Promise.all([
      referencedMediaKeys(client),
      ...CLEANUP_BUCKETS.map((bucket) => listBucketFiles(client, bucket)),
    ]);
    const files = bucketFiles.flat();
    scannedCount = files.length;
    const cutoff = Date.now() - olderThanHours * 60 * 60 * 1_000;
    const candidates = files
      .filter((file) => {
        const createdAt = file.createdAt
          ? new Date(file.createdAt).getTime()
          : Number.NaN;
        return (
          USER_FOLDER_PATTERN.test(file.path) &&
          Number.isFinite(createdAt) &&
          createdAt < cutoff &&
          !references.has(`${file.bucket}/${file.path}`)
        );
      })
      .sort((a, b) =>
        String(a.createdAt).localeCompare(String(b.createdAt)),
      );
    candidateCount = candidates.length;
    let selected = candidates.slice(0, MAX_DELETE_PER_RUN);

    if (!dryRun) {
      // Revalida imediatamente antes da remoção. Isso fecha a principal janela
      // de corrida: um upload antigo pode ter sido associado a um post enquanto
      // a listagem do Storage ainda estava em andamento.
      const latestReferences = await referencedMediaKeys(client);
      selected = selected.filter(
        (candidate) =>
          !latestReferences.has(`${candidate.bucket}/${candidate.path}`),
      );
      for (const bucket of CLEANUP_BUCKETS) {
        const bucketCandidates = selected.filter(
          (candidate) => candidate.bucket === bucket,
        );
        for (let index = 0; index < bucketCandidates.length; index += 100) {
          const batch = bucketCandidates.slice(index, index + 100);
          const { error } = await client.storage
            .from(bucket)
            .remove(batch.map((candidate) => candidate.path));
          if (error) throw error;
          deletedCount += batch.length;
          deletedBytes += batch.reduce(
            (total, candidate) => total + candidate.size,
            0,
          );
        }
      }

      await client
        .from("media_pipeline_events")
        .delete()
        .lt(
          "created_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1_000).toISOString(),
        );

      await client
        .from("media_cleanup_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: "succeeded",
          scanned_count: scannedCount,
          candidate_count: candidateCount,
          deleted_count: deletedCount,
          deleted_bytes: deletedBytes,
        })
        .eq("id", runId);
    }

    return json({
      status: dryRun ? "dry_run" : "succeeded",
      scannedCount,
      candidateCount,
      selectedCount: selected.length,
      deletedCount,
      deletedBytes,
      olderThanHours,
      capped: candidates.length > MAX_DELETE_PER_RUN,
    });
  } catch (error) {
    if (runId) {
      await client
        .from("media_cleanup_runs")
        .update({
          finished_at: new Date().toISOString(),
          status: "failed",
          scanned_count: scannedCount,
          candidate_count: candidateCount,
          deleted_count: deletedCount,
          deleted_bytes: deletedBytes,
          error_message:
            error instanceof Error
              ? error.message.slice(0, 500)
              : "unknown_error",
        })
        .eq("id", runId);
    }
    return json(
      {
        status: "failed",
        scannedCount,
        candidateCount,
        deletedCount,
      },
      500,
    );
  }
});

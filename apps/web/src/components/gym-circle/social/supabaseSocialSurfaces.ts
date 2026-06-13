import type { StoryRow } from "@gym-circle/core";
import type {
  DiscoveryProfileRow,
  GymCircleSupabaseClient,
  MediaMetadata,
  OptionalStorySocialTable,
  StoryTrayRow,
  StoryViewerItemRow,
  SurfacePostRow,
} from "./supabaseSocialTypes";

/**
 * Queries de "surface" do useSupabaseSocial — extraídas do hook na Sprint 21.4.
 *
 * Cada uma tenta o RPC otimizado e cai num fallback direto na tabela quando o
 * RPC não existe/falha (deploys parciais). Também os helpers de tabela social
 * OPCIONAL (story_likes/mutes/views, post_comment_likes), que podem não existir
 * ainda em ambientes atrasados — tratados como vazio em vez de erro.
 */

export function isMissingOptionalStorySocialTable(
  error: unknown,
  table: OptionalStorySocialTable,
) {
  const postgrestError = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  const haystack = [
    postgrestError.code,
    postgrestError.message,
    postgrestError.details,
    postgrestError.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return (
    postgrestError.code === "PGRST205" ||
    postgrestError.code === "42P01" ||
    (haystack.includes("schema cache") && haystack.includes(table)) ||
    haystack.includes(`public.${table}`) ||
    haystack.includes(`relation "${table}" does not exist`)
  );
}

export function optionalStorySocialRows<T>(
  response: { data: T[] | null; error: unknown },
  table: OptionalStorySocialTable,
) {
  if (!response.error) return response.data ?? [];
  if (isMissingOptionalStorySocialTable(response.error, table)) return [];
  throw response.error;
}

export function logSurfaceFallback(surface: string, error: unknown) {
  if (process.env.NEXT_PUBLIC_PERF_DEBUG === "true") {
    console.warn(`[GymCirclePerf] ${surface} RPC failed, using safe fallback`, error);
  }
}

export async function queryHomeFeedSurface(
  client: GymCircleSupabaseClient,
  limit: number,
  cursorCreatedAt: string | null = null,
): Promise<{ data: SurfacePostRow[]; error: unknown }> {
  const rpcRes = await client.rpc("get_home_feed", {
    p_cursor_created_at: cursorCreatedAt,
    p_limit: limit,
  });
  if (!rpcRes.error) {
    return { data: (rpcRes.data ?? []) as SurfacePostRow[], error: null };
  }

  logSurfaceFallback("home feed", rpcRes.error);
  const fallbackRes = await client
    .from("feed_posts")
    .select(
      [
        "id",
        "user_id",
        "image_url",
        "media_type",
        "caption",
        "gym_id",
        "workout_type",
        "workout_date",
        "created_at",
        "location_source",
        "location_name",
        "location_latitude",
        "location_longitude",
        "location_google_maps_url",
        "likes_count",
        "comments_count",
        "username",
        "display_name",
        "avatar_url",
        "author_current_streak",
        "author_best_streak",
        "author_badge_active",
      ].join(","),
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  return {
    data: (fallbackRes.data ?? []) as unknown as SurfacePostRow[],
    error: fallbackRes.error,
  };
}

export async function queryStoryTraySurface(
  client: GymCircleSupabaseClient,
  limit: number,
): Promise<{ data: StoryTrayRow[]; error: unknown }> {
  const lightweightRes = await client.rpc("get_story_tray_lightweight", {
    p_limit: limit,
  });
  if (!lightweightRes.error) {
    return { data: (lightweightRes.data ?? []) as StoryTrayRow[], error: null };
  }

  logSurfaceFallback("lightweight story tray", lightweightRes.error);
  const legacyRes = await client.rpc("get_story_tray", {
    p_limit: limit,
  });
  if (!legacyRes.error) {
    return { data: (legacyRes.data ?? []) as unknown as StoryTrayRow[], error: null };
  }

  logSurfaceFallback("story tray", legacyRes.error);
  const fallbackRes = await client
    .from("stories")
    .select("id,user_id,media_url,media_type,gym_id,workout_type,expires_at,created_at")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(limit);

  return {
    data: (fallbackRes.data ?? []) as unknown as StoryTrayRow[],
    error: fallbackRes.error,
  };
}

export async function queryStoryViewerItemsSurface(
  client: GymCircleSupabaseClient,
  authorId: string,
): Promise<{ data: StoryViewerItemRow[]; error: unknown }> {
  const rpcRes = await client.rpc("get_story_viewer_items", {
    p_author_id: authorId,
  });
  if (!rpcRes.error) {
    return { data: (rpcRes.data ?? []) as StoryViewerItemRow[], error: null };
  }

  logSurfaceFallback("story viewer items", rpcRes.error);
  const fallbackRes = await client
    .from("stories")
    .select("id,user_id,media_url,media_type,gym_id,workout_type,expires_at,created_at")
    .eq("user_id", authorId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  return {
    data: ((fallbackRes.data ?? []) as unknown as Array<StoryRow & MediaMetadata>).map((row) => ({
      story_id: row.id,
      user_id: row.user_id,
      media_url: row.media_url,
      media_type: row.media_type,
      gym_id: row.gym_id,
      workout_type: row.workout_type,
      created_at: row.created_at,
      expires_at: row.expires_at,
      thumbnail_url: row.thumbnail_url,
      poster_url: row.poster_url,
      media_width: row.media_width,
      media_height: row.media_height,
      media_duration_seconds: row.media_duration_seconds,
      blur_data_url: row.blur_data_url,
      viewer_has_liked: null,
      viewer_has_seen: null,
    })),
    error: fallbackRes.error,
  };
}

export async function queryUserSuggestionsSurface(
  client: GymCircleSupabaseClient,
  limit: number,
): Promise<{ data: DiscoveryProfileRow[]; error: unknown }> {
  const rpcRes = await client.rpc("get_user_suggestions", {
    p_current_lat: null,
    p_current_lng: null,
    p_limit: limit,
  });
  if (!rpcRes.error) {
    return { data: (rpcRes.data ?? []) as DiscoveryProfileRow[], error: null };
  }

  logSurfaceFallback("user suggestions", rpcRes.error);
  return { data: [], error: null };
}

export async function querySearchProfilesSurface(
  client: GymCircleSupabaseClient,
  query: string,
  limit: number,
): Promise<{ data: DiscoveryProfileRow[]; error: unknown }> {
  const rpcRes = await client.rpc("search_profiles", {
    p_query: query,
    p_limit: limit,
  });
  if (!rpcRes.error) {
    return { data: (rpcRes.data ?? []) as DiscoveryProfileRow[], error: null };
  }

  logSurfaceFallback("profile search", rpcRes.error);
  return { data: [], error: rpcRes.error };
}

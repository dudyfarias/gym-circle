import type { GymCircleClient } from "@gym-circle/core";
import type { SupabaseClient } from "@supabase/supabase-js";

export const TRAINER_WORKSPACE_TYPES = [
  "individual",
  "advisory",
  "studio",
] as const;

export type TrainerWorkspaceType = (typeof TRAINER_WORKSPACE_TYPES)[number];
export type TrainerWorkspaceStatus = "active" | "suspended" | "archived";
export type TrainerWorkspaceRole = "owner" | "trainer" | "assistant" | "viewer";
export type TrainerWorkspaceMemberStatus =
  | "invited"
  | "active"
  | "suspended"
  | "removed";

export type TrainerWorkspace = {
  id: string;
  owner_user_id: string;
  name: string;
  slug: string | null;
  workspace_type: TrainerWorkspaceType | "gym_partner";
  status: TrainerWorkspaceStatus;
  city: string | null;
  state: string | null;
  logo_url: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type TrainerWorkspaceMembership = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: TrainerWorkspaceRole;
  status: TrainerWorkspaceMemberStatus;
  invited_by: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
};

export type TrainerWorkspaceMember = TrainerWorkspaceMembership & {
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
};

export type TrainerWorkspaceContext = {
  workspace: TrainerWorkspace;
  membership: TrainerWorkspaceMembership;
};

export type TrainerWorkspaceDraft = {
  name: string;
  workspaceType: TrainerWorkspaceType;
  description: string;
  city: string;
  state: string;
};

const WORKSPACE_COLUMNS =
  "id,owner_user_id,name,slug,workspace_type,status,city,state,logo_url,description,created_at,updated_at";
const MEMBERSHIP_COLUMNS =
  "id,workspace_id,user_id,role,status,invited_by,joined_at,created_at,updated_at";
const CACHE_TTL_MS = 30_000;
const workspaceCache = new Map<
  string,
  { expiresAt: number; value: TrainerWorkspaceContext | null }
>();
const inflightWorkspaceRequests = new Map<
  string,
  Promise<TrainerWorkspaceContext | null>
>();

function looseClient(client: GymCircleClient): SupabaseClient {
  return client as unknown as SupabaseClient;
}

export function emptyTrainerWorkspaceDraft(
  fallbackName: string,
): TrainerWorkspaceDraft {
  return {
    name: fallbackName.trim() ? `${fallbackName.trim()} Coach` : "Meu espaço",
    workspaceType: "individual",
    description: "",
    city: "",
    state: "",
  };
}

export function trainerWorkspaceDraftFromRow(
  workspace: TrainerWorkspace,
): TrainerWorkspaceDraft {
  return {
    name: workspace.name,
    workspaceType:
      workspace.workspace_type === "gym_partner"
        ? "studio"
        : workspace.workspace_type,
    description: workspace.description ?? "",
    city: workspace.city ?? "",
    state: workspace.state ?? "",
  };
}

export function validateTrainerWorkspaceDraft(
  draft: TrainerWorkspaceDraft,
): string | null {
  const name = draft.name.trim();
  if (name.length < 2 || name.length > 100) return "name";
  if (!TRAINER_WORKSPACE_TYPES.includes(draft.workspaceType)) return "type";
  if (draft.description.trim().length > 800) return "description";
  const city = draft.city.trim();
  const state = draft.state.trim();
  if (city && (city.length < 2 || city.length > 80)) return "city";
  if (state && (state.length < 2 || state.length > 40)) return "state";
  return null;
}

export function buildTrainerWorkspaceUpdate(draft: TrainerWorkspaceDraft) {
  return {
    name: draft.name.trim(),
    description: draft.description.trim() || null,
    city: draft.city.trim() || null,
    state: draft.state.trim() || null,
  };
}

export function invalidateTrainerWorkspace(userId?: string) {
  if (userId) {
    workspaceCache.delete(userId);
    inflightWorkspaceRequests.delete(userId);
    return;
  }
  workspaceCache.clear();
  inflightWorkspaceRequests.clear();
}

export async function loadMyTrainerWorkspace(
  client: GymCircleClient,
  userId: string,
): Promise<TrainerWorkspaceContext | null> {
  const cached = workspaceCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const inflight = inflightWorkspaceRequests.get(userId);
  if (inflight) return inflight;

  const request = (async () => {
    try {
      const db = looseClient(client);
      const { data: workspaceData, error: workspaceError } = await db
        .from("trainer_workspaces")
        .select(WORKSPACE_COLUMNS)
        .neq("status", "archived")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (workspaceError) throw workspaceError;
      const workspace = workspaceData as TrainerWorkspace | null;
      if (!workspace) {
        workspaceCache.set(userId, {
          expiresAt: Date.now() + CACHE_TTL_MS,
          value: null,
        });
        return null;
      }

      const { data: membershipData, error: membershipError } = await db
        .from("trainer_workspace_members")
        .select(MEMBERSHIP_COLUMNS)
        .eq("workspace_id", workspace.id)
        .eq("user_id", userId)
        .maybeSingle();
      if (membershipError) throw membershipError;
      const membership = membershipData as TrainerWorkspaceMembership | null;
      if (!membership) throw new Error("trainer_workspace_membership_missing");

      const value = { workspace, membership };
      workspaceCache.set(userId, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        value,
      });
      return value;
    } finally {
      inflightWorkspaceRequests.delete(userId);
    }
  })();

  inflightWorkspaceRequests.set(userId, request);
  return request;
}

export async function createTrainerWorkspace(
  client: GymCircleClient,
  userId: string,
  draft: TrainerWorkspaceDraft,
): Promise<TrainerWorkspaceContext> {
  const validationError = validateTrainerWorkspaceDraft(draft);
  if (validationError) {
    throw new Error(`trainer_workspace_invalid:${validationError}`);
  }

  const db = looseClient(client);
  const { error } = await db.rpc("create_trainer_workspace", {
    p_name: draft.name.trim(),
    p_workspace_type: draft.workspaceType,
  });
  if (error) throw error;

  invalidateTrainerWorkspace(userId);
  const context = await loadMyTrainerWorkspace(client, userId);
  if (!context) throw new Error("trainer_workspace_create_missing");
  return context;
}

export async function updateTrainerWorkspace(
  client: GymCircleClient,
  userId: string,
  workspaceId: string,
  draft: TrainerWorkspaceDraft,
): Promise<TrainerWorkspaceContext> {
  const validationError = validateTrainerWorkspaceDraft(draft);
  if (validationError) {
    throw new Error(`trainer_workspace_invalid:${validationError}`);
  }

  const { error } = await looseClient(client)
    .from("trainer_workspaces")
    .update(buildTrainerWorkspaceUpdate(draft))
    .eq("id", workspaceId);
  if (error) throw error;

  invalidateTrainerWorkspace(userId);
  const context = await loadMyTrainerWorkspace(client, userId);
  if (!context) throw new Error("trainer_workspace_update_missing");
  return context;
}

export async function loadTrainerWorkspaceMembers(
  client: GymCircleClient,
  workspaceId: string,
): Promise<TrainerWorkspaceMember[]> {
  const db = looseClient(client);
  const { data: membershipData, error: membershipError } = await db
    .from("trainer_workspace_members")
    .select(MEMBERSHIP_COLUMNS)
    .eq("workspace_id", workspaceId)
    .neq("status", "removed")
    .order("created_at", { ascending: true });
  if (membershipError) throw membershipError;

  const memberships = (membershipData ?? []) as TrainerWorkspaceMembership[];
  if (memberships.length === 0) return [];

  const userIds = Array.from(new Set(memberships.map((member) => member.user_id)));
  const { data: profiles, error: profilesError } = await db
    .from("profiles")
    .select("user_id,display_name,username,avatar_url")
    .in("user_id", userIds);
  if (profilesError) throw profilesError;

  const profilesById = new Map(
    ((profiles ?? []) as Array<{
      user_id: string;
      display_name: string;
      username: string | null;
      avatar_url: string | null;
    }>).map((profile) => [profile.user_id, profile]),
  );

  return memberships.map((membership) => {
    const profile = profilesById.get(membership.user_id);
    return {
      ...membership,
      displayName: profile?.display_name ?? "Membro",
      username: profile?.username ?? null,
      avatarUrl: profile?.avatar_url ?? null,
    };
  });
}

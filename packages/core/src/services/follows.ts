import type { ProfileRow } from "../domain/types";
import type { GymCircleClient } from "./supabase";

export type FollowStatus = "none" | "pending" | "accepted";

export function followService(client: GymCircleClient) {
  return {
    /**
     * Retorna o status atual do follow (none = não tem linha,
     * pending = solicitação enviada, accepted = seguindo).
     */
    async getStatus(
      followerId: string,
      followingId: string,
    ): Promise<FollowStatus> {
      const { data, error } = await client
        .from("follows")
        .select("status")
        .match({ follower_id: followerId, following_id: followingId })
        .maybeSingle();
      if (error) throw error;
      if (!data) return "none";
      return data.status as FollowStatus;
    },

    async isFollowing(followerId: string, followingId: string): Promise<boolean> {
      const status = await this.getStatus(followerId, followingId);
      return status === "accepted";
    },

    /**
     * Sprint 11.3 — busca em lote o status de follow do `followerId` pra
     * vários alvos de uma vez. Retorna um mapa { targetId: status }.
     * IDs sem linha em `follows` ficam de fora do mapa (caller trata como
     * "none"). Usado pelo sino de notificações pra renderizar o CTA
     * follow-back correto ("Seguindo" vs "Seguir") independente do cache
     * de users — antes o actor hidratado tardiamente vinha com status
     * "none" hardcoded.
     */
    async statusesFor(
      followerId: string,
      followingIds: string[],
    ): Promise<Record<string, FollowStatus>> {
      const uniqueIds = Array.from(
        new Set(followingIds.filter((id): id is string => Boolean(id))),
      );
      if (uniqueIds.length === 0) return {};
      const { data, error } = await client
        .from("follows")
        .select("following_id, status")
        .eq("follower_id", followerId)
        .in("following_id", uniqueIds);
      if (error) throw error;
      const map: Record<string, FollowStatus> = {};
      for (const row of data ?? []) {
        const followingId = (row as { following_id?: string }).following_id;
        const status = (row as { status?: string }).status;
        if (
          followingId &&
          (status === "none" || status === "pending" || status === "accepted")
        ) {
          map[followingId] = status;
        }
      }
      return map;
    },

    /**
     * Tenta criar a relação. O trigger BEFORE INSERT decide se vira pending
     * ou accepted com base no is_private do alvo. Devolve o status final.
     */
    async follow(
      followerId: string,
      followingId: string,
    ): Promise<FollowStatus> {
      if (followerId === followingId) throw new Error("não pode seguir a si mesmo");
      const { data, error } = await client
        .from("follows")
        .insert({ follower_id: followerId, following_id: followingId })
        .select("status")
        .single();
      if (error) {
        // 23505 = unique_violation: já existe relação. Devolve o estado atual.
        if (error.code === "23505") {
          return this.getStatus(followerId, followingId);
        }
        throw error;
      }
      return (data?.status ?? "accepted") as FollowStatus;
    },

    async unfollow(followerId: string, followingId: string): Promise<void> {
      const { error } = await client
        .from("follows")
        .delete()
        .match({ follower_id: followerId, following_id: followingId });
      if (error) throw error;
    },

    /**
     * Toggle considera 3 estados:
     * - none → tenta criar (vira pending OU accepted via trigger)
     * - pending → cancela (deleta a request)
     * - accepted → unfollow (deleta)
     */
    async toggle(
      followerId: string,
      followingId: string,
    ): Promise<{ followStatus: FollowStatus }> {
      const current = await this.getStatus(followerId, followingId);
      if (current === "accepted" || current === "pending") {
        await this.unfollow(followerId, followingId);
        return { followStatus: "none" };
      }
      const next = await this.follow(followerId, followingId);
      return { followStatus: next };
    },

    /** Aceita uma solicitação pendente. Eu = alvo (following_id). */
    async acceptRequest(targetId: string, requesterId: string): Promise<void> {
      const { error } = await client
        .from("follows")
        .update({ status: "accepted" })
        .match({
          follower_id: requesterId,
          following_id: targetId,
          status: "pending",
        });
      if (error) throw error;
    },

    /** Rejeita: apaga a linha (a UI mostra como desistência). */
    async rejectRequest(targetId: string, requesterId: string): Promise<void> {
      const { error } = await client
        .from("follows")
        .delete()
        .match({
          follower_id: requesterId,
          following_id: targetId,
          status: "pending",
        });
      if (error) throw error;
    },

    async listPendingRequests(targetId: string) {
      const { data, error } = await client
        .from("follows")
        .select("follower_id, following_id, status, created_at")
        .eq("following_id", targetId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },

    async listFollowers(userId: string): Promise<ProfileRow[]> {
      const { data: edges, error } = await client
        .from("follows")
        .select("follower_id")
        .eq("following_id", userId)
        .eq("status", "accepted");
      if (error) throw error;
      const ids = (edges ?? []).map((e) => e.follower_id);
      if (ids.length === 0) return [];
      const { data, error: profErr } = await client
        .from("profiles")
        .select("*")
        .in("user_id", ids);
      if (profErr) throw profErr;
      return data ?? [];
    },

    async listFollowing(userId: string): Promise<ProfileRow[]> {
      const { data: edges, error } = await client
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId)
        .eq("status", "accepted");
      if (error) throw error;
      const ids = (edges ?? []).map((e) => e.following_id);
      if (ids.length === 0) return [];
      const { data, error: profErr } = await client
        .from("profiles")
        .select("*")
        .in("user_id", ids);
      if (profErr) throw profErr;
      return data ?? [];
    },

    /** Conta apenas relações aceitas (não inclui pending). */
    async followCounts(userId: string): Promise<{ followers: number; following: number }> {
      const [a, b] = await Promise.all([
        client
          .from("follows")
          .select("*", { head: true, count: "exact" })
          .eq("following_id", userId)
          .eq("status", "accepted"),
        client
          .from("follows")
          .select("*", { head: true, count: "exact" })
          .eq("follower_id", userId)
          .eq("status", "accepted"),
      ]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      return { followers: a.count ?? 0, following: b.count ?? 0 };
    },
  };
}

export type FollowService = ReturnType<typeof followService>;

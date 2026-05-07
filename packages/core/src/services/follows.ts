import type { ProfileRow } from "../domain/types";
import type { GymCircleClient } from "./supabase";

export function followService(client: GymCircleClient) {
  return {
    async isFollowing(followerId: string, followingId: string): Promise<boolean> {
      const { data, error } = await client
        .from("follows")
        .select("follower_id")
        .match({ follower_id: followerId, following_id: followingId })
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },

    async follow(followerId: string, followingId: string): Promise<void> {
      if (followerId === followingId) throw new Error("não pode seguir a si mesmo");
      const { error } = await client
        .from("follows")
        .insert({ follower_id: followerId, following_id: followingId });
      if (error && error.code !== "23505") throw error;
    },

    async unfollow(followerId: string, followingId: string): Promise<void> {
      const { error } = await client
        .from("follows")
        .delete()
        .match({ follower_id: followerId, following_id: followingId });
      if (error) throw error;
    },

    async toggle(followerId: string, followingId: string): Promise<{ isFollowing: boolean }> {
      const isFollowing = await this.isFollowing(followerId, followingId);
      if (isFollowing) {
        await this.unfollow(followerId, followingId);
        return { isFollowing: false };
      }
      await this.follow(followerId, followingId);
      return { isFollowing: true };
    },

    async listFollowers(userId: string): Promise<ProfileRow[]> {
      const { data: edges, error } = await client
        .from("follows")
        .select("follower_id")
        .eq("following_id", userId);
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
        .eq("follower_id", userId);
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

    async followCounts(userId: string): Promise<{ followers: number; following: number }> {
      const [a, b] = await Promise.all([
        client.from("follows").select("*", { head: true, count: "exact" }).eq("following_id", userId),
        client.from("follows").select("*", { head: true, count: "exact" }).eq("follower_id", userId),
      ]);
      if (a.error) throw a.error;
      if (b.error) throw b.error;
      return { followers: a.count ?? 0, following: b.count ?? 0 };
    },
  };
}

export type FollowService = ReturnType<typeof followService>;

import type { GymCircleClient } from "./supabase";
import { authService } from "./auth";
import { checkinService } from "./checkins";
import { followService } from "./follows";
import { gymService } from "./gyms";
import { notificationService } from "./notifications";
import { postService } from "./posts";
import { profileService } from "./profiles";
import { statsService } from "./stats";
import { storyService } from "./stories";

export * from "./supabase";
export * from "./auth";
export * from "./checkins";
export * from "./follows";
export * from "./gyms";
export * from "./notifications";
export * from "./posts";
export * from "./profiles";
export * from "./stats";
export * from "./stories";

export function createGymCircleServices(client: GymCircleClient) {
  return {
    client,
    auth: authService(client),
    profiles: profileService(client),
    posts: postService(client),
    stories: storyService(client),
    follows: followService(client),
    gyms: gymService(client),
    checkins: checkinService(client),
    stats: statsService(client),
    notifications: notificationService(client),
  };
}

export type GymCircleServices = ReturnType<typeof createGymCircleServices>;

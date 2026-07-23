import type { GymCircleClient } from "./supabase";
import { activityService } from "./activities";
import { adminService } from "./admin";
import { analyticsService } from "./analytics";
import { authService } from "./auth";
import { checkinService } from "./checkins";
import { followService } from "./follows";
import { gymService } from "./gyms";
import { healthService } from "./health";
import { notificationService } from "./notifications";
import { onboardingService } from "./onboarding";
import { messageService } from "./messages";
import { participantService } from "./participants";
import { postService } from "./posts";
import { profileService } from "./profiles";
import { pushService } from "./push";
import { runningPlanService } from "./runningPlans";
import { safetyService } from "./safety";
import { statsService } from "./stats";
import { storyService } from "./stories";
import { sportService } from "./sports";

export * from "./supabase";
export * from "./activities";
export * from "./admin";
export * from "./analytics";
export * from "./auth";
export * from "./checkins";
export * from "./follows";
export * from "./gyms";
export * from "./health";
export * from "./notifications";
export * from "./onboarding";
export * from "./messages";
export * from "./participants";
export * from "./posts";
export * from "./profiles";
export * from "./push";
export * from "./runningPlans";
export * from "./safety";
export * from "./stats";
export * from "./stories";
export * from "./sports";

export function createGymCircleServices(client: GymCircleClient) {
  return {
    client,
    activities: activityService(client),
    admin: adminService(client),
    analytics: analyticsService(client),
    auth: authService(client),
    profiles: profileService(client),
    onboarding: onboardingService(client),
    messages: messageService(client),
    participants: participantService(client),
    push: pushService(client),
    safety: safetyService(client),
    posts: postService(client),
    stories: storyService(client),
    follows: followService(client),
    gyms: gymService(client),
    health: healthService(),
    checkins: checkinService(client),
    stats: statsService(client),
    notifications: notificationService(client),
    sports: sportService(client),
    runningPlans: runningPlanService(client),
  };
}

export type GymCircleServices = ReturnType<typeof createGymCircleServices>;

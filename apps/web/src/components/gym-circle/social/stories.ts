import type { EnrichedStory, EnrichedUser, StoryGroup } from "./types";

type StoryOrderItem = {
  id: string;
  createdAt: string;
};

export function sortStoriesNewestFirst<T extends StoryOrderItem>(stories: T[]): T[] {
  return [...stories].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function getAdjacentStoryId<T extends StoryOrderItem>(
  stories: T[],
  currentStoryId: string | null,
  direction: 1 | -1,
): string | null {
  if (stories.length === 0) return null;

  const currentIndex = currentStoryId
    ? stories.findIndex((story) => story.id === currentStoryId)
    : -1;

  if (currentIndex === -1) {
    return direction > 0 ? stories[0].id : stories[stories.length - 1]?.id ?? null;
  }

  return stories[currentIndex + direction]?.id ?? null;
}

export function getStoryForUser<T extends StoryOrderItem & { userId: string }>(
  stories: T[],
  userId: string,
): T | null {
  return stories.find((story) => story.userId === userId) ?? null;
}

function canUseParticipantGroup(user: EnrichedUser, currentUserId: string) {
  return user.id === currentUserId || user.followStatus === "accepted";
}

export function groupStoriesByProfile(
  stories: EnrichedStory[],
  currentUserId: string,
): StoryGroup[] {
  const groups = new Map<string, StoryGroup>();

  const upsertGroup = (groupUser: EnrichedUser, story: EnrichedStory) => {
    const current = groups.get(groupUser.id);
    if (!current) {
      groups.set(groupUser.id, {
        id: groupUser.id,
        author: groupUser,
        stories: [story],
        viewed: story.viewed,
        latestCreatedAt: story.createdAt,
      });
      return;
    }

    if (!current.stories.some((item) => item.id === story.id)) {
      current.stories.push(story);
    }
    current.viewed = current.stories.every((item) => item.viewed);
    if (new Date(story.createdAt).getTime() > new Date(current.latestCreatedAt).getTime()) {
      current.latestCreatedAt = story.createdAt;
    }
  };

  for (const story of stories) {
    upsertGroup(story.author, story);
    for (const participant of story.acceptedParticipants ?? []) {
      if (participant.id === story.author.id) continue;
      if (!canUseParticipantGroup(participant, currentUserId)) continue;
      upsertGroup(participant, story);
    }
  }

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      stories: [...group.stories].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      ),
      viewed: group.stories.every((story) => story.viewed),
    }))
    .sort((a, b) => {
      if (a.viewed !== b.viewed) return a.viewed ? 1 : -1;
      return new Date(b.latestCreatedAt).getTime() - new Date(a.latestCreatedAt).getTime();
    });
}

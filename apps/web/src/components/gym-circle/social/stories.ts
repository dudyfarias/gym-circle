import type { EnrichedStory, EnrichedUser, StoryGroup } from "./types";

export type StoryPlaybackMode = "unseen" | "replay";

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

export function getNewestUnseenStoryId(
  groups: StoryGroup[],
  currentStoryId: string | null,
): string | null {
  const storiesById = new Map<string, EnrichedStory>();
  for (const group of groups) {
    for (const story of group.stories) {
      if (story.id === currentStoryId || story.viewed || storiesById.has(story.id)) {
        continue;
      }
      storiesById.set(story.id, story);
    }
  }

  return sortStoriesNewestFirst(Array.from(storiesById.values()))[0]?.id ?? null;
}

export function getStoryPlaybackMode(
  groups: StoryGroup[],
  requestedId: string,
): StoryPlaybackMode | null {
  const group =
    groups.find((item) => item.id === requestedId) ??
    groups.find((item) => item.stories.some((story) => story.id === requestedId)) ??
    null;

  if (!group) return null;
  return group.stories.some((story) => !story.viewed) ? "unseen" : "replay";
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
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
      viewed: group.stories.every((story) => story.viewed),
    }))
    .sort((a, b) => {
      if (a.viewed !== b.viewed) return a.viewed ? 1 : -1;
      const aOrderAt = a.stories.find((story) => !story.viewed)?.createdAt ?? a.latestCreatedAt;
      const bOrderAt = b.stories.find((story) => !story.viewed)?.createdAt ?? b.latestCreatedAt;
      return new Date(bOrderAt).getTime() - new Date(aOrderAt).getTime();
    });
}

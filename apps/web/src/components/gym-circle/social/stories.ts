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

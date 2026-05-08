type StoryLikeItem = {
  storyId: string;
  userId: string;
};

type StoryMuteItem = {
  mutedUserId: string;
};

type StoryAuthorItem = {
  userId: string;
};

export function formatStoryAge(createdAt: string, now = new Date()): string {
  const elapsedMs = Math.max(0, now.getTime() - new Date(createdAt).getTime());
  const minutes = Math.max(1, Math.floor(elapsedMs / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${Math.min(hours, 23)} h`;
}

export function hasUserLikedStory(
  likes: StoryLikeItem[],
  storyId: string,
  userId: string,
): boolean {
  return likes.some((like) => like.storyId === storyId && like.userId === userId);
}

export function countStoryLikes(likes: StoryLikeItem[], storyId: string): number {
  return likes.filter((like) => like.storyId === storyId).length;
}

export function appendStoryLikeOnce<T extends StoryLikeItem>(
  likes: T[],
  like: T,
): T[] {
  if (hasUserLikedStory(likes, like.storyId, like.userId)) return likes;
  return [...likes, like];
}

export function filterMutedStories<T extends StoryAuthorItem>(
  stories: T[],
  mutes: StoryMuteItem[],
): T[] {
  const muted = new Set(mutes.map((mute) => mute.mutedUserId));
  return stories.filter((story) => !muted.has(story.userId));
}

export function buildStoryReplyBody(body: string): string {
  return body.trim();
}

export function buildStoryShareBody(authorUsername: string): string {
  return `Compartilhou um story de @${authorUsername}`;
}

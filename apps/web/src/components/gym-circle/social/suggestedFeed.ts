export const SUGGESTED_POST_INTERVAL = 10;
export const SUGGESTED_POST_MAX_AGE_MS = 48 * 60 * 60 * 1000;
export const EMPTY_FEED_SUGGESTION_LIMIT = 6;

export type OrganicFeedItem<TPost> =
  | { kind: "post"; id: string; createdAt: string; post: TPost }
  | { kind: "checkin" | "activity"; id: string; createdAt: string };

export type SuggestedPostCandidate = {
  id: string;
  userId: string;
  createdAt: string;
};

export type ClientSuggestedPostCandidate = SuggestedPostCandidate & {
  author: {
    isPrivate: boolean;
    followStatus?: string | null;
  };
};

export type SuggestedFeedItem<TPost> = {
  kind: "suggested_post";
  id: string;
  createdAt: string;
  post: TPost;
};

export type SuggestedFeedOptions = {
  isNewUser?: boolean;
  nowMs?: number;
};

/** Immediate client-side removal after privacy/follow state changes. */
export function filterClientSuggestedFeedPosts<
  TPost extends ClientSuggestedPostCandidate,
>(posts: TPost[], currentUserId: string, nowMs = Date.now()) {
  return posts.filter((post) => {
    const ageMs = nowMs - new Date(post.createdAt).getTime();
    return (
      post.userId !== currentUserId &&
      !post.author.isPrivate &&
      post.author.followStatus !== "accepted" &&
      Number.isFinite(ageMs) &&
      ageMs >= 0 &&
      ageMs <= SUGGESTED_POST_MAX_AGE_MS
    );
  });
}

function eligibleSuggestions<TPost extends SuggestedPostCandidate>(
  organicItems: OrganicFeedItem<TPost>[],
  suggestions: TPost[],
  nowMs: number,
) {
  const organicIds = new Set(
    organicItems
      .filter((item) => item.kind === "post")
      .map((item) => item.id),
  );
  const seenAuthors = new Set<string>();
  return suggestions.filter((post) => {
    const ageMs = nowMs - new Date(post.createdAt).getTime();
    if (
      organicIds.has(post.id) ||
      !Number.isFinite(ageMs) ||
      ageMs < 0 ||
      ageMs > SUGGESTED_POST_MAX_AGE_MS ||
      seenAuthors.has(post.userId)
    ) {
      return false;
    }
    seenAuthors.add(post.userId);
    return true;
  });
}

/**
 * Instagram-like discovery cadence:
 * - new user (no followed profiles): a small public discovery feed;
 * - 1–9 recent organic posts: one suggestion after the recent block;
 * - 10+ recent organic posts: one suggestion after each 10 organic posts.
 * Check-ins and activities do not consume the post cadence.
 */
export function interleaveSuggestedFeedPosts<
  TPost extends SuggestedPostCandidate,
  TItem extends OrganicFeedItem<TPost>,
>(
  organicItems: TItem[],
  suggestions: TPost[],
  options: SuggestedFeedOptions = {},
): Array<TItem | SuggestedFeedItem<TPost>> {
  const { isNewUser = false, nowMs = Date.now() } = options;
  const eligible = eligibleSuggestions(organicItems, suggestions, nowMs);
  if (eligible.length === 0) return organicItems;

  const recentOrganicPostCount = organicItems.filter(
    (item) =>
      item.kind === "post" &&
      nowMs - new Date(item.createdAt).getTime() <=
        SUGGESTED_POST_MAX_AGE_MS,
  ).length;

  const makeSuggestedItem = (post: TPost): SuggestedFeedItem<TPost> => ({
    kind: "suggested_post",
    id: post.id,
    createdAt: post.createdAt,
    post,
  });

  if (isNewUser) {
    return [
      ...eligible.slice(0, EMPTY_FEED_SUGGESTION_LIMIT).map(makeSuggestedItem),
      ...organicItems,
    ];
  }

  if (recentOrganicPostCount < SUGGESTED_POST_INTERVAL) {
    const lastRecentPostIndex = organicItems.reduce(
      (lastIndex, item, index) =>
        item.kind === "post" &&
        nowMs - new Date(item.createdAt).getTime() <=
          SUGGESTED_POST_MAX_AGE_MS
          ? index
          : lastIndex,
      -1,
    );
    return [
      ...organicItems.slice(0, lastRecentPostIndex + 1),
      makeSuggestedItem(eligible[0]),
      ...organicItems.slice(lastRecentPostIndex + 1),
    ];
  }

  const output: Array<TItem | SuggestedFeedItem<TPost>> = [];
  let organicPostsSeen = 0;
  let suggestionIndex = 0;
  for (const item of organicItems) {
    output.push(item);
    if (item.kind !== "post") continue;
    organicPostsSeen += 1;
    if (
      organicPostsSeen % SUGGESTED_POST_INTERVAL === 0 &&
      suggestionIndex < eligible.length
    ) {
      output.push(makeSuggestedItem(eligible[suggestionIndex]));
      suggestionIndex += 1;
    }
  }
  return output;
}

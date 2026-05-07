"use client";

import { Fragment } from "react";

const MENTION_RE = /(@[a-zA-Z0-9_.]{3,32})/g;

type MentionTextProps = {
  text: string;
  resolveUser?: (username: string) => { id: string } | undefined;
  onSelectUser?: (userId: string) => void;
};

export function MentionText({ text, resolveUser, onSelectUser }: MentionTextProps) {
  const parts = text.split(MENTION_RE);
  return (
    <>
      {parts.map((part, idx) => {
        if (idx % 2 === 1) {
          const username = part.slice(1).toLowerCase();
          const target = resolveUser?.(username);
          if (target && onSelectUser) {
            return (
              <button
                className="font-black text-[var(--gc-brand)] underline-offset-4 hover:underline"
                key={idx}
                onClick={() => onSelectUser(target.id)}
                type="button"
              >
                {part}
              </button>
            );
          }
          return (
            <span className="font-black text-[var(--gc-brand)]" key={idx}>
              {part}
            </span>
          );
        }
        return <Fragment key={idx}>{part}</Fragment>;
      })}
    </>
  );
}

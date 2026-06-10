import type { ReactNode } from "react";
import Link from "next/link";
import { LegalPageBackButton } from "./LegalPageBackButton";

type LegalDocumentShellProps = {
  title: string;
  eyebrow: string;
  children: ReactNode;
};

export function LegalDocumentShell({
  title,
  eyebrow,
  children,
}: LegalDocumentShellProps) {
  return (
    <main className="min-h-[100dvh] bg-black px-6 pb-[calc(var(--gc-safe-bottom)+40px)] pt-[calc(var(--gc-safe-top)+16px)] text-white">
      <article className="mx-auto max-w-[680px]">
        <header className="sticky top-0 z-10 -mx-6 flex items-center justify-between gap-4 border-b border-white/[0.06] bg-black/86 px-6 py-3 backdrop-blur-2xl">
          <Link className="text-[13px] font-black text-[var(--gc-brand)]" href="/">
            Gym Circle
          </Link>
          <LegalPageBackButton />
        </header>

        <p className="mt-7 text-[12px] font-black uppercase tracking-[0.12em] text-white/38">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-[34px] font-black leading-tight">{title}</h1>
        {children}
      </article>
    </main>
  );
}

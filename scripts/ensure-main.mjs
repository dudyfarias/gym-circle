#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";
import { cwd, exit } from "node:process";

function git(args) {
  return execFileSync("git", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function fail(message) {
  console.error(`\n[Gym Circle guard] ${message}\n`);
  exit(1);
}

const root = git(["rev-parse", "--show-toplevel"]);
const worktree = realpathSync(root);
const currentDir = realpathSync(cwd());

if (worktree.includes("/.claude/worktrees/")) {
  fail(
    `This checkout is inside a Claude worktree (${worktree}). Use the shared repo root instead.`,
  );
}

const branch = git(["branch", "--show-current"]);
if (branch !== "main") {
  fail(`Current branch is "${branch || "(detached)"}". Switch to main before continuing.`);
}

git(["fetch", "origin", "main"]);

const local = git(["rev-parse", "main"]);
const remote = git(["rev-parse", "origin/main"]);
if (local !== remote) {
  fail("Local main is not aligned with origin/main. Run: git pull --ff-only origin main");
}

console.log(`[Gym Circle guard] OK: main at ${local.slice(0, 7)} (${currentDir})`);


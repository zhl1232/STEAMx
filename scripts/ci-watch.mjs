#!/usr/bin/env node
/**
 * Report the CI result for a pushed commit.
 *
 * The pre-push hook no longer runs the full test suite, so CI is the only gate
 * after a push. Run this after pushing (or `pnpm push`, which chains both) to
 * find out whether the run passed, and which job and step failed if it did not.
 *
 * Usage:
 *   node scripts/ci-watch.mjs                 # wait for the run on HEAD to finish
 *   node scripts/ci-watch.mjs --once          # print the current state and exit
 *   node scripts/ci-watch.mjs --sha=<sha>     # inspect another commit
 *   node scripts/ci-watch.mjs --timeout=30    # give up after N minutes (default 25)
 *
 * Auth: a token with read access to Actions, taken from GITHUB_TOKEN / GH_TOKEN
 * in the environment, from .env.local, or from `gh auth token`.
 */

import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const POLL_INTERVAL_MS = 15_000;
const RUN_APPEAR_TIMEOUT_MS = 120_000;

const args = process.argv.slice(2);
const once = args.includes("--once");

function flag(name, fallback) {
  const hit = args.find((arg) => arg.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

async function loadEnvLocal() {
  try {
    const content = await readFile(join(process.cwd(), ".env.local"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator < 0) continue;
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // Environment variables alone are fine.
  }
}

function git(...gitArgs) {
  return execFileSync("git", gitArgs, { encoding: "utf8" }).trim();
}

function resolveRepo() {
  const remote = git("remote", "get-url", flag("remote", "origin"));
  const match = remote.match(/github\.com[:/](.+?)(?:\.git)?$/);
  if (!match) throw new Error(`Cannot read owner/repo from remote: ${remote}`);
  return match[1];
}

function resolveToken() {
  const fromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (fromEnv) return fromEnv;
  try {
    return execFileSync("gh", ["auth", "token"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return null;
  }
}

function tokenHelp() {
  return [
    "No GitHub token found, so the CI result cannot be read.",
    "",
    "Pick one:",
    "  1. Create a fine-grained token (repo scope: Actions read, Metadata read) at",
    "     https://github.com/settings/personal-access-tokens/new",
    "     then add it to .env.local (gitignored):  GITHUB_TOKEN=github_pat_...",
    "  2. Or install the GitHub CLI and log in:  sudo apt install gh && gh auth login",
    "",
    "Without a token, GitHub still emails you when a workflow run fails.",
  ].join("\n");
}

async function api(token, pathname) {
  const response = await fetch(`https://api.github.com${pathname}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "steam-explore-share-ci-watch",
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error(
      `GitHub API ${response.status}: the token is invalid or lacks Actions read access.`,
    );
  }
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status} on ${pathname}`);
  }
  return response.json();
}

async function findRun(token, repo, sha) {
  const data = await api(
    token,
    `/repos/${repo}/actions/runs?head_sha=${sha}&per_page=10`,
  );
  const runs = data.workflow_runs ?? [];
  if (runs.length === 0) return null;
  return runs.reduce((latest, run) =>
    new Date(run.created_at) > new Date(latest.created_at) ? run : latest,
  );
}

async function reportFailure(token, repo, run) {
  const { jobs = [] } = await api(
    token,
    `/repos/${repo}/actions/runs/${run.id}/jobs?per_page=50`,
  );

  for (const job of jobs) {
    if (job.conclusion === "success" || job.conclusion === "skipped") continue;
    console.log(`  job "${job.name}": ${job.conclusion ?? job.status}`);
    for (const step of job.steps ?? []) {
      if (step.conclusion === "failure" || step.conclusion === "cancelled") {
        console.log(`    step ${step.number} "${step.name}": ${step.conclusion}`);
      }
    }
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  await loadEnvLocal();

  const token = resolveToken();
  if (!token) {
    console.error(tokenHelp());
    process.exitCode = 2;
    return;
  }

  const repo = resolveRepo();
  const sha = flag("sha", git("rev-parse", "HEAD"));
  const subject = git("log", "-1", "--format=%s", sha);
  const timeoutMs = Number(flag("timeout", "25")) * 60_000;
  const deadline = Date.now() + timeoutMs;

  console.log(`CI for ${repo}@${sha.slice(0, 8)} — ${subject}`);

  let run = await findRun(token, repo, sha);
  const runAppearDeadline = Date.now() + RUN_APPEAR_TIMEOUT_MS;
  while (!run && !once && Date.now() < runAppearDeadline) {
    await sleep(POLL_INTERVAL_MS);
    run = await findRun(token, repo, sha);
  }

  if (!run) {
    console.log("No workflow run exists for this commit yet.");
    process.exitCode = once ? 0 : 1;
    return;
  }

  console.log(run.html_url);

  let lastStatus = null;
  while (run.status !== "completed") {
    if (run.status !== lastStatus) {
      console.log(`status: ${run.status}`);
      lastStatus = run.status;
    }
    if (once) {
      process.exitCode = 0;
      return;
    }
    if (Date.now() > deadline) {
      console.log(`Stopped waiting after ${timeoutMs / 60_000} minutes; the run is still ${run.status}.`);
      process.exitCode = 1;
      return;
    }
    await sleep(POLL_INTERVAL_MS);
    run = (await findRun(token, repo, sha)) ?? run;
  }

  const startedAt = new Date(run.run_started_at ?? run.created_at);
  const endedAt = new Date(run.updated_at);
  const durationSec = Math.round((endedAt - startedAt) / 1000);

  process.stdout.write("\u0007");
  if (run.conclusion === "success") {
    console.log(`CI passed in ${durationSec}s.`);
    return;
  }

  console.log(`CI ${run.conclusion} after ${durationSec}s:`);
  await reportFailure(token, repo, run);
  console.log(`Logs: ${run.html_url}`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

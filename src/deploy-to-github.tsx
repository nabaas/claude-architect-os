/**
 * deploy-to-github.tsx
 * No-view Raycast command that deploys the current project to GitHub.
 * Creates the repo if it does not exist, then pushes via simple-git.
 * Shows progress via HUD messages.
 */

import { showHUD, getPreferenceValues, environment, showToast, Toast, open } from "@raycast/api";
import { Octokit } from "@octokit/rest";
import simpleGit, { SimpleGit } from "simple-git";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";

// ── Preferences ────────────────────────────────────────────────────────────

interface Preferences {
  githubToken: string;
  repoName: string;
  repoDescription: string;
  isPrivate: boolean;
  projectPath: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function resolveProjectPath(prefPath: string): string {
  if (prefPath && prefPath.trim()) {
    const expanded = prefPath.replace(/^~/, os.homedir());
    if (fs.existsSync(expanded)) return expanded;
  }

  // Fallback order: env variable → default CMNDCENTER path
  const envPath = process.env.PROJECT_DIR ?? process.env.PWD;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const defaultPath = path.join(
    os.homedir(),
    "CMNDCENTER",
    "repos",
    "claude-architect-os"
  );
  return defaultPath;
}

async function getGitHubUsername(octokit: Octokit): Promise<string> {
  const { data } = await octokit.rest.users.getAuthenticated();
  return data.login;
}

async function repoExists(
  octokit: Octokit,
  owner: string,
  repo: string
): Promise<boolean> {
  try {
    await octokit.rest.repos.get({ owner, repo });
    return true;
  } catch (err: unknown) {
    if ((err as { status?: number }).status === 404) return false;
    throw err;
  }
}

async function createRepo(
  octokit: Octokit,
  name: string,
  description: string,
  isPrivate: boolean
): Promise<{ cloneUrl: string; htmlUrl: string }> {
  const { data } = await octokit.rest.repos.createForAuthenticatedUser({
    name,
    description,
    private: isPrivate,
    auto_init: false,
  });
  return { cloneUrl: data.clone_url, htmlUrl: data.html_url };
}

async function initGitRepo(git: SimpleGit, projectPath: string): Promise<void> {
  const isRepo = await git.checkIsRepo().catch(() => false);
  if (!isRepo) {
    await git.init();
    await git.addConfig("user.email", "claude-architect@cmndcenter.local");
    await git.addConfig("user.name", "Claude Architect OS");
  }
}

async function stageAndCommit(git: SimpleGit): Promise<void> {
  const status = await git.status();

  if (
    status.not_added.length === 0 &&
    status.modified.length === 0 &&
    status.created.length === 0 &&
    status.staged.length === 0
  ) {
    // Nothing to commit
    return;
  }

  await git.add(".");
  const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
  await git.commit(`chore: deploy snapshot ${timestamp} [claude-architect-os]`);
}

async function ensureRemote(
  git: SimpleGit,
  remoteName: string,
  remoteUrl: string
): Promise<void> {
  const remotes = await git.getRemotes(true);
  const existing = remotes.find((r) => r.name === remoteName);

  if (existing) {
    if (existing.refs.push !== remoteUrl) {
      await git.remote(["set-url", remoteName, remoteUrl]);
    }
  } else {
    await git.addRemote(remoteName, remoteUrl);
  }
}

async function pushWithToken(
  git: SimpleGit,
  token: string,
  owner: string,
  repoName: string,
  branch: string
): Promise<void> {
  // Embed token in remote URL for authentication without SSH keys
  const authenticatedUrl = `https://${token}@github.com/${owner}/${repoName}.git`;
  await git.remote(["set-url", "origin", authenticatedUrl]);

  try {
    await git.push("origin", branch, ["--set-upstream"]);
  } finally {
    // Restore clean URL (no token in git config)
    const cleanUrl = `https://github.com/${owner}/${repoName}.git`;
    await git.remote(["set-url", "origin", cleanUrl]);
  }
}

// ── Main command ───────────────────────────────────────────────────────────

export default async function DeployToGitHub() {
  const prefs = getPreferenceValues<Preferences>();

  const projectPath = resolveProjectPath(prefs.projectPath);
  const repoName = prefs.repoName || "claude-architect-os";
  const repoDescription =
    prefs.repoDescription ||
    "Claude Architect OS — AI Command Center Raycast Extension";
  const isPrivate = prefs.isPrivate ?? false;

  if (!prefs.githubToken) {
    await showHUD("GitHub token not configured — add it in extension preferences");
    return;
  }

  // ── Step 1: Validate project path ────────────────────────────────────────
  await showHUD("Validating project directory...");

  if (!fs.existsSync(projectPath)) {
    await showHUD(`Project path not found: ${projectPath}`);
    return;
  }

  // ── Step 2: Set up Octokit and get user ───────────────────────────────────
  await showHUD("Connecting to GitHub...");

  let octokit: Octokit;
  let username: string;

  try {
    octokit = new Octokit({ auth: prefs.githubToken });
    username = await getGitHubUsername(octokit);
  } catch {
    await showHUD("GitHub authentication failed — check your token");
    return;
  }

  // ── Step 3: Ensure repo exists ────────────────────────────────────────────
  await showHUD(`Checking GitHub repo ${username}/${repoName}...`);

  let repoHtmlUrl: string;
  let remoteUrl: string;

  try {
    const exists = await repoExists(octokit, username, repoName);

    if (!exists) {
      await showHUD(`Creating repo ${username}/${repoName}...`);
      const created = await createRepo(octokit, repoName, repoDescription, isPrivate);
      remoteUrl = created.cloneUrl;
      repoHtmlUrl = created.htmlUrl;
    } else {
      const { data } = await octokit.rest.repos.get({
        owner: username,
        repo: repoName,
      });
      remoteUrl = data.clone_url;
      repoHtmlUrl = data.html_url;
    }
  } catch (err) {
    await showHUD(`Repo setup failed: ${(err as Error).message}`);
    return;
  }

  // ── Step 4: Init git and stage changes ────────────────────────────────────
  await showHUD("Staging changes...");

  const git: SimpleGit = simpleGit(projectPath);

  try {
    await initGitRepo(git, projectPath);
    await stageAndCommit(git);
  } catch (err) {
    await showHUD(`Git staging failed: ${(err as Error).message}`);
    return;
  }

  // ── Step 5: Set remote ────────────────────────────────────────────────────
  await showHUD("Configuring remote...");

  try {
    const cleanUrl = `https://github.com/${username}/${repoName}.git`;
    await ensureRemote(git, "origin", cleanUrl);
  } catch (err) {
    await showHUD(`Remote setup failed: ${(err as Error).message}`);
    return;
  }

  // ── Step 6: Determine default branch ─────────────────────────────────────
  await showHUD("Pushing to GitHub...");

  let branch = "main";
  try {
    const currentBranch = await git.revparse(["--abbrev-ref", "HEAD"]).catch(() => "");
    if (currentBranch && currentBranch !== "HEAD") {
      branch = currentBranch.trim();
    }
  } catch {
    branch = "main";
  }

  // ── Step 7: Push ──────────────────────────────────────────────────────────
  try {
    await pushWithToken(git, prefs.githubToken, username, repoName, branch);
  } catch (err) {
    const message = (err as Error).message;

    // Handle "nothing to push" gracefully
    if (message.includes("Everything up-to-date") || message.includes("nothing to push")) {
      await showHUD(`Already up-to-date — ${repoHtmlUrl}`);
      return;
    }

    await showHUD(`Push failed: ${message}`);
    return;
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  await showHUD(`Deployed to ${repoHtmlUrl}`);
}

import * as path from "node:path";
import * as prompts from "@clack/prompts";
import { listAllDesktopProfiles } from "../core/desktop-profiles.js";
import { listAllProfiles } from "../core/profiles.js";
import type { DesktopProfile, Profile } from "../providers/types.js";
import { run } from "../utils/shell.js";

export function abortIfCancelled<T>(value: T | symbol): T {
	if (prompts.isCancel(value)) {
		prompts.cancel("Aborted.");
		process.exit(0);
	}
	return value as T;
}

/**
 * Resolve a profile by ID, or interactively select one.
 * Exits the process on cancel or not-found.
 */
export async function selectProfile(
	profileId?: string,
	message = "Select profile",
): Promise<Profile> {
	const profiles = listAllProfiles();
	if (profiles.length === 0) {
		prompts.cancel("No profiles configured. Run: git-switch add");
		process.exit(1);
	}

	if (profileId) {
		const profile = profiles.find((p) => p.id === profileId);
		if (!profile) {
			prompts.cancel(`Profile "${profileId}" not found.`);
			process.exit(1);
		}
		return profile;
	}

	if (profiles.length === 1) {
		const profile = profiles[0] as Profile;
		const confirmed = abortIfCancelled(
			await prompts.confirm({
				message: `Use profile "${profile.label}" (${profile.git.email})?`,
			}),
		);
		if (!confirmed) {
			prompts.cancel("Aborted.");
			process.exit(0);
		}
		return profile;
	}

	const choice = abortIfCancelled(
		await prompts.select({
			message,
			options: profiles.map((p) => ({
				value: p.id,
				label: p.label,
				hint: p.git.email,
			})),
		}),
	);
	return profiles.find((p) => p.id === choice) as Profile;
}

/**
 * Resolve a desktop profile by ID, or interactively select one.
 * Exits the process on cancel or not-found.
 */
export async function selectDesktopProfile(
	id?: string,
	message = "Select Desktop profile",
): Promise<DesktopProfile> {
	const desktopProfiles = listAllDesktopProfiles();
	if (desktopProfiles.length === 0) {
		prompts.cancel("No Desktop profiles saved. Run: git-switch desktop save");
		process.exit(1);
	}

	if (id) {
		const found = desktopProfiles.find((dp) => dp.id === id);
		if (!found) {
			prompts.cancel(`Desktop profile "${id}" not found.`);
			process.exit(1);
		}
		return found;
	}

	if (desktopProfiles.length === 1) {
		const dp = desktopProfiles[0] as DesktopProfile;
		const confirmed = abortIfCancelled(
			await prompts.confirm({
				message: `Use Desktop profile "${dp.label}" (${dp.email})?`,
			}),
		);
		if (!confirmed) {
			prompts.cancel("Aborted.");
			process.exit(0);
		}
		return dp;
	}

	const choice = abortIfCancelled(
		await prompts.select({
			message,
			options: desktopProfiles.map((dp) => ({
				value: dp.id,
				label: dp.label,
				hint: dp.email,
			})),
		}),
	);
	return desktopProfiles.find((dp) => dp.id === choice) as DesktopProfile;
}

/**
 * Ensure the CWD is inside a git repository.
 * Uses a single git process to get both gitDir and repoRoot.
 * Returns { gitDir, repoRoot } or exits with an error message.
 */
export function ensureGitRepo(): { gitDir: string; repoRoot: string } {
	const result = run("git", ["rev-parse", "--git-dir", "--show-toplevel"]);
	if (result.exitCode !== 0) {
		prompts.cancel("Not inside a git repository.");
		process.exit(1);
	}

	const lines = result.stdout.split("\n");
	const rawGitDir = lines[0] ?? "";
	const repoRoot = lines[1] ?? "";
	const gitDir = path.isAbsolute(rawGitDir)
		? rawGitDir
		: path.resolve(process.cwd(), rawGitDir);

	return { gitDir, repoRoot };
}

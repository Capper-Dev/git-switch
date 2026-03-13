import * as log from "@clack/prompts";
import type { DesktopProfile } from "../../providers/types.js";
import {
	DesktopTokenExpiredError,
	GitSwitchError,
} from "../../utils/errors.js";
import {
	listAllDesktopProfiles,
	updateDesktopProfileUsersJson,
} from "../desktop-profiles.js";
import { pruneSnapshots, takeSnapshot } from "../snapshot/index.js";
import {
	fetchDesktopUsersJson,
	type GitHubUserInfo,
	readKeychainEntry,
	renameKeychainEntry,
	validateStoredToken,
} from "./keychain.js";
import { writeLocalStorageKey } from "./local-storage.js";
import { isDesktopRunning, killDesktop, launchDesktop } from "./process.js";

/**
 * Check if a users_json string contains valid (non-empty) user data.
 * Strips the LevelDB prefix byte and parses the JSON array.
 */
function hasUsersData(usersJson: string | undefined): boolean {
	if (!usersJson) return false;
	const json = usersJson.startsWith("\x01") ? usersJson.slice(1) : usersJson;
	try {
		const parsed = JSON.parse(json);
		return Array.isArray(parsed) && parsed.length > 0;
	} catch {
		return false;
	}
}

export function findActiveDesktopProfiles(): DesktopProfile[] {
	const profiles = listAllDesktopProfiles();
	return profiles.filter((dp) => readKeychainEntry(dp.keychain_label) !== null);
}

export async function switchDesktopToProfile(
	target: DesktopProfile,
): Promise<void> {
	const activeProfiles = findActiveDesktopProfiles();
	const othersActive = activeProfiles.filter((dp) => dp.id !== target.id);
	const targetAlreadyActive = activeProfiles.some((dp) => dp.id === target.id);

	const hasValidUsersData = hasUsersData(target.users_json);

	if (othersActive.length === 0 && targetAlreadyActive && hasValidUsersData) {
		log.log.info("GitHub Desktop is already using this profile.");
		return;
	}

	// Pre-flight: verify the target credential exists and token is valid
	let validatedUser: GitHubUserInfo | undefined;
	if (!targetAlreadyActive) {
		const targetEntry = readKeychainEntry(target.stored_label);
		if (!targetEntry) {
			throw new GitSwitchError(
				`Target credential not found: "${target.stored_label}"\n` +
					`Sign into this account in GitHub Desktop and re-run: git-switch desktop save`,
			);
		}

		const userInfo = await validateStoredToken(target.stored_label);
		if (userInfo === null) {
			throw new DesktopTokenExpiredError(target.id, target.label);
		}
		validatedUser = userInfo;
	}

	// Take snapshot before any changes
	takeSnapshot({
		operation: "desktop",
		profileBefore: othersActive[0]?.id,
		profileAfter: target.id,
	});

	// Park ALL other active profiles
	for (const other of othersActive) {
		renameKeychainEntry(other.keychain_label, other.stored_label, other.email);
	}

	// Activate the target if not already active
	if (!targetAlreadyActive) {
		renameKeychainEntry(
			target.stored_label,
			target.keychain_label,
			target.email,
		);
	}

	// Kill Desktop before writing to LevelDB (it holds a lock on the files)
	if (isDesktopRunning()) {
		killDesktop();
	}

	// Update LevelDB users data (Desktop 3.x)
	let usersData = target.users_json;

	// If users_json is missing or empty, fetch fresh data from GitHub API
	// Pass validatedUser to avoid a duplicate GET /user call
	if (!hasValidUsersData) {
		const freshData = await fetchDesktopUsersJson(
			target.keychain_label,
			validatedUser,
		);
		if (freshData) {
			usersData = freshData;
			// Persist so we don't need to fetch next time
			updateDesktopProfileUsersJson(target.id, freshData);
		}
	}

	if (hasUsersData(usersData)) {
		try {
			writeLocalStorageKey("users", usersData as string);
		} catch (err) {
			log.log.warn(
				`Could not update localStorage: ${err instanceof Error ? err.message : err}`,
			);
		}
	}

	// Launch GitHub Desktop
	launchDesktop();

	// Prune old desktop snapshots
	pruneSnapshots();

	log.log.success(
		`Switched GitHub Desktop to: ${target.label} (${target.email})`,
	);
}

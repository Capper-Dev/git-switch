import * as prompts from "@clack/prompts";
import {
	listGitHubCredentials,
	readKeychainEntry,
	renameKeychainEntry,
} from "../../core/desktop/keychain.js";
import { readLocalStorageKey } from "../../core/desktop/local-storage.js";
import {
	addDesktopProfile,
	getDesktopProfile,
	listAllDesktopProfiles,
} from "../../core/desktop-profiles.js";
import {
	listAllProfiles,
	updateProfileDesktopLink,
} from "../../core/profiles.js";
import type { DesktopProfile } from "../../providers/types.js";
import { abortIfCancelled } from "../../utils/prompts.js";
import {
	makeStoredLabel,
	validateEmail,
	validateProfileId,
	validateRequired,
} from "../../utils/validation.js";

async function captureCurrentSession(): Promise<DesktopProfile> {
	const id = abortIfCancelled(
		await prompts.text({
			message: "Desktop profile ID (slug, no spaces)",
			placeholder: "work-desktop",
			validate: validateProfileId,
		}),
	);

	const label = abortIfCancelled(
		await prompts.text({
			message: "Desktop profile label",
			placeholder: "Work GitHub",
			validate: validateRequired,
		}),
	);

	const email = abortIfCancelled(
		await prompts.text({
			message: "GitHub account email",
			placeholder: "user@example.com",
			validate: validateEmail,
		}),
	);

	// Detect GitHub credentials
	const credentials = listGitHubCredentials();
	let keychainLabel: string;

	if (credentials.length === 0) {
		keychainLabel = abortIfCancelled(
			await prompts.text({
				message:
					"No GitHub credentials detected. Enter the credential target/label manually:",
				placeholder: "git:https://github.com",
				validate: validateRequired,
			}),
		);
	} else if (credentials.length === 1) {
		keychainLabel = credentials[0]?.target;
		prompts.log.info(`Using credential: ${keychainLabel}`);
	} else {
		keychainLabel = abortIfCancelled(
			await prompts.select({
				message: "Select the GitHub credential to capture",
				options: credentials.map((c) => ({
					value: c.target,
					label: c.target,
					hint: c.user || undefined,
				})),
			}),
		);
	}

	const storedLabel = makeStoredLabel(id, email);

	const entry = readKeychainEntry(keychainLabel);
	if (!entry) {
		prompts.cancel(
			`Could not read credential: "${keychainLabel}"\n` +
				"Make sure GitHub Desktop is signed in with this account.",
		);
		process.exit(1);
	}

	// Capture LevelDB users data before parking
	let usersJson: string | undefined;
	try {
		const users = readLocalStorageKey("users");
		if (users) usersJson = users;
	} catch {}

	// Park the keychain entry
	const spinner = prompts.spinner();
	spinner.start("Parking keychain entry...");
	renameKeychainEntry(keychainLabel, storedLabel, email);
	spinner.stop("Keychain entry parked.");

	const profile: DesktopProfile = {
		id,
		label,
		email,
		keychain_label: keychainLabel,
		stored_label: storedLabel,
		users_json: usersJson,
	};

	addDesktopProfile(profile);
	prompts.log.success(`Desktop profile "${id}" saved.`);

	return profile;
}

export async function desktopLinkCommand(): Promise<void> {
	prompts.intro(
		"git-switch desktop link — Link Desktop profile to git-switch profile",
	);

	const gitProfiles = listAllProfiles();
	if (gitProfiles.length === 0) {
		prompts.cancel("No git-switch profiles configured. Run: git-switch add");
		process.exit(1);
	}

	// Choose source: current session or existing saved profile
	const source = abortIfCancelled(
		await prompts.select({
			message: "Link from:",
			options: [
				{
					value: "current",
					label: "Currently signed-in Desktop account",
					hint: "captures and saves the current session",
				},
				{
					value: "saved",
					label: "Existing saved Desktop profile",
				},
			],
		}),
	);

	let desktopProfileId: string;

	if (source === "current") {
		const captured = await captureCurrentSession();
		desktopProfileId = captured.id;
	} else {
		const desktopProfiles = listAllDesktopProfiles();
		if (desktopProfiles.length === 0) {
			prompts.cancel("No Desktop profiles saved. Run: git-switch desktop save");
			process.exit(1);
		}

		desktopProfileId = abortIfCancelled(
			await prompts.select({
				message: "Select Desktop profile",
				options: desktopProfiles.map((dp) => ({
					value: dp.id,
					label: dp.label,
					hint: dp.email,
				})),
			}),
		);
	}

	// Select which git-switch profile to link to
	const profileChoice = abortIfCancelled(
		await prompts.select({
			message: "Link to git-switch profile:",
			options: gitProfiles.map((p) => ({
				value: p.id,
				label: p.label,
				hint: p.git.email,
			})),
		}),
	);

	// Update the git-switch profile
	updateProfileDesktopLink(profileChoice, desktopProfileId);

	const dp = getDesktopProfile(desktopProfileId);
	const linkedProfile = gitProfiles.find((p) => p.id === profileChoice);
	if (!dp || !linkedProfile) {
		prompts.cancel("Profile not found.");
		process.exit(1);
	}
	prompts.log.success(
		`Linked "${dp.label}" (${dp.email}) → "${linkedProfile.label}" (${linkedProfile.id})`,
	);
	prompts.outro("Done!");
}

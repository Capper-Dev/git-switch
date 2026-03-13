import * as prompts from "@clack/prompts";
import {
	listGitHubCredentials,
	readKeychainEntry,
	renameKeychainEntry,
} from "../../core/desktop/keychain.js";
import { readLocalStorageKey } from "../../core/desktop/local-storage.js";
import { addDesktopProfile } from "../../core/desktop-profiles.js";
import type { DesktopProfile } from "../../providers/types.js";
import { abortIfCancelled } from "../../utils/prompts.js";
import {
	makeStoredLabel,
	validateEmail,
	validateProfileId,
	validateRequired,
} from "../../utils/validation.js";

export async function desktopSaveCommand(): Promise<void> {
	prompts.intro("git-switch desktop save — Capture current Desktop session");

	const id = abortIfCancelled(
		await prompts.text({
			message: "Desktop profile ID (slug, no spaces)",
			placeholder: "work-desktop",
			validate: validateProfileId,
		}),
	);

	const label = abortIfCancelled(
		await prompts.text({
			message: "Desktop profile label (display name)",
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

	// Detect GitHub credentials from keychain
	const spinner = prompts.spinner();
	spinner.start("Scanning keychain for GitHub credentials...");
	const credentials = listGitHubCredentials();
	spinner.stop(`Found ${credentials.length} GitHub credential(s).`);

	let keychainLabel: string;

	if (credentials.length === 0) {
		// Fall back to manual entry
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
		prompts.log.info(
			`Using credential: ${keychainLabel} (${credentials[0]?.user || "no user"})`,
		);
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

	// Verify the credential is readable
	const entry = readKeychainEntry(keychainLabel);
	if (!entry) {
		prompts.cancel(
			`Could not read credential: "${keychainLabel}"\n` +
				"Make sure GitHub Desktop is signed in with this account.",
		);
		process.exit(1);
	}

	// Capture LevelDB users data (Desktop 3.x stores account info here)
	let usersJson: string | undefined;
	try {
		const users = readLocalStorageKey("users");
		if (users) usersJson = users;
	} catch {
		prompts.log.warn("Could not read GitHub Desktop localStorage (LevelDB)");
	}

	// Park the keychain entry
	const parkSpinner = prompts.spinner();
	parkSpinner.start("Parking keychain entry...");
	renameKeychainEntry(keychainLabel, storedLabel, email);
	parkSpinner.stop("Keychain entry parked.");

	// Save desktop profile
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
	prompts.log.info(
		"GitHub Desktop is now signed out. Run `git-switch desktop switch " +
			id +
			"` to switch back.",
	);
	prompts.outro("Done!");
}

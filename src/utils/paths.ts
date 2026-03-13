import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

export function resolveHome(filepath: string): string {
	if (filepath.startsWith("~/") || filepath === "~") {
		return path.join(os.homedir(), filepath.slice(2));
	}
	return filepath;
}

export function configDir(): string {
	return path.join(os.homedir(), ".config", "git-switch");
}

export function snapshotsDir(): string {
	return path.join(configDir(), "snapshots");
}

export function sshDir(): string {
	return path.join(os.homedir(), ".ssh");
}

export function sshConfigPath(): string {
	return path.join(sshDir(), "config");
}

export function sshPublicKeyPath(alias: string): string {
	return path.join(sshDir(), `git-switch-${alias}.pub`);
}

export function ensureDir(dir: string): void {
	fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

export function repoHash(repoPath: string): string {
	return crypto.createHash("sha256").update(repoPath).digest("hex").slice(0, 6);
}

export function gitDesktopLocalStorageDir(): string {
	if (process.platform !== "win32") {
		// TODO: Add macOS support (~/Library/Application Support/GitHub Desktop/Local Storage/leveldb)
		// TODO: Add Linux support (~/.config/GitHub Desktop/Local Storage/leveldb)
		throw new Error(
			`Unsupported platform: ${process.platform}. Only Windows is currently supported.`,
		);
	}

	return path.join(
		process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
		"GitHub Desktop",
		"Local Storage",
		"leveldb",
	);
}

export function globalGitConfigPath(): string {
	return path.join(os.homedir(), ".gitconfig");
}

export class GitSwitchError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GitSwitchError";
	}
}

export class ProviderError extends GitSwitchError {
	constructor(
		public readonly provider: string,
		message: string,
	) {
		super(message);
		this.name = "ProviderError";
	}
}

export class DesktopKeychainError extends GitSwitchError {
	constructor(
		public readonly os: string,
		message: string,
		public readonly installHint?: string,
	) {
		super(message);
		this.name = "DesktopKeychainError";
	}
}

export class SnapshotError extends GitSwitchError {
	constructor(message: string) {
		super(message);
		this.name = "SnapshotError";
	}
}

export class NotInGitRepoError extends GitSwitchError {
	constructor() {
		super("Not inside a git repository");
		this.name = "NotInGitRepoError";
	}
}

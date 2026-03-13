import { type SpawnSyncOptions, spawnSync } from "node:child_process";

export interface ShellResult {
	stdout: string;
	stderr: string;
	exitCode: number;
}

export function run(
	command: string,
	args: string[] = [],
	options?: SpawnSyncOptions,
): ShellResult {
	const result = spawnSync(command, args, {
		encoding: "utf-8",
		timeout: 30_000,
		windowsHide: true,
		...options,
	});

	return {
		stdout: ((result.stdout as string) || "").trim(),
		stderr: ((result.stderr as string) || "").trim(),
		exitCode: result.status ?? 1,
	};
}

export function runOrThrow(
	command: string,
	args: string[] = [],
	options?: SpawnSyncOptions,
): string {
	const result = run(command, args, options);
	if (result.exitCode !== 0) {
		throw new Error(
			`Command failed: ${command} ${args.join(" ")}\n${result.stderr}`,
		);
	}
	return result.stdout;
}

export function isCommandAvailable(command: string): boolean {
	// TODO: Add macOS/Linux support (use `which` instead of `where`)
	const check = run("where", [command]);
	return check.exitCode === 0;
}

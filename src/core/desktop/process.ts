import { spawn } from "node:child_process";
import { run } from "../../utils/shell.js";

// TODO: Add macOS support (process name: "GitHub Desktop", launch: `open -a "GitHub Desktop"`, kill: `pkill -f`)
// TODO: Add Linux support (process name: "github-desktop", launch: `github-desktop`, kill: `pkill -f`)

export function isDesktopRunning(): boolean {
	const result = run("tasklist", ["/FI", "IMAGENAME eq GitHubDesktop.exe"]);
	return result.stdout.toLowerCase().includes("githubdesktop.exe");
}

export function killDesktop(): void {
	run("taskkill", ["/F", "/IM", "GitHubDesktop.exe"]);
	run("powershell.exe", ["-NoProfile", "-Command", "Start-Sleep -Seconds 1"]);
}

export function launchDesktop(): void {
	const localAppData = process.env.LOCALAPPDATA || "";
	const desktopExe = `${localAppData}\\GitHubDesktop\\GitHubDesktop.exe`;
	const child = spawn("explorer.exe", [desktopExe], {
		detached: true,
		stdio: "ignore",
	});
	child.unref();
}

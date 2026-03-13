import * as fs from "node:fs";
import type { Profile } from "../providers/types.js";
import { atomicWriteFile } from "../utils/fs.js";
import {
	ensureDir,
	sshConfigPath,
	sshDir,
	sshPublicKeyPath,
} from "../utils/paths.js";

const BEGIN_MARKER = "# --- git-switch managed --- BEGIN ---";
const END_MARKER = "# --- git-switch managed --- END ---";

export interface SSHHostBlock {
	alias: string;
	hostname: string;
	identityFile: string;
}

function buildHostBlock(block: SSHHostBlock): string {
	// Prevent SSH config injection via newlines in values
	for (const [key, val] of Object.entries(block)) {
		if (/[\n\r]/.test(val)) {
			throw new Error(`SSH config value for "${key}" contains newlines`);
		}
	}
	return [
		`Host ${block.alias}`,
		`  HostName ${block.hostname}`,
		`  User git`,
		`  IdentityFile ${block.identityFile}`,
		`  IdentitiesOnly yes`,
	].join("\n");
}

function buildFencedBlock(blocks: SSHHostBlock[]): string {
	const inner = blocks.map(buildHostBlock).join("\n\n");
	return `${BEGIN_MARKER}\n${inner}\n${END_MARKER}`;
}

export function readSSHConfig(): string {
	const p = sshConfigPath();
	if (!fs.existsSync(p)) {
		return "";
	}
	return fs.readFileSync(p, "utf-8");
}

function extractOutsideFence(content: string): {
	before: string;
	after: string;
} {
	const beginIdx = content.indexOf(BEGIN_MARKER);
	const endIdx = content.indexOf(END_MARKER);

	if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) {
		return { before: content, after: "" };
	}

	const before = content.slice(0, beginIdx);
	const after = content.slice(endIdx + END_MARKER.length);
	return { before, after };
}

function extractFencedBlocks(content: string): SSHHostBlock[] {
	const beginIdx = content.indexOf(BEGIN_MARKER);
	const endIdx = content.indexOf(END_MARKER);
	if (beginIdx === -1 || endIdx === -1) return [];

	const fenced = content.slice(beginIdx + BEGIN_MARKER.length, endIdx);
	const blocks: SSHHostBlock[] = [];

	const hostRegex =
		/Host\s+(\S+)\s*\n\s*HostName\s+(\S+)\s*\n\s*User\s+\S+\s*\n\s*IdentityFile\s+(\S+)/g;
	let match = hostRegex.exec(fenced);
	while (match !== null) {
		const alias = match[1];
		const hostname = match[2];
		const identityFile = match[3];
		if (alias && hostname && identityFile) {
			blocks.push({ alias, hostname, identityFile });
		}
		match = hostRegex.exec(fenced);
	}
	return blocks;
}

export function writeSSHConfig(content: string): void {
	const dir = sshDir();
	ensureDir(dir);
	atomicWriteFile(sshConfigPath(), content);
}

export function resolveIdentityFile(profile: Profile): string {
	if (profile.ssh.provider === "manual") {
		// Strip .pub to get the private key path
		const ref = profile.ssh.ref;
		return ref.endsWith(".pub") ? ref.slice(0, -4) : ref;
	}
	// For 1password, point to the .pub hint file
	return sshPublicKeyPath(profile.ssh.alias);
}

export function updateSSHConfigForProfiles(profiles: Profile[]): void {
	const current = readSSHConfig();
	const { before, after } = extractOutsideFence(current);

	const blocks: SSHHostBlock[] = profiles.map((profile) => ({
		alias: profile.ssh.alias,
		hostname: profile.ssh.host,
		identityFile: resolveIdentityFile(profile),
	}));

	const fenced = buildFencedBlock(blocks);
	const newContent = `${before.trimEnd()}\n\n${fenced}\n${after.trimStart()}`;
	writeSSHConfig(newContent.trimStart());
}

export function removeAliasFromSSHConfig(alias: string): void {
	const current = readSSHConfig();
	const blocks = extractFencedBlocks(current);
	const filtered = blocks.filter((b) => b.alias !== alias);
	const { before, after } = extractOutsideFence(current);

	if (filtered.length === 0) {
		// Remove the entire fenced block
		const newContent = `${before.trimEnd()}\n${after.trimStart()}`.trim();
		writeSSHConfig(`${newContent}\n`);
	} else {
		const fenced = buildFencedBlock(filtered);
		const newContent = `${before.trimEnd()}\n\n${fenced}\n${after.trimStart()}`;
		writeSSHConfig(newContent.trimStart());
	}
}

export function writePublicKeyFile(alias: string, publicKey: string): void {
	const keyPath = sshPublicKeyPath(alias);
	atomicWriteFile(keyPath, `${publicKey.trim()}\n`);
}

export function deletePublicKeyFile(alias: string): void {
	const keyPath = sshPublicKeyPath(alias);
	if (fs.existsSync(keyPath)) {
		fs.unlinkSync(keyPath);
	}
}

import { eq } from "drizzle-orm";
import { getDb, schema } from "../db/index.js";
import type { DesktopProfile } from "../providers/types.js";
import { GitSwitchError } from "../utils/errors.js";

type DesktopProfileRow = typeof schema.desktopProfiles.$inferSelect;

function rowToDesktopProfile(row: DesktopProfileRow): DesktopProfile {
	return {
		id: row.id,
		label: row.label,
		email: row.email,
		keychain_label: row.keychainLabel,
		stored_label: row.storedLabel,
		users_json: row.usersJson ?? undefined,
	};
}

function desktopProfileToRow(
	dp: DesktopProfile,
): typeof schema.desktopProfiles.$inferInsert {
	return {
		id: dp.id,
		label: dp.label,
		email: dp.email,
		keychainLabel: dp.keychain_label,
		storedLabel: dp.stored_label,
		usersJson: dp.users_json ?? null,
	};
}

export function getDesktopProfile(id: string): DesktopProfile | undefined {
	const db = getDb();
	const row = db
		.select()
		.from(schema.desktopProfiles)
		.where(eq(schema.desktopProfiles.id, id))
		.get();
	return row ? rowToDesktopProfile(row) : undefined;
}

export function addDesktopProfile(profile: DesktopProfile): void {
	const db = getDb();
	const existing = db
		.select()
		.from(schema.desktopProfiles)
		.where(eq(schema.desktopProfiles.id, profile.id))
		.get();
	if (existing) {
		throw new GitSwitchError(`Desktop profile "${profile.id}" already exists`);
	}
	db.insert(schema.desktopProfiles).values(desktopProfileToRow(profile)).run();
}

export function removeDesktopProfile(id: string): DesktopProfile {
	const db = getDb();
	const row = db
		.select()
		.from(schema.desktopProfiles)
		.where(eq(schema.desktopProfiles.id, id))
		.get();
	if (!row) {
		throw new GitSwitchError(`Desktop profile "${id}" not found`);
	}
	db.delete(schema.desktopProfiles)
		.where(eq(schema.desktopProfiles.id, id))
		.run();
	return rowToDesktopProfile(row);
}

export function listAllDesktopProfiles(): DesktopProfile[] {
	const db = getDb();
	const rows = db.select().from(schema.desktopProfiles).all();
	return rows.map(rowToDesktopProfile);
}

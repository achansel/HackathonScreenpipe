import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Episode, EpisodeStatus } from "./types.ts";

export interface EpisodeRow {
	id: string;
	kind: string;
	stage: string;
	status: EpisodeStatus;
	createdAt: number;
	updatedAt: number;
}

/**
 * L'état local des épisodes. Le JSON de l'épisode peut contenir des données client :
 * il reste dans ce fichier, sur la machine, et n'est jamais journalisé.
 */
export class Store {
	private readonly db: Database;

	constructor(path: string) {
		if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
		this.db = new Database(path, { create: true, strict: true });
		this.db.run("PRAGMA journal_mode = WAL");
		this.db.run(`CREATE TABLE IF NOT EXISTS episodes (
			id TEXT PRIMARY KEY,
			kind TEXT NOT NULL,
			stage TEXT NOT NULL,
			status TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL,
			data TEXT NOT NULL
		)`);
		this.db.run(`CREATE TABLE IF NOT EXISTS events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			episode_id TEXT NOT NULL,
			type TEXT NOT NULL,
			detail TEXT,
			at INTEGER NOT NULL
		)`);
		this.db.run("CREATE INDEX IF NOT EXISTS events_type_at ON events (type, at)");
	}

	/** Enregistre un nouvel épisode. Retourne false s'il existe déjà (un épisode = une notification). */
	insertEpisode(episode: Episode, status: EpisodeStatus, now: number): boolean {
		const result = this.db
			.query(
				`INSERT OR IGNORE INTO episodes (id, kind, stage, status, created_at, updated_at, data)
				VALUES ($id, $kind, $stage, $status, $createdAt, $now, $data)`,
			)
			.run({
				id: episode.id,
				kind: episode.help.kind,
				stage: episode.stage,
				status,
				createdAt: episode.createdAt,
				now,
				data: JSON.stringify(episode),
			});
		return result.changes === 1;
	}

	getEpisode(id: string): EpisodeRow | null {
		return this.db
			.query<EpisodeRow, { id: string }>(
				`SELECT id, kind, stage, status, created_at AS createdAt, updated_at AS updatedAt
				FROM episodes WHERE id = $id`,
			)
			.get({ id });
	}

	/** L'épisode complet, données locales comprises. Ne jamais le journaliser. */
	getEpisodeData(id: string): Episode | null {
		const row = this.db.query<{ data: string }, { id: string }>("SELECT data FROM episodes WHERE id = $id").get({ id });
		return row ? (JSON.parse(row.data) as Episode) : null;
	}

	/** Les épisodes affichés dont on attend encore un signal (vue, fermeture, clic, 👍/👎). */
	openEpisodes(): { id: string; status: EpisodeStatus; shownAt: number }[] {
		return this.db
			.query<{ id: string; status: EpisodeStatus; shownAt: number | null }, []>(
				`SELECT e.id, e.status,
					(SELECT MAX(at) FROM events WHERE episode_id = e.id AND type = 'shown') AS shownAt
				FROM episodes e
				WHERE e.status IN ('shown', 'seen', 'dismissed', 'clicked')`,
			)
			.all()
			.map((row) => ({ ...row, shownAt: row.shownAt ?? 0 }));
	}

	hasEvent(episodeId: string, type: string): boolean {
		return (
			this.db
				.query<{ n: number }, { episodeId: string; type: string }>(
					"SELECT COUNT(*) AS n FROM events WHERE episode_id = $episodeId AND type = $type",
				)
				.get({ episodeId, type })?.n !== 0
		);
	}

	setStatus(id: string, status: EpisodeStatus, now: number): void {
		this.db.query("UPDATE episodes SET status = $status, updated_at = $now WHERE id = $id").run({ id, status, now });
	}

	addEvent(episodeId: string, type: string, now: number, detail?: string): void {
		this.db
			.query("INSERT INTO events (episode_id, type, detail, at) VALUES ($episodeId, $type, $detail, $now)")
			.run({ episodeId, type, detail: detail ?? null, now });
	}

	countEventsSince(type: string, since: number): number {
		const row = this.db
			.query<{ n: number }, { type: string; since: number }>(
				"SELECT COUNT(*) AS n FROM events WHERE type = $type AND at >= $since",
			)
			.get({ type, since });
		return row?.n ?? 0;
	}

	events(episodeId: string): { type: string; detail: string | null; at: number }[] {
		return this.db
			.query<{ type: string; detail: string | null; at: number }, { episodeId: string }>(
				"SELECT type, detail, at FROM events WHERE episode_id = $episodeId ORDER BY id",
			)
			.all({ episodeId });
	}

	close(): void {
		this.db.close();
	}
}

// Stockage d'équipe TEMPORAIRE (cf. PROPOSITION.md §5) : une table de blocs chiffrés côté client.
// Le stockage ne voit ni contenu ni identité : pas de colonne auteur, AES-256-GCM avec une clé
// d'équipe qui ne quitte jamais les postes (même modèle que les Teams de Screenpipe).
// Cible à terme : la mémoire d'équipe de Screenpipe, derrière la même interface.
import { SQL } from "bun";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { AccessDenied, routeTeams, SupabaseStore, Team, type Membership } from "../../teamstore/client";
import { DATABASE_URL, TEAM_DIR, TEAM_KEY_FILE, TEAMS_FILE, TEAMSTORE_ANON_KEY, TEAMSTORE_REST_PATH, TEAMSTORE_URL } from "./config";

export type Kind = "request" | "solution" | "signature" | "candidate"; // candidate : boucle de nuit (teamstore/nuit.ts)
export type Row = { id: number; at: string; payload: any };

export interface TeamStore {
  init(): Promise<void>;
  put(kind: Kind, payload: object): Promise<number>;
  list(kind: Kind, afterId: number): Promise<Row[]>;
  remove(ids: number[]): Promise<number>;
  close(): Promise<void>;
}

export function teamKey(): Buffer {
  if (!existsSync(TEAM_KEY_FILE)) throw new Error("clé d'équipe absente : bun andrea/daemon/main.ts equipe-init");
  const key = Buffer.from(readFileSync(TEAM_KEY_FILE, "utf8").trim(), "base64");
  if (key.length !== 32) throw new Error("clé d'équipe invalide (32 octets attendus)");
  return key;
}

export function seal(key: Buffer, payload: object) {
  const nonce = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([c.update(JSON.stringify(payload), "utf8"), c.final(), c.getAuthTag()]);
  return { nonce, ciphertext };
}

export function unseal(key: Buffer, nonce: Buffer, ciphertext: Buffer): any {
  const d = createDecipheriv("aes-256-gcm", key, nonce);
  d.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
  return JSON.parse(Buffer.concat([d.update(ciphertext.subarray(0, ciphertext.length - 16)), d.final()]).toString("utf8"));
}

export class PostgresTeamStore implements TeamStore {
  private sql: SQL;
  constructor(private key: Buffer, url = DATABASE_URL) {
    if (!url) throw new Error("FRICTION_DATABASE_URL manquant : source ~/.config/friction-assist/team.env");
    this.sql = new SQL({ url, max: 2 });
  }

  async init() {
    await this.sql`create table if not exists friction_blobs (
      id bigserial primary key,
      kind text not null check (kind in ('request', 'solution', 'signature')),
      at timestamptz not null default now(),
      nonce bytea not null,
      ciphertext bytea not null
    )`;
    await this.sql`create index if not exists friction_blobs_kind_id on friction_blobs (kind, id)`;
    // Supabase expose le schéma public par son API REST : RLS sans politique = illisible par anon.
    await this.sql`alter table friction_blobs enable row level security`;
  }

  async put(kind: Kind, payload: object): Promise<number> {
    const { nonce, ciphertext } = seal(this.key, payload);
    const [r] = await this.sql`insert into friction_blobs (kind, nonce, ciphertext) values (${kind}, ${nonce}, ${ciphertext}) returning id`;
    return Number(r.id);
  }

  async list(kind: Kind, afterId: number): Promise<Row[]> {
    const rows = await this.sql`select id, at, nonce, ciphertext from friction_blobs where kind = ${kind} and id > ${afterId} order by id limit 200`;
    const out: Row[] = [];
    for (const r of rows) {
      try {
        out.push({ id: Number(r.id), at: new Date(r.at).toISOString(), payload: unseal(this.key, Buffer.from(r.nonce), Buffer.from(r.ciphertext)) });
      } catch {
        out.push({ id: Number(r.id), at: new Date(r.at).toISOString(), payload: null }); // autre équipe / clé différente : ignoré
      }
    }
    return out;
  }

  async remove(ids: number[]): Promise<number> {
    if (!ids.length) return 0;
    const r = await this.sql`delete from friction_blobs where id in ${this.sql(ids)}`;
    return r.count ?? ids.length;
  }

  async close() {
    await this.sql.close();
  }
}

// ---- Stockage d'équipe par RPC (recommandé) : cf. teamstore/ à la racine et teamstore/FICHE.md.
// Différences avec PostgresTeamStore : aucun identifiant de base sur les postes (seulement l'URL
// Supabase et sa clé publique), une clé et un jeton PAR équipe, plusieurs équipes par personne,
// pas d'horodatage précis, tailles arrondies, rotation de clé au départ d'un membre, solutions
// certifiées par le responsable. Même interface : TeamSync (team.ts) ne change pas.

export const teamstoreConfigured = () => Boolean(TEAMSTORE_URL);
export const supabase = () => new SupabaseStore(TEAMSTORE_URL, TEAMSTORE_ANON_KEY, TEAMSTORE_REST_PATH);
export const loadMemberships = (): Membership[] => (existsSync(TEAMS_FILE) ? JSON.parse(readFileSync(TEAMS_FILE, "utf8")) : []);
export function saveMemberships(list: Membership[]) {
  mkdirSync(TEAM_DIR, { recursive: true });
  writeFileSync(TEAMS_FILE, JSON.stringify(list, null, 2), { mode: 0o600 });
  chmodSync(TEAMS_FILE, 0o600);
}

export class RpcTeamStore implements TeamStore {
  teams: Team[] = [];
  private requestTeam = new Map<string, Team>(); // requestId → équipe d'où vient la demande
  private denied = new Set<string>();
  private mtime = 0;
  constructor(private log: (...a: unknown[]) => void = console.log) {}

  /** Relit le fichier des équipes s'il a changé (equipe-rejoindre / equipe-rotation pendant que le daemon tourne). */
  async reload() {
    const mtime = existsSync(TEAMS_FILE) ? statSync(TEAMS_FILE).mtimeMs : 0;
    if (mtime === this.mtime) return;
    this.mtime = mtime;
    const store = supabase();
    this.teams = await Promise.all(loadMemberships().map((m) => Team.open(store, m)));
    this.denied.clear();
    this.log(`équipes : ${this.teams.map((t) => `${t.name} (époque ${t.epoch}${t.m.scope ? `, périmètre ${t.m.scope}` : ""})`).join(", ") || "aucune"}`);
  }

  async init() { await this.reload(); } // le schéma se crée une fois, dans l'éditeur SQL de Supabase (teamstore/schema.sql)

  /** Demande et signature : vers les équipes dont le périmètre correspond à l'étape.
   *  Solution en réponse à une demande : vers l'équipe de la demande, jamais ailleurs. */
  async put(kind: Kind, payload: any): Promise<number> {
    // L'heure d'une demande (pour ignorer les demandes périmées) voyage CHIFFRÉE, arrondie à 10 min :
    // les collègues la lisent, le serveur ne la voit jamais.
    if (kind === "request" && payload && !payload.at) payload = { ...payload, at: new Date(Math.floor(Date.now() / 600_000) * 600_000).toISOString() };
    const answer = payload?.requestId ? this.requestTeam.get(payload.requestId) : undefined;
    const targets = kind === "solution" && answer ? [answer] : routeTeams(this.teams, String(payload?.step ?? ""));
    let seq = 0;
    for (const t of targets) seq = await t.publish(kind, payload);
    if (!targets.length) this.log(`aucune équipe ne couvre « ${payload?.step} » : rien n'est publié`);
    return seq;
  }

  /** Union des équipes, triée par curseur global. Une équipe dont la clé a changé est signalée une fois. */
  async list(kind: Kind, afterId: number): Promise<Row[]> {
    await this.reload();
    const rows: Row[] = [];
    for (const t of this.teams) {
      try {
        for (const r of await t.pull(afterId, kind)) {
          if (kind === "request" && r.data?.requestId) this.requestTeam.set(r.data.requestId, t);
          // Date approximative tirée du contenu chiffré (le serveur n'en donne aucune) : demande (at, arrondie
          // à 10 min), solution partagée (sharedAt), signature (day). Sert aux filtres de team.ts et de la carte.
          const d = r.data ?? {};
          const at = [d.at, d.sharedAt, d.day, d.reviewed].find((x) => typeof x === "string" && !Number.isNaN(Date.parse(x))) ?? "";
          rows.push({ id: r.seq, at, payload: { ...d, team: t.name } });
        }
        this.denied.delete(t.id);
      } catch (e) {
        if (!(e instanceof AccessDenied)) throw e;
        if (!this.denied.has(t.id)) this.log(`équipe « ${t.name} » : accès refusé (retiré de l'équipe, ou clé changée : demander le nouveau lien)`);
        this.denied.add(t.id);
      }
    }
    return rows.sort((a, b) => a.id - b.id);
  }

  /** Retrait (nettoyer-demo, solution fausse) : seul le responsable d'une équipe peut purger ses blobs. */
  async remove(ids: number[]): Promise<number> {
    const admins = this.teams.filter((t) => t.isAdmin);
    if (ids.length && !admins.length) this.log("retrait impossible : seul le responsable d'une équipe peut retirer des blobs");
    let n = 0;
    for (const id of ids) for (const t of admins) if (await t.purge(id)) { n++; break; }
    return n;
  }

  async close() {}
}

/** Le stockage d'équipe de ce poste : RPC s'il est configuré (recommandé), sinon l'ancien Postgres direct. */
export async function openTeamStore(log: (...a: unknown[]) => void = console.log): Promise<TeamStore> {
  if (teamstoreConfigured() && loadMemberships().length) {
    const store = new RpcTeamStore(log);
    await store.init();
    return store;
  }
  return new PostgresTeamStore(teamKey());
}

// Stockage d'équipe TEMPORAIRE (cf. PROPOSITION.md §5) : une table de blocs chiffrés côté client.
// Le stockage ne voit ni contenu ni identité : pas de colonne auteur, AES-256-GCM avec une clé
// d'équipe qui ne quitte jamais les postes (même modèle que les Teams de Screenpipe).
// Cible à terme : la mémoire d'équipe de Screenpipe, derrière la même interface.
import { SQL } from "bun";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { DATABASE_URL, TEAM_KEY_FILE } from "./config";

export type Kind = "request" | "solution" | "signature";
export type Row = { id: number; at: string; payload: any };

export interface TeamStore {
  init(): Promise<void>;
  put(kind: Kind, payload: object): Promise<number>;
  list(kind: Kind, afterId: number): Promise<Row[]>;
  close(): Promise<void>;
}

export function teamKey(): Buffer {
  if (!existsSync(TEAM_KEY_FILE)) throw new Error("clé d'équipe absente : bun andrea/daemon/main.ts equipe-init");
  const key = Buffer.from(readFileSync(TEAM_KEY_FILE, "utf8").trim(), "base64");
  if (key.length !== 32) throw new Error("clé d'équipe invalide (32 octets attendus)");
  return key;
}

function seal(key: Buffer, payload: object) {
  const nonce = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, nonce);
  const ciphertext = Buffer.concat([c.update(JSON.stringify(payload), "utf8"), c.final(), c.getAuthTag()]);
  return { nonce, ciphertext };
}

function unseal(key: Buffer, nonce: Buffer, ciphertext: Buffer): any {
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

  async close() {
    await this.sql.close();
  }
}

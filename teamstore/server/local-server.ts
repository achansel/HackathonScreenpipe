// Serveur d'équipe local, sans Docker ni compte : les 6 mêmes fonctions que schema.sql (mêmes contrôles,
// mêmes réponses que Supabase/PostgREST), sur un fichier SQLite. Marche sur Mac, Windows et Linux.
// Sert à essayer seul, ou à toute l'équipe sur le même réseau (--heberger). Pour de vrai : Supabase.
// Le serveur ne voit que des blobs chiffrés et des empreintes de jetons, exactement comme Supabase.
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const HEX64 = /^[0-9a-f]{64}$/;
const KINDS = new Set(["request", "solution", "signature", "vote", "certification", "candidate"]);
const TTL: Record<string, number> = { request: 1, vote: 30, signature: 30, solution: 180, certification: 180, candidate: 30 }; // jours
const DAY = 86_400_000;

class RpcError extends Error {
  constructor(message: string, public status = 400, public code = "P0001") { super(message); }
}
const denied = () => new RpcError("accès refusé", 401, "42501");
const hash = (token: unknown) => new Bun.CryptoHasher("sha256").update(String(token ?? "")).digest("hex");

export class LocalTeamServer {
  db: Database;
  constructor(file: string) {
    if (file !== ":memory:") mkdirSync(dirname(file), { recursive: true });
    this.db = new Database(file, { create: true });
    this.db.exec(`pragma journal_mode = wal;
      create table if not exists teams (id text primary key, access_hash text not null, admin_hash text not null, epoch integer not null default 1, created_at integer not null);
      create table if not exists blobs (seq integer primary key autoincrement, team_id text not null references teams(id) on delete cascade,
        kind text not null, epoch integer not null, ciphertext text not null, day text not null, expires_at integer not null);
      create index if not exists blobs_team_seq on blobs (team_id, seq);
      pragma foreign_keys = on;`);
  }
  private team(id: unknown) { return this.db.query("select * from teams where id = ?").get(String(id ?? "")) as any; }

  create_team(a: any) {
    if (!HEX64.test(a.p_access_hash ?? "") || !HEX64.test(a.p_admin_hash ?? "")) throw new RpcError("empreinte invalide");
    const recent = (this.db.query("select count(*) n from teams where created_at > ?").get(Date.now() - 3_600_000) as any).n;
    if (recent >= 50) throw new RpcError("trop de créations d'équipe, réessayer plus tard");
    const id = crypto.randomUUID();
    this.db.query("insert into teams values (?, ?, ?, 1, ?)").run(id, a.p_access_hash, a.p_admin_hash, Date.now());
    return id;
  }
  put_blob(a: any) {
    const t = this.team(a.p_team);
    if (!t || t.access_hash !== hash(a.p_token)) throw denied();
    if (Number(a.p_epoch) !== t.epoch) throw new RpcError("époque périmée : la clé d'équipe a changé", 400, "22023");
    if (!KINDS.has(a.p_kind)) throw new RpcError(`new row for relation "blobs" violates check constraint "blobs_kind_check"`, 400, "23514");
    const ct = String(a.p_ciphertext ?? "");
    if (ct.length > 24000) throw new RpcError(`new row for relation "blobs" violates check constraint "blobs_ciphertext_check"`, 400, "23514");
    const day = new Date().toISOString().slice(0, 10);
    if ((this.db.query("select count(*) n from blobs where team_id = ? and day = ?").get(t.id, day) as any).n >= 2000) throw new RpcError("quota quotidien atteint");
    const row = this.db.query("insert into blobs (team_id, kind, epoch, ciphertext, day, expires_at) values (?, ?, ?, ?, ?, ?) returning seq")
      .get(t.id, a.p_kind, t.epoch, ct, day, Date.now() + TTL[a.p_kind] * DAY) as { seq: number };
    return Number(row.seq);
  }
  list_blobs(a: any) {
    const t = this.team(a.p_team);
    if (!t || t.access_hash !== hash(a.p_token)) throw denied();
    const limit = Math.min(Math.max(Number(a.p_limit ?? 200), 1), 500);
    return this.db.query(`select seq, kind, epoch, ciphertext from blobs where team_id = ? and seq > ? and expires_at > ? and epoch = ?
      and (? is null or kind = ?) order by seq limit ?`).all(t.id, Number(a.p_since ?? 0), Date.now(), t.epoch, a.p_kind ?? null, a.p_kind ?? null, limit);
  }
  rotate_team(a: any) {
    if (!HEX64.test(a.p_new_access_hash ?? "")) throw new RpcError("empreinte invalide");
    const t = this.team(a.p_team);
    if (!t || t.admin_hash !== hash(a.p_admin_token)) throw denied();
    const epoch = t.epoch + 1;
    this.db.transaction(() => {
      this.db.query("update teams set access_hash = ?, epoch = ? where id = ?").run(a.p_new_access_hash, epoch, t.id);
      this.db.query("delete from blobs where team_id = ? and epoch < ?").run(t.id, epoch);
    })();
    return epoch;
  }
  purge_blob(a: any) {
    const t = this.team(a.p_team);
    if (!t || t.admin_hash !== hash(a.p_admin_token)) throw denied();
    return this.db.query("delete from blobs where team_id = ? and seq = ?").run(t.id, Number(a.p_seq)).changes > 0;
  }
  delete_team(a: any) {
    const t = this.team(a.p_team);
    if (!t || t.admin_hash !== hash(a.p_admin_token)) return false;
    this.db.transaction(() => { this.db.query("delete from blobs where team_id = ?").run(t.id); this.db.query("delete from teams where id = ?").run(t.id); })();
    return true;
  }

  /** Rétention : les blobs expirés disparaissent (équivalent du pg_cron de Supabase). */
  purgeExpired() { this.db.query("delete from blobs where expires_at < ?").run(Date.now()); }

  /** Vue opérateur (machine qui héberge seulement, jamais exposée sur le réseau). */
  operatorView() {
    return {
      teams: this.db.query("select id, epoch, access_hash, admin_hash, created_at from teams order by created_at").all(),
      blobs: this.db.query("select seq, team_id, kind, epoch, length(ciphertext) size, ciphertext, day, expires_at from blobs order by seq desc limit 40").all(),
    };
  }
  reset() { this.db.exec("delete from blobs; delete from teams;"); }

  /** Même surface HTTP que PostgREST : POST /rpc/<fonction>, tables inaccessibles, CORS ouvert. */
  serve(port: number, hostname: string) {
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, apikey, authorization", "Access-Control-Allow-Methods": "POST, GET, OPTIONS" };
    const json = (body: unknown, status = 200) => Response.json(body, { status, headers: cors });
    const fns = ["create_team", "put_blob", "list_blobs", "rotate_team", "purge_blob", "delete_team"] as const;
    setInterval(() => this.purgeExpired(), 3_600_000);
    return Bun.serve({
      port, hostname,
      fetch: async (req) => {
        if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
        const path = new URL(req.url).pathname.replace(/^\/rest\/v1/, "");
        const m = path.match(/^\/rpc\/(\w+)$/);
        if (m && req.method === "POST") {
          const fn = m[1] as (typeof fns)[number];
          if (!fns.includes(fn)) return json({ code: "42501", message: `permission denied for function ${fn}` }, 401);
          try { return json(this[fn]((await req.json().catch(() => ({}))) ?? {})); }
          catch (e) {
            const err = e instanceof RpcError ? e : new RpcError((e as Error).message, 500);
            return json({ code: err.code, details: null, hint: null, message: err.message }, err.status);
          }
        }
        if (/^\/(blobs|teams)\b/.test(path)) return json({ code: "42501", details: null, hint: null, message: `permission denied for table ${path.slice(1).split(/[/?]/)[0]}` }, 401);
        if (path === "/") return json({ service: "Piping Company teamstore (local)", functions: fns });
        return json({ message: "not found" }, 404);
      },
    });
  }
}

if (import.meta.main) {
  const host = process.argv.includes("--heberger") ? "0.0.0.0" : "127.0.0.1";
  const port = Number(Bun.env.TEAMSTORE_LOCAL_PORT ?? 3001);
  const file = Bun.env.TEAMSTORE_LOCAL_DB ?? `${import.meta.dir}/.data/local.sqlite`;
  new LocalTeamServer(file).serve(port, host);
  console.log(`serveur d'équipe local : http://${host}:${port} (${file})`);
}

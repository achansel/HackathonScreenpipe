// Client du stockage d'équipe : appels RPC Supabase (clé publique « anon » seulement) et une équipe
// vue d'une machine (chiffre, publie, relit, fait tourner la clé). Tourne dans Bun et dans un navigateur.
import {
  b64u, certify, deriveAdminToken, deriveTeamKeys, exportPrivate, exportPublic, importPrivate, makeInvite,
  open, ownerKeyPair, parseInvite, randomKey, seal, sha256hex, verifyCertification, type TeamKeys,
} from "./crypto";

export type Kind = "request" | "solution" | "signature" | "vote" | "certification" | "candidate"; // candidate : boucle de nuit
export interface StoredBlob { seq: number; kind: Kind; epoch: number; ciphertext: string }
export interface Received { seq: number; kind: Kind; data: any }

/** Jeton refusé : la personne a été retirée de l'équipe, ou la clé a changé (nouveau lien à demander). */
export class AccessDenied extends Error {}

/** En-têtes Supabase : l'ancienne clé « anon » (un JWT, eyJ…) va aussi dans Authorization ; la nouvelle clé
 *  « publishable » (sb_publishable_…) n'est pas un JWT et va seulement dans `apikey`. */
export function apiKeyHeaders(key: string): Record<string, string> {
  if (!key) return {};
  return key.startsWith("eyJ") ? { apikey: key, Authorization: `Bearer ${key}` } : { apikey: key };
}

// Supabase : uniquement des appels RPC avec la clé publique (anon). Aucune table n'est exposée.
export class SupabaseStore {
  // restPath = "/rest/v1" sur Supabase, "" pour un PostgREST seul (base locale de test).
  constructor(public url: string, private anonKey = "", private restPath = "/rest/v1") {}
  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    Object.assign(headers, apiKeyHeaders(this.anonKey));
    const res = await fetch(`${this.url}${this.restPath}/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args), signal: AbortSignal.timeout(10_000) });
    const text = await res.text();
    if (!res.ok) {
      const msg = (() => { try { return JSON.parse(text).message as string; } catch { return text.slice(0, 120); } })();
      if (msg?.includes("accès refusé") || msg?.includes("époque périmée")) throw new AccessDenied(`${fn} : ${msg}`);
      throw new Error(`${fn} : HTTP ${res.status} ${msg}`);
    }
    return JSON.parse(text) as T;
  }
  createTeam = (accessHash: string, adminHash: string) => this.rpc<string>("create_team", { p_access_hash: accessHash, p_admin_hash: adminHash });
  put = (team: string, token: string, kind: Kind, epoch: number, ciphertext: string) =>
    this.rpc<number>("put_blob", { p_team: team, p_token: token, p_kind: kind, p_epoch: epoch, p_ciphertext: ciphertext });
  list = (team: string, token: string, since: number, kind: Kind | null = null) =>
    this.rpc<StoredBlob[]>("list_blobs", { p_team: team, p_token: token, p_since: since, p_kind: kind });
  rotate = (team: string, adminToken: string, newAccessHash: string) =>
    this.rpc<number>("rotate_team", { p_team: team, p_admin_token: adminToken, p_new_access_hash: newAccessHash });
  purge = (team: string, adminToken: string, seq: number) => this.rpc<boolean>("purge_blob", { p_team: team, p_admin_token: adminToken, p_seq: seq });
  deleteTeam = (team: string, adminToken: string) => this.rpc<boolean>("delete_team", { p_team: team, p_admin_token: adminToken });
}

/** Ce qu'une machine garde pour une équipe (fichier en 600 ou localStorage). Jamais dans le dépôt. */
export interface Membership {
  name: string;
  teamId: string;
  epoch: number;
  key: string;        // K en base64url : lire + écrire + déchiffrer
  ownerPub: string;   // clé publique du responsable (vérifie les solutions certifiées)
  scope?: string;     // périmètre de routage : regex sur l'étape/l'appli (« crisp|remboursement »)
  admin?: { key: string; ownerPriv: string }; // responsable seulement : rotation, purge, certification
}

export const inviteOf = (m: Membership) =>
  makeInvite({ teamId: m.teamId, epoch: m.epoch, name: m.name, master: b64u.dec(m.key), ownerPub: m.ownerPub });
export function membershipFromInvite(link: string, scope?: string): Membership {
  const i = parseInvite(link);
  return { name: i.name, teamId: i.teamId, epoch: i.epoch, key: b64u.enc(i.master), ownerPub: i.ownerPub, ...(scope ? { scope } : {}) };
}

export class Team {
  private constructor(public store: SupabaseStore, public m: Membership, private keys: TeamKeys) {}
  get id() { return this.m.teamId; }
  get name() { return this.m.name; }
  get epoch() { return this.m.epoch; }
  get isAdmin() { return Boolean(this.m.admin); }
  invite() { return inviteOf(this.m); }

  static async open(store: SupabaseStore, m: Membership) {
    return new Team(store, m, await deriveTeamKeys(b64u.dec(m.key)));
  }

  /** Le responsable crée l'équipe : K (à partager), clé admin et clé de signature (à garder). */
  static async create(store: SupabaseStore, name: string, scope?: string) {
    const master = randomKey(), adminKey = randomKey();
    const owner = await ownerKeyPair();
    const keys = await deriveTeamKeys(master);
    const teamId = await store.createTeam(await sha256hex(keys.accessToken), await sha256hex(await deriveAdminToken(adminKey)));
    const m: Membership = {
      name, teamId, epoch: 1, key: b64u.enc(master), ownerPub: await exportPublic(owner.publicKey),
      ...(scope ? { scope } : {}), admin: { key: b64u.enc(adminKey), ownerPriv: await exportPrivate(owner.privateKey) },
    };
    return new Team(store, m, keys);
  }

  async publish(kind: Kind, obj: unknown) {
    const blob = await seal(this.keys, { teamId: this.id, kind, epoch: this.epoch }, obj);
    return this.store.put(this.id, this.keys.accessToken, kind, this.epoch, blob);
  }

  /** Relit ce qui est postérieur à `since`. Un blob illisible (falsifié, autre clé) est ignoré, jamais affiché.
   *  Une solution porteuse d'une certification reçoit `certified: true` seulement si la signature est valide. */
  async pull(since = 0, kind: Kind | null = null): Promise<Received[]> {
    const out: Received[] = [];
    for (const r of await this.store.list(this.id, this.keys.accessToken, since, kind)) {
      let data: any;
      try { data = await open(this.keys, { teamId: this.id, kind: r.kind, epoch: r.epoch }, r.ciphertext); }
      catch { continue; }
      if (r.kind === "solution" && data && typeof data === "object") {
        data.certified = Boolean(data.cert && this.m.ownerPub && await verifyCertification(this.m.ownerPub, data, data.cert));
        if (!data.certified) delete data.cert;
      }
      out.push({ seq: Number(r.seq), kind: r.kind, data });
    }
    return out;
  }

  /** Responsable : signe une solution (elle s'affichera « certifiée » chez tous les membres). */
  async certify(solution: Record<string, unknown>) {
    if (!this.m.admin) throw new Error("seul le responsable de l'équipe certifie");
    const { certified, cert, ...clean } = solution;
    return { ...clean, cert: await certify(await importPrivate(this.m.admin.ownerPriv), clean) };
  }

  /** Départ d'un membre (ou lien qui a fuité) : nouvelle clé, époque + 1. Les solutions encore valables
   *  sont relues AVANT la rotation puis republiées sous la nouvelle clé ; le serveur efface l'ancienne
   *  époque. Renvoie le nouveau lien, à transmettre en privé aux membres restants seulement. */
  async rotate(): Promise<{ invite: string; republished: number }> {
    if (!this.m.admin) throw new Error("seul le responsable de l'équipe fait tourner la clé");
    // Relu avant, republié après : solutions, signatures (la carte en dépend) et demandes ENCORE EN ATTENTE
    // (quelqu'un bloque toujours). Une demande déjà résolue n'est pas republiée.
    const all = await this.pull(0);
    const answered = new Set(all.filter((r) => r.kind === "solution" && r.data?.requestId).map((r) => r.data.requestId));
    const keep = all.filter((r) => r.kind === "solution" || r.kind === "signature" || r.kind === "candidate" || (r.kind === "request" && !answered.has(r.data?.requestId)));
    const master = randomKey();
    const keys = await deriveTeamKeys(master);
    const epoch = await this.store.rotate(this.id, await deriveAdminToken(b64u.dec(this.m.admin.key)), await sha256hex(keys.accessToken));
    this.m = { ...this.m, epoch, key: b64u.enc(master) };
    this.keys = keys;
    for (const r of keep) { const { certified, ...raw } = r.data; await this.publish(r.kind, raw); }
    return { invite: this.invite(), republished: keep.filter((r) => r.kind === "solution").length };
  }

  /** Responsable : supprime l'équipe et tous ses blobs. */
  async destroy() {
    if (!this.m.admin) throw new Error("seul le responsable de l'équipe la supprime");
    return this.store.deleteTeam(this.id, await deriveAdminToken(b64u.dec(this.m.admin.key)));
  }

  /** Responsable : retire un blob (solution fausse, contenu indésirable). */
  async purge(seq: number) {
    if (!this.m.admin) throw new Error("seul le responsable de l'équipe purge");
    return this.store.purge(this.id, await deriveAdminToken(b64u.dec(this.m.admin.key)), seq);
  }
}

/** Routage multi-équipes : une demande ne part qu'aux équipes dont le périmètre correspond à l'étape
 *  (ex. Support = « crisp|rembourse », Ventes = « hubspot|remise »). Une équipe sans périmètre reçoit
 *  tout ce qu'aucune équipe spécialisée ne prend. Rien ne correspond → rien ne sort de la machine. */
export function routeTeams<T extends { m: Membership }>(teams: T[], text: string): T[] {
  const scoped = teams.filter((t) => t.m.scope && new RegExp(t.m.scope, "i").test(text));
  return scoped.length ? scoped : teams.filter((t) => !t.m.scope);
}

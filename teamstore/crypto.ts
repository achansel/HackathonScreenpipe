// Chiffrement côté client du stockage d'équipe friction-assist (WebCrypto, sans dépendance).
// Tourne à l'identique dans Bun (daemon) et dans un navigateur (démo).
// Même base que Screenpipe Teams (AES-256-GCM, clé dans le lien d'invitation), avec en plus :
// des sous-clés dérivées (HKDF), des données associées (équipe, type, époque), un rembourrage
// à taille fixe et des solutions certifiées par le responsable du process (Ed25519).
const te = new TextEncoder(), td = new TextDecoder();
const SALT = te.encode("friction-assist/v1");

export const b64u = {
  enc(b: Uint8Array) {
    let s = "";
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  dec(s: string) {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  },
};
const hex = (b: ArrayBuffer) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, "0")).join("");
export const sha256hex = async (s: string) => hex(await crypto.subtle.digest("SHA-256", te.encode(s)));
export const randomKey = () => crypto.getRandomValues(new Uint8Array(32));
export const randomId = (bytes = 8) => hex(crypto.getRandomValues(new Uint8Array(bytes)).buffer);

export interface TeamKeys { encKey: CryptoKey; accessToken: string }

// K (32 octets, dans le lien d'invitation) → une clé de chiffrement + un jeton d'accès au serveur.
// Le serveur ne reçoit que sha256(jeton) : il ne peut ni déchiffrer, ni retrouver K.
export async function deriveTeamKeys(master: Uint8Array): Promise<TeamKeys> {
  const base = await crypto.subtle.importKey("raw", master, "HKDF", false, ["deriveKey", "deriveBits"]);
  const hkdf = (info: string) => ({ name: "HKDF", hash: "SHA-256", salt: SALT, info: te.encode(info) });
  const encKey = await crypto.subtle.deriveKey(hkdf("enc"), base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const token = new Uint8Array(await crypto.subtle.deriveBits(hkdf("access"), base, 256));
  return { encKey, accessToken: b64u.enc(token) };
}

// Jeton admin, dérivé d'une clé admin distincte qui n'est PAS dans le lien d'invitation.
export async function deriveAdminToken(adminKey: Uint8Array): Promise<string> {
  const base = await crypto.subtle.importKey("raw", adminKey, "HKDF", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt: SALT, info: te.encode("admin") }, base, 256);
  return b64u.enc(new Uint8Array(bits));
}

// Rembourrage : toutes les tailles sont arrondies à un palier, pour ne rien trahir par la longueur.
const BUCKETS = [1024, 2048, 4096, 8192, 16384]; // 1 Ko minimum : une solution signée (≈ 700 octets) a la même taille qu'une demande
function pad(pt: Uint8Array): Uint8Array {
  const size = BUCKETS.find((b) => b >= pt.length + 4);
  if (!size) throw new Error("objet trop gros (16 Ko max)");
  const out = new Uint8Array(size);
  new DataView(out.buffer).setUint32(0, pt.length);
  out.set(pt, 4);
  return out;
}
function unpad(p: Uint8Array): Uint8Array {
  const n = new DataView(p.buffer, p.byteOffset).getUint32(0);
  if (n > p.length - 4) throw new Error("rembourrage invalide");
  return p.slice(4, 4 + n);
}

export interface BlobContext { teamId: string; kind: string; epoch: number }
// Les données associées lient le blob à son équipe, son type et son époque : on ne peut ni le
// déplacer dans une autre équipe, ni faire passer une demande pour une solution.
const aad = (c: BlobContext) => te.encode(`fa1|${c.teamId}|${c.kind}|${c.epoch}`);

export async function seal(keys: TeamKeys, ctx: BlobContext, obj: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: aad(ctx) }, keys.encKey, pad(te.encode(JSON.stringify(obj)))));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv); out.set(ct, 12);
  return b64u.enc(out);
}

export async function open<T = unknown>(keys: TeamKeys, ctx: BlobContext, blob: string): Promise<T> {
  const raw = b64u.dec(blob);
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: raw.slice(0, 12), additionalData: aad(ctx) }, keys.encKey, raw.slice(12));
  return JSON.parse(td.decode(unpad(new Uint8Array(pt)))) as T;
}

// Lien d'invitation : frictionassist://join?team=…&epoch=…&name=…#<K>[.<clé publique du responsable>]
// Tout ce qui est secret ou doit être authentique est dans le fragment (#), qu'un navigateur
// n'envoie jamais à un serveur. Le lien se transmet en privé (DM Slack, de vive voix…).
export interface Invite { teamId: string; epoch: number; name: string; master: Uint8Array; ownerPub: string }
export const makeInvite = (i: Omit<Invite, "master"> & { master: Uint8Array }) =>
  `frictionassist://join?team=${i.teamId}&epoch=${i.epoch}${i.name ? `&name=${encodeURIComponent(i.name)}` : ""}#${b64u.enc(i.master)}${i.ownerPub ? `.${i.ownerPub}` : ""}`;
export function parseInvite(link: string): Invite {
  const u = new URL(link.trim());
  const [k, ownerPub = ""] = u.hash.slice(1).split(".");
  const master = b64u.dec(k ?? "");
  const teamId = u.searchParams.get("team") ?? "";
  if (master.length !== 32 || !/^[0-9a-f-]{36}$/.test(teamId)) throw new Error("lien d'invitation invalide");
  return { teamId, epoch: Number(u.searchParams.get("epoch") ?? 1), name: u.searchParams.get("name") ?? "", master, ownerPub };
}

// Solutions certifiées : le responsable du process signe la solution (Ed25519). Sa clé publique
// arrive avec le lien d'invitation : un membre ne peut ni la remplacer, ni fabriquer une signature.
export const ownerKeyPair = () => crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as Promise<CryptoKeyPair>;
// JSON canonique (clés triées, récursif), sans le champ `cert` lui-même.
function canon(o: unknown): string {
  if (Array.isArray(o)) return `[${o.map(canon).join(",")}]`;
  if (o && typeof o === "object")
    return `{${Object.keys(o).filter((k) => k !== "cert" && k !== "certified").sort().map((k) => `${JSON.stringify(k)}:${canon((o as any)[k])}`).join(",")}}`;
  return JSON.stringify(o);
}
// Seul le contenu de la règle est signé (pas le compteur d'usages ni l'id de la demande).
const certifiedPart = (s: Record<string, unknown>) => ({ id: s.id, step: s.step, title: s.title, body: s.body, copy: s.copy ?? null });
export async function certify(priv: CryptoKey, solution: Record<string, unknown>) {
  return b64u.enc(new Uint8Array(await crypto.subtle.sign("Ed25519", priv, te.encode(canon(certifiedPart(solution))))));
}
export async function verifyCertification(pubRaw: string, solution: Record<string, unknown>, sig: string) {
  try {
    const pub = await crypto.subtle.importKey("raw", b64u.dec(pubRaw), { name: "Ed25519" }, false, ["verify"]);
    return await crypto.subtle.verify("Ed25519", pub, b64u.dec(sig), te.encode(canon(certifiedPart(solution))));
  } catch { return false; }
}
export const exportPublic = async (pub: CryptoKey) => b64u.enc(new Uint8Array(await crypto.subtle.exportKey("raw", pub)));
export const exportPrivate = async (priv: CryptoKey) => b64u.enc(new Uint8Array(await crypto.subtle.exportKey("pkcs8", priv)));
export const importPrivate = (pkcs8: string) => crypto.subtle.importKey("pkcs8", b64u.dec(pkcs8), { name: "Ed25519" }, false, ["sign"]);

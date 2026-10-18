// Jeton local qui protège /offline/* du daemon : seuls nos pipes (qui l'ont dans leur pipe.md)
// peuvent déclencher la collecte et l'apprentissage.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { STATE_DIR } from "../config";

const FILE = `${STATE_DIR}offline-token`;

export function offlineToken(): string {
  if (!existsSync(FILE)) writeFileSync(FILE, randomBytes(16).toString("hex"), { mode: 0o600 });
  return readFileSync(FILE, "utf8").trim();
}

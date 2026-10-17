import { expect, test } from "bun:test";
import { randomBytes } from "node:crypto";
import { seal, unseal } from "./teamstore";

const key = randomBytes(32);

test("chiffrement : aller-retour", () => {
  const { nonce, ciphertext } = seal(key, { step: "Choisir le pipeline", type: "unclear" });
  expect(unseal(key, nonce, ciphertext)).toEqual({ step: "Choisir le pipeline", type: "unclear" });
});

test("chiffrement : le contenu n'apparaît pas en clair", () => {
  const { ciphertext } = seal(key, { step: "Choisir le pipeline" });
  expect(ciphertext.toString("utf8")).not.toContain("pipeline");
});

test("chiffrement : un bloc falsifié est rejeté", () => {
  const { nonce, ciphertext } = seal(key, { a: 1 });
  ciphertext[0] ^= 0xff;
  expect(() => unseal(key, nonce, ciphertext)).toThrow();
});

test("chiffrement : une autre clé d'équipe ne peut pas lire", () => {
  const { nonce, ciphertext } = seal(key, { a: 1 });
  expect(() => unseal(randomBytes(32), nonce, ciphertext)).toThrow();
});

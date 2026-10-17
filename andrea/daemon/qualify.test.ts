import { expect, test } from "bun:test";
import { redact } from "./qualify";

test("masquage : e-mail, téléphone, IBAN", () => {
  const out = redact("jean.d@example.com au +33 6 12 34 56 78, IBAN FR76 3000 6000 0112 3456 7890 189");
  expect(out).not.toContain("example.com");
  expect(out).not.toContain("12 34 56");
  expect(out).not.toContain("3000 6000");
  expect(out).toContain("[EMAIL]");
});

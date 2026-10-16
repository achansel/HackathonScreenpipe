// Récepteur de test : joue le rôle du daemon. Journalise chaque requête reçue sur
// 127.0.0.1:8787 (méthode, chemin, en-têtes, corps) ; la valeur d'Authorization est masquée.
// Usage : bun andrea/scripts/test-receiver.ts
Bun.serve({
  hostname: "127.0.0.1",
  port: 8787,
  async fetch(req) {
    const url = new URL(req.url);
    const headers = Object.fromEntries(
      [...req.headers].map(([k, v]) => [k, /authorization/i.test(k) ? `<présent, ${v.length} car.>` : v]),
    );
    console.log(JSON.stringify({ at: new Date().toISOString(), method: req.method, path: url.pathname + url.search, headers, body: await req.text() }));
    return new Response("ok — reçu par le récepteur de test\n");
  },
});
console.log("récepteur prêt sur http://127.0.0.1:8787 (Ctrl+C pour arrêter)");

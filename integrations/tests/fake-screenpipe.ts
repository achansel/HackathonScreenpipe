/** Un faux Screenpipe : /notify, /notifications (port 11435) et /feedback (port 3030) sur un seul serveur. */
export interface FakeScreenpipe {
	url: string;
	/** Ce que /notify a reçu. */
	notified: { id: string; title: string }[];
	/** La cloche telle que /notifications la renvoie. */
	bell: { id: string; read: boolean }[];
	/** Les retours tels que /feedback les renvoie. */
	feedback: { target: { kind: string; id: string }; rating: "up" | "down"; comment?: string; updated_at: string }[];
	/** Le jeton reçu par /feedback (pour vérifier qu'il est bien envoyé). */
	lastAuth: string | null;
	stop(): void;
}

export function startFakeScreenpipe(options: { addToBell?: boolean } = {}): FakeScreenpipe {
	const fake: FakeScreenpipe = {
		url: "",
		notified: [],
		bell: [],
		feedback: [],
		lastAuth: null,
		stop: () => {},
	};
	const server = Bun.serve({
		hostname: "127.0.0.1",
		port: 0,
		async fetch(request) {
			const { pathname } = new URL(request.url);
			if (pathname === "/notify") {
				const payload = (await request.json()) as { id: string; title: string; priority: string };
				fake.notified.push({ id: payload.id, title: payload.title });
				if (options.addToBell !== false && payload.priority !== "low") fake.bell.push({ id: payload.id, read: false });
				return Response.json({ success: true, message: "Notification sent successfully" });
			}
			if (pathname === "/notifications") return Response.json(fake.bell);
			if (pathname === "/feedback") {
				fake.lastAuth = request.headers.get("Authorization");
				return Response.json({ data: fake.feedback });
			}
			return new Response("Not found", { status: 404 });
		},
	});
	fake.url = `http://127.0.0.1:${server.port}`;
	fake.stop = () => server.stop(true);
	return fake;
}

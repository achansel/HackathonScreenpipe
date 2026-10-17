/** Retire les clés à undefined, pour qu'une option non fournie garde sa valeur par défaut. */
export function defined<T extends object>(options: T): T {
	return Object.fromEntries(Object.entries(options).filter(([, value]) => value !== undefined)) as T;
}

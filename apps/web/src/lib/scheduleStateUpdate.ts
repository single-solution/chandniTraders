/** Run a state update on the next microtask (avoids sync setState inside useEffect). */
export function scheduleStateUpdate(update: () => void): void {
	queueMicrotask(update);
}

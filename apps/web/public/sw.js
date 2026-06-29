// No-op service worker kept to retire older browser registrations cleanly.
self.addEventListener("install", () => {
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(self.registration.unregister().then(() => self.clients.matchAll()));
});

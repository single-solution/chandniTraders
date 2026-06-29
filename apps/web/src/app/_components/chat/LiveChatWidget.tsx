"use client";

/**
 * Real-time chat widget for the storefront.
 *
 * Each visitor (guest or signed-in) has exactly ONE persistent conversation,
 * so there is no thread list — the widget opens straight into it.
 *
 * Modes:
 *   - "loading"  — bootstrap fetch in flight.
 *   - "disabled" — admin toggled chat.enabled = false; render nothing.
 *   - "starting" — the conversation is being created.
 *   - "compose"  — no conversation yet; first-message composer.
 *   - "thread"   — the conversation; messages + composer.
 *
 * Polling strategy follows `ChatSettings`:
 *   - Tab focused → `pollIntervalMsFocused` (default 5s).
 *   - Tab blurred → `pollIntervalMsBlurred` (default 30s).
 *
 * Optimistic sends append a `local-…` id immediately so the bubble
 * appears in <16ms; the server's reply replaces the optimistic
 * message with the persisted version.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

import {
	buildWhatsAppLink,
	createChatTransport,
	customerChatSupportLabel,
	guestChatLoginRequired,
	isAnonymousChatPhone,
	countCustomerChatMessages,
	mergeChatMessagesById,
	type ChatMessage,
	type ChatThread,
} from "@store/shared";

import { ChatMessageBubble, ChatMessageDayDivider, chatWelcomeMessage, groupChatMessagesByDay } from "@/app/_components/chat/chatMessageUi";
import type { ChatSettings } from "@/lib/chat/chatSettings";
import type { OpenChatDetail } from "@/lib/chat/openChat";
import {
	fetchChatBootstrap,
	fetchChatThread,
	fetchOlderChatMessages,
	markChatThreadRead,
	pollChatThread,
	makeOptimisticMessage,
	sendChatMessage,
	startAnonymousChatThread,
	startCustomerChatThread,
	ChatRequestError,
} from "@/lib/chat/transport";
import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";
import { resolvePublicErrorMessage } from "@/lib/errors/publicErrorMessage";
import { useIsSignedIn } from "@/lib/auth/useIsSignedIn";
import { useStoreSettings } from "@/lib/core/storeSettingsContext";
import { getChatPageContext } from "@/lib/chat/pageChatContext";

import { ChatShell, ComposeConversation, StartingConversation, SupportHintFooter, ThreadConversation, statusLabel } from "./liveChatWidgetViews";

type WidgetView = "thread" | "starting" | "compose";

/**
 * Newest *server* message timestamp in a list, ignoring optimistic `local-`
 * stubs. Used as the poll cursor so we never send the client clock (which can
 * run ahead of the server and skip messages) as `since`.
 */
function newestServerCreatedAt(messages: ChatMessage[]): string | null {
	let newest: string | null = null;
	for (const message of messages) {
		if (message.id.startsWith("local-")) {
			continue;
		}
		if (!newest || new Date(message.createdAt) > new Date(newest)) {
			newest = message.createdAt;
		}
	}
	return newest;
}

interface LiveChatWidgetProps {
	onCollapse?: () => void;
	initialOpenDetail?: OpenChatDetail | null;
	layout?: "popover" | "page";
}

export function LiveChatWidget({ onCollapse, initialOpenDetail = null, layout = "popover" }: LiveChatWidgetProps) {
	const { siteName, whatsappNumber } = useStoreSettings();
	const signedInFlag = useIsSignedIn();
	const prevSignedInRef = useRef<boolean | null>(null);
	const [bootstrapLoaded, setBootstrapLoaded] = useState(false);
	const [bootstrapError, setBootstrapError] = useState<string | null>(null);
	const [settings, setSettings] = useState<ChatSettings | null>(null);
	const [enabled, setEnabled] = useState(true);
	const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
	const [activeThread, setActiveThread] = useState<ChatThread | null>(null);
	const [view, setView] = useState<WidgetView>("compose");
	const [pendingFirstMessage, setPendingFirstMessage] = useState<ChatMessage | null>(null);
	const pathname = usePathname() ?? "/";
	const searchParams = useSearchParams();
	const signInHref = useMemo(() => {
		const next = `${pathname}${searchParams?.toString() ? `?${searchParams.toString()}` : ""}`;
		return `/account/sign-in?next=${encodeURIComponent(next)}`;
	}, [pathname, searchParams]);
	const [composerDraft, setComposerDraft] = useState("");
	const [isLoadingOlder, setIsLoadingOlder] = useState(false);
	const [isReconnecting, setIsReconnecting] = useState(false);
	const [isSignedInCustomer, setIsSignedInCustomer] = useState(false);
	const [composeSubjectName, setComposeSubjectName] = useState<string | undefined>(initialOpenDetail?.subjectProductName);
	const composeProductIdRef = useRef<string | undefined>(initialOpenDetail?.subjectProductId);
	const lastActivityAtRef = useRef(0);
	const activeThreadIdRef = useRef<string | null>(null);
	const activeThreadRef = useRef<ChatThread | null>(null);
	const baseTitleRef = useRef<string | null>(null);
	// Server-derived poll cursor — the newest persisted message we've seen.
	const pollCursorRef = useRef<string | null>(null);

	useEffect(() => {
		lastActivityAtRef.current = Date.now();
	}, []);

	useEffect(() => {
		activeThreadIdRef.current = activeThreadId;
		activeThreadRef.current = activeThread;
	}, [activeThreadId, activeThread]);

	const refreshBootstrap = useCallback(async () => {
		try {
			const data = await fetchChatBootstrap();
			setEnabled(data.enabled);
			setSettings(data.settings);
			setIsSignedInCustomer(data.isSignedInCustomer);
			return data;
		} catch (error) {
			setBootstrapError(resolvePublicErrorMessage(error, "Unable to load chat."));
			return null;
		}
	}, []);

	// Initial bootstrap.
	useEffect(() => {
		void (async () => {
			const data = await refreshBootstrap();
			setBootstrapLoaded(true);
			if (!data) return;
			if (initialOpenDetail?.initialBody) {
				setComposerDraft(initialOpenDetail.initialBody);
			}
			setComposeSubjectName(initialOpenDetail?.subjectProductName);
			composeProductIdRef.current = initialOpenDetail?.subjectProductId;
			// One conversation per visitor: open it, or compose the first message.
			if (data.threads.length === 0) {
				setView("compose");
			} else {
				setActiveThreadId(data.threads[0].id);
				setView("thread");
			}
		})();
	}, [refreshBootstrap, initialOpenDetail]);

	// React to auth flips (OTP sign-in / sign-out) without waiting for a tab
	// refocus — re-bootstrap so guest limits swap for the signed-in flow.
	useEffect(() => {
		if (signedInFlag === null) {
			return;
		}
		if (prevSignedInRef.current === null) {
			prevSignedInRef.current = signedInFlag;
			return;
		}
		if (prevSignedInRef.current !== signedInFlag) {
			prevSignedInRef.current = signedInFlag;
			void (async () => {
				const data = await refreshBootstrap();
				if (!data) return;
				const threadId = activeThreadIdRef.current;
				if (threadId && !data.threads.some((thread) => thread.id === threadId)) {
					if (data.threads.length > 0) {
						setActiveThreadId(data.threads[0].id);
					}
				}
			})();
		}
	}, [signedInFlag, refreshBootstrap]);

	// After sign-in redirect, refresh thread so guest gate clears.
	useEffect(() => {
		async function onFocus() {
			const data = await refreshBootstrap();
			if (!data) return;
			const threadId = activeThreadIdRef.current;
			// A guest thread can be merged into the canonical customer thread on
			// sign-in (the guest doc is then gone). Re-point at the surviving thread
			// instead of polling a deleted id; the activeThreadId effect loads it.
			if (threadId && !data.threads.some((thread) => thread.id === threadId)) {
				if (data.threads.length > 0) {
					setActiveThreadId(data.threads[0].id);
				}
				return;
			}
			if (!threadId) return;
			try {
				const thread = await fetchChatThread(threadId);
				pollCursorRef.current = newestServerCreatedAt(thread.messages) ?? pollCursorRef.current;
				// Merge (don't replace) so any older pages already scrolled into view
				// survive the refocus.
				setActiveThread((prev) =>
					prev
						? {
								...thread,
								messages: mergeChatMessagesById(prev.messages, thread.messages),
								hasMoreOlder: prev.hasMoreOlder ?? thread.hasMoreOlder,
							}
						: thread,
				);
			} catch {
				// Keep the current thread; the poll loop recovers on the next tick.
			}
		}
		function handleFocus() {
			void onFocus();
		}
		window.addEventListener("focus", handleFocus);
		return () => window.removeEventListener("focus", handleFocus);
	}, [refreshBootstrap]);

	// Open the chosen thread whenever activeThreadId changes.
	useEffect(() => {
		if (!activeThreadId) return;
		let cancelled = false;
		void (async () => {
			try {
				const thread = await fetchChatThread(activeThreadId);
				if (!cancelled) {
					pollCursorRef.current = newestServerCreatedAt(thread.messages);
					setActiveThread(thread);
				}
			} catch {
				if (!cancelled) setActiveThread(null);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [activeThreadId]);

	useEffect(() => {
		if (!settings) return;
		const transport = createChatTransport({
			pollIntervalMsFocused: settings.pollIntervalMsFocused,
			pollIntervalMsBlurred: settings.pollIntervalMsBlurred,
			onError: () => {
				// A failed tick just means we couldn't reach the server this cycle —
				// surface a subtle "reconnecting" hint; the next tick clears it.
				setIsReconnecting(true);
			},
			onTick: async () => {
				const bootstrap = await fetchChatBootstrap();
				setIsReconnecting(false);
				const threadId = activeThreadIdRef.current;
				if (!threadId) return;
				// Self-heal if the active thread id vanished (e.g. guest→customer
				// merge): switch to the surviving thread rather than poll a 404.
				if (!bootstrap.threads.some((t) => t.id === threadId)) {
					if (bootstrap.threads.length > 0) {
						setActiveThreadId(bootstrap.threads[0].id);
					}
					return;
				}
				const since = pollCursorRef.current ?? bootstrap.threads.find((t) => t.id === threadId)?.lastMessageAt;
				if (since) {
					// Poll returns only messages at/after `since`; merge them into the
					// loaded page so already-shown history (and older pages) stay put.
					const fresh = await pollChatThread(threadId, since, `"${since}"`);
					if (fresh) {
						pollCursorRef.current = newestServerCreatedAt(fresh.messages) ?? pollCursorRef.current;
						const newReply = fresh.messages.some((m) => m.author === "agent" || m.author === "assistant");
						if (newReply && document.hidden) {
							if (!baseTitleRef.current) baseTitleRef.current = document.title;
							document.title = `*New message · ${siteName}`;
						}
						lastActivityAtRef.current = Date.now();
						transport.touch();
						setActiveThread((prev) => {
							if (!prev) return fresh;

							// Deduplicate optimistic messages if the real one arrived via polling
							const prevRealBodies = new Map<string, number>();
							for (const m of prev.messages) {
								if (m.author === "customer" && !m.id.startsWith("local-")) {
									const b = m.body.trim();
									prevRealBodies.set(b, (prevRealBodies.get(b) || 0) + 1);
								}
							}

							const freshRealBodies = new Map<string, number>();
							for (const m of fresh.messages) {
								if (m.author === "customer") {
									const b = m.body.trim();
									freshRealBodies.set(b, (freshRealBodies.get(b) || 0) + 1);
								}
							}

							const newlyArrivedCounts = new Map<string, number>();
							for (const [b, freshCount] of freshRealBodies.entries()) {
								const prevCount = prevRealBodies.get(b) || 0;
								if (freshCount > prevCount) {
									newlyArrivedCounts.set(b, freshCount - prevCount);
								}
							}

							const filteredPrevMessages = prev.messages.filter((m) => {
								if (m.id.startsWith("local-")) {
									const b = m.body.trim();
									const availableToDrop = newlyArrivedCounts.get(b) || 0;
									if (availableToDrop > 0) {
										newlyArrivedCounts.set(b, availableToDrop - 1);
										return false; // Drop this local message, it's covered by a new real one
									}
								}
								return true;
							});

							return {
								...fresh,
								messages: mergeChatMessagesById(filteredPrevMessages, fresh.messages),
								hasMoreOlder: prev.hasMoreOlder ?? fresh.hasMoreOlder,
							};
						});
						markChatThreadRead(threadId).catch(() => undefined);
					}
				} else {
					const fresh = await fetchChatThread(threadId);
					pollCursorRef.current = newestServerCreatedAt(fresh.messages);
					setActiveThread(fresh);
					markChatThreadRead(threadId).catch(() => undefined);
				}
			},
		});
		transport.start();
		// When the tab regains visibility, poll immediately instead of waiting out
		// the (longer) blurred interval — keeps the conversation feeling live.
		function onVisible() {
			if (document.visibilityState === "visible") {
				transport.pollNow();
			}
		}
		document.addEventListener("visibilitychange", onVisible);
		return () => {
			document.removeEventListener("visibilitychange", onVisible);
			transport.stop();
			if (baseTitleRef.current) {
				document.title = baseTitleRef.current;
				baseTitleRef.current = null;
			}
		};
	}, [settings, siteName]);

	async function handleComposeSend(body: string) {
		setBootstrapError(null);
		// Show the customer's message + typing indicator instantly so the first
		// send never feels frozen behind a blank "Starting chat…" screen.
		setPendingFirstMessage(makeOptimisticMessage({ body }));
		setView("starting");
		try {
			const pageContext = getChatPageContext();
			const thread = isSignedInCustomer
				? await startCustomerChatThread()
				: await startAnonymousChatThread({
						subjectProductId: composeProductIdRef.current,
						subjectProductName: composeSubjectName,
					});
			const fresh = await sendChatMessage(thread.id, body, {
				subjectProductId: pageContext.productId || composeProductIdRef.current,
				subjectProductName: pageContext.productName || composeSubjectName,
			});
			lastActivityAtRef.current = Date.now();
			pollCursorRef.current = newestServerCreatedAt(fresh.messages);
			setActiveThreadId(fresh.id);
			// Mount the thread with only the customer's message so the assistant
			// bubbles land as "new" and get the human typing pace (next frame),
			// instead of all appearing at once.
			setActiveThread({
				...fresh,
				messages: fresh.messages.filter((message) => message.author === "customer"),
			});
			setView("thread");
			setPendingFirstMessage(null);
			requestAnimationFrame(() => setActiveThread(fresh));
			void refreshBootstrap();
		} catch (error) {
			setBootstrapError(resolvePublicErrorMessage(error, "Could not start chat."));
			setPendingFirstMessage(null);
			setView("compose");
			throw error;
		}
	}

	async function handleSend(body: string) {
		if (!activeThread) return;
		const optimistic = makeOptimisticMessage({
			body,
			authorName: activeThread.customerName,
		});
		lastActivityAtRef.current = Date.now();
		setActiveThread({
			...activeThread,
			messages: [...activeThread.messages, optimistic],
			lastMessageAt: optimistic.createdAt,
			lastMessagePreview: body.slice(0, 280),
			lastMessageAuthor: "customer",
		});
		try {
			const pageContext = getChatPageContext();
			const fresh = await sendChatMessage(activeThread.id, body, {
				subjectProductId: pageContext.productId,
				subjectProductName: pageContext.productName,
			});
			lastActivityAtRef.current = Date.now();
			pollCursorRef.current = newestServerCreatedAt(fresh.messages) ?? pollCursorRef.current;
			// `fresh` is the recent page; drop the optimistic stub and merge so any
			// older messages already loaded above stay in place.
			setActiveThread((prev) => {
				const base = prev ?? fresh;
				const withoutResolvedOptimistic = base.messages.filter((m) => m.id !== optimistic.id);
				return {
					...fresh,
					messages: mergeChatMessagesById(withoutResolvedOptimistic, fresh.messages),
					hasMoreOlder: base.hasMoreOlder ?? fresh.hasMoreOlder,
				};
			});
			void refreshBootstrap();
		} catch (error) {
			setActiveThread((prev) =>
				prev
					? {
							...prev,
							messages: prev.messages.filter((m) => m.id !== optimistic.id),
						}
					: prev,
			);
			if (error instanceof ChatRequestError && error.code === "login_required") {
				setBootstrapError(resolvePublicErrorMessage(error));
			}
			throw error;
		}
	}

	const loadOlderMessages = useCallback(async () => {
		const thread = activeThreadRef.current;
		if (!thread?.hasMoreOlder || thread.messages.length === 0) {
			return;
		}
		const oldestId = thread.messages[0].id;
		setIsLoadingOlder(true);
		try {
			const older = await fetchOlderChatMessages(thread.id, oldestId);
			setActiveThread((prev) =>
				prev
					? {
							...prev,
							messages: mergeChatMessagesById(older.messages, prev.messages),
							hasMoreOlder: older.hasMoreOlder,
						}
					: prev,
			);
		} catch {
			// Leave the thread as-is; the scroll handler will retry on next scroll.
		} finally {
			setIsLoadingOlder(false);
		}
	}, []);

	const loginRequired =
		activeThread && settings
			? guestChatLoginRequired({
					customerId: activeThread.customerId,
					phoneNumber: activeThread.phoneNumber,
					guestMessageLimit: settings.guestMessageLimit,
					messages: activeThread.messages,
				})
			: false;

	const previewMessagesLeft =
		activeThread && isAnonymousChatPhone(activeThread.phoneNumber) && settings ? Math.max(0, settings.guestMessageLimit - countCustomerChatMessages(activeThread.messages)) : null;

	const supportLabel = customerChatSupportLabel(settings?.assistantName);
	const shellClose = layout === "page" ? undefined : onCollapse;
	const shellLayout = layout;

	if (!bootstrapLoaded) {
		return (
			<ChatShell layout={shellLayout} onClose={shellClose} title={siteName} subtitle="Connecting…">
				<div className="flex flex-1 items-center justify-center text-[length:var(--chat-font-body)] text-[var(--color-ink-500)]">Loading chat…</div>
			</ChatShell>
		);
	}

	if (!enabled) {
		return (
			<ChatShell layout={shellLayout} onClose={shellClose} title={siteName} subtitle="Chat is offline">
				<div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-[length:var(--chat-font-body)] text-[var(--color-ink-500)]">
					<p className="max-w-prose">Chat is currently disabled. Please reach us on WhatsApp.</p>
					<a
						href={buildWhatsAppLink("Salam!", whatsappNumber)}
						target="_blank"
						rel="noopener noreferrer"
						className="rounded-[var(--radius-md)] bg-[var(--color-accent-500)] px-3 py-1.5 text-[length:var(--chat-font-body)] font-semibold text-[var(--color-ink-900)] hover:bg-[var(--color-accent-600)]"
					>
						Open WhatsApp
					</a>
				</div>
			</ChatShell>
		);
	}

	return (
		<ChatShell
			layout={shellLayout}
			onClose={shellClose}
			title={settings?.assistantEnabled ? supportLabel : siteName}
			subtitle={
				isReconnecting
					? "Reconnecting…"
					: view === "thread" && activeThread?.assistantPaused
						? "Team is reviewing — you can still message us"
						: view === "thread" && activeThread
							? statusLabel(activeThread.status)
							: settings?.assistantEnabled
								? "Support chat · replies in seconds"
								: "We typically reply within an hour"
			}
		>
			{bootstrapError && (
				<div className="border-b border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-4 py-2 text-[length:var(--chat-font-small)] text-[var(--color-danger-700)]">{bootstrapError}</div>
			)}
			{view === "starting" && pendingFirstMessage && <StartingConversation message={pendingFirstMessage} />}
			{view === "compose" && (
				<ComposeConversation
					draft={composerDraft}
					onDraftChange={setComposerDraft}
					onSend={handleComposeSend}
					welcomeMessage={isSignedInCustomer ? settings?.welcomeMessageCustomer : settings?.welcomeMessageGuest}
					subjectProductName={composeSubjectName}
					signInHref={signInHref}
					isSignedInCustomer={isSignedInCustomer}
					guestMessageLimit={settings?.guestMessageLimit ?? 5}
				/>
			)}
			{view === "thread" && activeThread && (
				<ThreadConversation
					thread={activeThread}
					onSend={handleSend}
					initialDraft={composerDraft}
					onDraftConsumed={() => setComposerDraft("")}
					loginRequired={loginRequired}
					signInHref={signInHref}
					previewMessagesLeft={previewMessagesLeft}
					guestMessageLimit={settings?.guestMessageLimit ?? 5}
					welcomeMessageGuest={settings?.welcomeMessageGuest}
					welcomeMessageCustomer={settings?.welcomeMessageCustomer}
					assistantEnabled={settings?.assistantEnabled ?? false}
					hasMoreOlder={activeThread.hasMoreOlder ?? false}
					isLoadingOlder={isLoadingOlder}
					onLoadOlder={loadOlderMessages}
				/>
			)}
			<SupportHintFooter assistantEnabled={settings?.assistantEnabled ?? false} assistantPaused={view === "thread" && (activeThread?.assistantPaused ?? false)} />
		</ChatShell>
	);
}

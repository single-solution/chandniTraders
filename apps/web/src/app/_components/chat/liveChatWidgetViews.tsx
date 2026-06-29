"use client";

import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, AlertTriangle, MessageSquare, Send, X } from "lucide-react";

import { CHAT_GUEST_MESSAGE_LIMIT, CHAT_MESSAGE_BODY_MAX, classNames, type ChatMessage, type ChatThread } from "@store/shared";

import { ChatMessageBubble, ChatMessageDayDivider, ChatTypingIndicator, chatWelcomeMessage, groupChatMessagesByDay } from "@/app/_components/chat/chatMessageUi";
import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";

const CHAT_COMPOSER_FORM_CLASS =
	"flex items-end gap-2 border-t border-[var(--color-ink-100)] bg-[var(--color-surface)] px-3 py-2.5 max-md:gap-2.5 max-md:px-3.5 max-md:py-3";
const CHAT_COMPOSER_TEXTAREA_CLASS =
	"box-border max-h-[120px] min-h-[var(--chat-composer-control-h)] min-w-0 flex-1 resize-none rounded-[var(--radius-md)] bg-[var(--color-canvas-deep)] px-3 py-2 max-md:px-3.5 text-[length:var(--chat-font-body)] leading-normal text-[var(--color-ink-800)] placeholder:text-[var(--color-ink-400)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-500)] disabled:opacity-60";
const CHAT_COMPOSER_SEND_CLASS =
	"tap grid h-[var(--chat-composer-control-h)] w-[var(--chat-composer-control-h)] shrink-0 place-items-center self-end rounded-[var(--radius-md)] bg-[var(--color-ink-900)] text-[var(--color-on-dark)] transition-colors enabled:hover:bg-[var(--color-ink-800)] disabled:opacity-40";

const CHAT_COMPOSER_MAX_HEIGHT_PX = 120;

function isMobileChatComposerViewport(): boolean {
	if (typeof window === "undefined") {
		return false;
	}
	return window.matchMedia("(max-width: 39.999rem)").matches;
}

interface ChatComposerProps {
	draft: string;
	onDraftChange: (value: string) => void;
	onSubmit: () => void | Promise<void>;
	sending: boolean;
	placeholder: string;
	ariaLabel: string;
}

function ChatComposer({ draft, onDraftChange, onSubmit, sending, placeholder, ariaLabel }: ChatComposerProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	useLayoutEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) {
			return;
		}
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, CHAT_COMPOSER_MAX_HEIGHT_PX)}px`;
	}, [draft]);

	async function handleFormSubmit(event: React.FormEvent) {
		event.preventDefault();
		await onSubmit();
	}

	function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
		if (event.key !== "Enter") {
			return;
		}
		if (isMobileChatComposerViewport()) {
			return;
		}
		if (event.shiftKey) {
			return;
		}
		event.preventDefault();
		void onSubmit();
	}

	return (
		<form onSubmit={handleFormSubmit} className={CHAT_COMPOSER_FORM_CLASS}>
			<textarea
				ref={textareaRef}
				value={draft}
				onChange={(event) => onDraftChange(event.target.value)}
				onKeyDown={handleKeyDown}
				placeholder={placeholder}
				aria-label={ariaLabel}
				maxLength={CHAT_MESSAGE_BODY_MAX}
				rows={1}
				disabled={sending}
				className={CHAT_COMPOSER_TEXTAREA_CLASS}
			/>
			<button
				type="submit"
				aria-label="Send message"
				disabled={sending || draft.trim().length === 0}
				className={CHAT_COMPOSER_SEND_CLASS}
			>
				{sending ? (
					<span className="block size-3.5 max-md:size-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
				) : (
					<Send className="size-3.5 max-md:size-4" strokeWidth={2.2} />
				)}
			</button>
		</form>
	);
}

/**
 * Human pacing model for bot bubbles (2x faster than the original 20ms/100ms rates).
 * Tables cap lower so long deal/comparison bubbles do not stall the chat.
 */
const STAGGER_GAP_MS = 125;
const TYPING_MS_PER_CHAR = 10;
const READING_MS_PER_CHAR = 50;
const MAX_TYPING_MS = 2500;
const MAX_READING_MS = 1200;

function estimateTypingDelayMs(body: string): number {
	if (/^\|/m.test(body.trim())) {
		return Math.min(1500, 300 + body.length * 4);
	}
	return Math.min(MAX_TYPING_MS, body.length * TYPING_MS_PER_CHAR);
}

function estimateReadingDelayMs(customerBody: string): number {
	return Math.min(MAX_READING_MS, customerBody.length * READING_MS_PER_CHAR);
}

/**
 * First-message bridge: shows the customer's just-sent bubble while the thread
 * is created in the background, so sending the very first message never feels
 * frozen behind a blank "Starting chat…" screen. The typing indicator only
 * appears when the AI assistant is on (it answers in seconds); a human can't
 * reply instantly, so faking "typing…" for human-only chat is misleading.
 */
export function StartingConversation({ message }: { message: ChatMessage }) {
	return (
		<div className="flex-1 space-y-3 overflow-y-auto bg-[var(--color-canvas-deep)] px-3 py-3">
			<ChatMessageBubble message={message} />
			<ChatTypingIndicator label="Connecting you with someone..." />
		</div>
	);
}

export function statusLabel(status: ChatThread["status"]): string {
	switch (status) {
		case "open":
			return "Open — we'll reply soon";
		case "awaiting-customer":
			return "Waiting on you";
		case "resolved":
			return "Resolved · message us anytime to reopen";
	}
}

interface ChatShellProps {
	title: string;
	subtitle: string;
	onClose?: () => void;
	onBack?: () => void;
	layout?: "popover" | "page";
	children: React.ReactNode;
}

export function ChatShell({ title, subtitle, onClose, onBack, layout: _layout = "popover", children }: ChatShellProps) {
	return (
		<div
			role="dialog"
			aria-label={`Chat with ${title}`}
			/* Anchored popover on every breakpoint — the widget appears to
         "lift" out of the floating FAB rather than take over the screen.
         Desktop width uses --desktop-chat-sheet-w; mobile fills the sheet
         inset between header and tab bar. */
			className="chat-widget flex h-full w-full flex-col overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] shadow-[var(--shadow-lg)] md:rounded-[var(--radius-lg)]"
		>
			<header className="flex items-center gap-3 border-b border-[var(--color-accent-200)] bg-[var(--color-accent-50)] px-3 py-3 text-[var(--color-ink-900)]">
				{onBack ? (
					<button
						type="button"
						aria-label="Back to thread list"
						onClick={onBack}
						className="tap grid size-8 shrink-0 place-items-center rounded-[var(--radius-md)] text-[var(--color-ink-700)] hover:bg-[var(--color-ink-900)]/10 hover:text-[var(--color-ink-900)]"
					>
						<ArrowLeft size={16} />
					</button>
				) : (
					<span className="grid size-10 place-items-center rounded-full bg-[var(--color-ink-900)] text-base font-semibold text-[var(--color-accent-500)]">
						<MessageSquare size={16} />
					</span>
				)}
				<div className="min-w-0 flex-1">
					<p className="text-[length:var(--chat-font-body)] font-semibold leading-tight">{title}</p>
					<p className="truncate text-[length:var(--chat-font-small)] leading-tight text-[var(--color-ink-700)]">{subtitle}</p>
				</div>
				{onClose && (
					<button
						type="button"
						aria-label="Close chat"
						onClick={onClose}
						className="tap max-md:hidden grid size-8 place-items-center rounded-[var(--radius-md)] text-[var(--color-ink-700)] hover:bg-[var(--color-ink-900)]/10 hover:text-[var(--color-ink-900)]"
					>
						<X size={16} />
					</button>
				)}
			</header>
			{children}
		</div>
	);
}

interface ThreadConversationProps {
	thread: ChatThread;
	onSend: (body: string) => Promise<void>;
	initialDraft?: string;
	onDraftConsumed?: () => void;
	loginRequired: boolean;
	signInHref: string;
	previewMessagesLeft: number | null;
	guestMessageLimit: number;
	welcomeMessageGuest?: string;
	welcomeMessageCustomer?: string;
	assistantEnabled: boolean;
	hasMoreOlder: boolean;
	isLoadingOlder: boolean;
	onLoadOlder: () => void;
}

const LOAD_OLDER_SCROLL_THRESHOLD_PX = 80;

export function ThreadConversation({
	thread,
	onSend,
	initialDraft = "",
	onDraftConsumed,
	loginRequired,
	signInHref,
	previewMessagesLeft,
	guestMessageLimit,
	welcomeMessageGuest,
	welcomeMessageCustomer,
	assistantEnabled,
	hasMoreOlder,
	isLoadingOlder,
	onLoadOlder,
}: ThreadConversationProps) {
	const messageListRef = useRef<HTMLDivElement>(null);
	const [draft, setDraft] = useState(initialDraft);
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (initialDraft) {
			scheduleStateUpdate(() => {
				setDraft(initialDraft);
				onDraftConsumed?.();
			});
		}
	}, [initialDraft, onDraftConsumed]);

	// ── Staggered reveal ──────────────────────────────────────────────────────
	// The bot can answer in several bubbles. To feel like real texting, reveal
	// the first bubble immediately, then drip the rest one at a time with a
	// typing pause between. Customer/agent messages always show instantly.
	const messagesRef = useRef(thread.messages);
	const revealedIdsRef = useRef<Set<string>>(new Set(thread.messages.map((message) => message.id)));

	useEffect(() => {
		messagesRef.current = thread.messages;
	});
	const queueRef = useRef<string[]>([]);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Reading/comprehension delay to prepend to the first bubble of a reply.
	const readDelayRef = useRef(0);
	const [, bumpReveal] = useReducer((count: number) => count + 1, 0);
	const [botActivity, setBotActivity] = useState<"reading" | "typing" | false>(false);

	const visibleMessages = thread.messages.filter((message) => revealedIdsRef.current.has(message.id));
	const lastVisibleId = visibleMessages[visibleMessages.length - 1]?.id;
	const firstVisibleId = visibleMessages[0]?.id;

	const pump = useCallback(function doPump() {
		const nextId = queueRef.current[0];
		if (nextId === undefined) {
			timerRef.current = null;
			setBotActivity(false);
			return;
		}
		const nextBody = messagesRef.current.find((message) => message.id === nextId)?.body ?? "";
		// The first bubble carries the one-time read/understand beat; the rest
		// only their own typing time.
		const startGap = readDelayRef.current;
		readDelayRef.current = 0;

		const typeAndReveal = () => {
			setBotActivity("typing");
			timerRef.current = setTimeout(() => {
				queueRef.current.shift();
				revealedIdsRef.current.add(nextId);
				bumpReveal();
				setBotActivity(false);
				timerRef.current = setTimeout(() => doPump(), STAGGER_GAP_MS);
			}, estimateTypingDelayMs(nextBody));
		};

		if (startGap > 0) {
			setBotActivity("reading"); // Show activity during reading phase to avoid blank gaps
			timerRef.current = setTimeout(typeAndReveal, startGap);
		} else {
			typeAndReveal();
		}
	}, []);

	useEffect(() => {
		const newOnes = thread.messages.filter((message) => !revealedIdsRef.current.has(message.id) && !queueRef.current.includes(message.id));
		if (newOnes.length === 0) return;

		// Newest already-revealed timestamp: messages older than this are a
		// prepended history page (scroll-up) and must show instantly, never paced.
		let latestRevealedAt = 0;
		for (const message of messagesRef.current) {
			if (revealedIdsRef.current.has(message.id)) {
				latestRevealedAt = Math.max(latestRevealedAt, new Date(message.createdAt).getTime());
			}
		}

		let revealedAny = false;
		for (const message of newOnes) {
			const isHistorical = new Date(message.createdAt).getTime() < latestRevealedAt;
			// Live assistant bubbles are paced (read + type); customer/agent messages
			// and any prepended history always show instantly.
			if (message.author === "assistant" && !isHistorical) {
				queueRef.current.push(message.id);
			} else {
				revealedIdsRef.current.add(message.id);
				revealedAny = true;
			}
		}
		if (revealedAny) bumpReveal();
		if (queueRef.current.length > 0 && !timerRef.current) {
			const lastCustomer = [...messagesRef.current].reverse().find((message) => message.author === "customer");
			readDelayRef.current = estimateReadingDelayMs(lastCustomer?.body ?? "");
			pump();
		}
	}, [thread.messages, pump]);

	useEffect(
		() => () => {
			if (timerRef.current) clearTimeout(timerRef.current);
		},
		[],
	);

	// Whether the reader was near the bottom *before* the latest message
	// arrived. Measuring after render fails for tall replies (a long bot
	// answer pushes the new distance past any threshold), so we record it
	// from scroll events instead and default to pinned.
	const stickToBottomRef = useRef(true);
	// Captured at the moment a scroll-up triggers an older-page load so the
	// viewport can be re-anchored after the prepended messages reflow.
	const olderAnchorRef = useRef<{ height: number; top: number } | null>(null);

	function handleMessageListScroll() {
		const el = messageListRef.current;
		if (!el) return;
		stickToBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
		if (el.scrollTop < LOAD_OLDER_SCROLL_THRESHOLD_PX && hasMoreOlder && !isLoadingOlder) {
			olderAnchorRef.current = { height: el.scrollHeight, top: el.scrollTop };
			onLoadOlder();
		}
	}

	// New bubble (or typing dots) landed: snap to bottom if already pinned.
	// rAF lets attachment/image reflow settle before we measure scrollHeight.
	useEffect(() => {
		const el = messageListRef.current;
		if (!el || !stickToBottomRef.current) return;
		requestAnimationFrame(() => {
			el.scrollTop = el.scrollHeight;
		});
	}, [lastVisibleId, sending, botActivity]);

	// After an older page prepends, keep the viewport on the message the reader
	// was looking at by restoring the pre-load scroll offset.
	useLayoutEffect(() => {
		const el = messageListRef.current;
		const anchor = olderAnchorRef.current;
		if (!el || !anchor) return;
		el.scrollTop = el.scrollHeight - anchor.height + anchor.top;
		olderAnchorRef.current = null;
	}, [firstVisibleId]);

	// Opening a thread (or switching threads) reveals all history instantly and
	// jumps to the newest message.
	useEffect(() => {
		revealedIdsRef.current = new Set(messagesRef.current.map((message) => message.id));
		queueRef.current = [];
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}

		setBotActivity(false);
		bumpReveal();
		const el = messageListRef.current;
		if (!el) return;
		stickToBottomRef.current = true;
		el.scrollTop = el.scrollHeight;
	}, [thread.id]);

	const groupedMessages = groupChatMessagesByDay(visibleMessages);

	async function sendDraft() {
		if (loginRequired || draft.trim().length === 0 || sending) {
			return;
		}
		const body = draft.trim();
		setSending(true);
		setError(null);
		setDraft("");
		try {
			await onSend(body);
		} catch (err) {
			setDraft(body);
			setError(err instanceof Error ? err.message : "Send failed.");
		} finally {
			setSending(false);
		}
	}

	return (
		<>
			{thread.assistantPaused ? <AssistantPausedNotice reason={thread.assistantPauseReason} /> : null}
			<div ref={messageListRef} onScroll={handleMessageListScroll} className="flex-1 space-y-3 overflow-y-auto bg-[var(--color-canvas-deep)] px-3 py-3">
				{(hasMoreOlder || isLoadingOlder) && (
					<div className="flex justify-center py-1">
						<span
							aria-label="Loading earlier messages"
							className={classNames("block size-4 rounded-full border-2 border-[var(--color-ink-300)] border-r-transparent", isLoadingOlder ? "animate-spin" : "opacity-0")}
						/>
					</div>
				)}
				{groupedMessages.map((group) => (
					<div key={group.day} className="space-y-2">
						<ChatMessageDayDivider label={group.day} />
						{group.messages.map((message) => (
							<ChatMessageBubble key={message.id} message={message} />
						))}
					</div>
				))}
				{assistantEnabled && !thread.assistantPaused && botActivity && <ChatTypingIndicator label={botActivity === "reading" ? "Just a moment..." : undefined} />}
				{thread.messages.length === 0 && (
					<div className="rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-4 py-3.5 text-[length:var(--chat-font-body)] leading-relaxed text-[var(--color-ink-600)] shadow-[var(--shadow-sm)]">
						{chatWelcomeMessage({
							audience: thread.customerId ? "customer" : "guest",
							guestMessageLimit,
							welcomeMessageGuest,
							welcomeMessageCustomer,
						})}
					</div>
				)}
			</div>
			{error && <div className="border-t border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-3 py-1.5 text-[length:var(--chat-font-small)] text-[var(--color-danger-700)]">{error}</div>}
			{loginRequired ? (
				<ChatLoginGate signInHref={signInHref} />
			) : (
				<>
					{previewMessagesLeft !== null && previewMessagesLeft <= 2 && (
						<p className="border-t border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] px-3 py-1.5 text-center text-[length:var(--chat-font-small)] text-[var(--color-ink-500)]">
							{previewMessagesLeft === 1 ? "Last preview message — sign in after this to continue." : `${previewMessagesLeft} preview messages left before sign-in.`}
						</p>
					)}
					<ChatComposer
						draft={draft}
						onDraftChange={setDraft}
						onSubmit={sendDraft}
						sending={sending}
						placeholder="Type a message"
						ariaLabel="Type a message"
					/>
				</>
			)}
		</>
	);
}

interface ComposeConversationProps {
	draft: string;
	onDraftChange: (value: string) => void;
	onSend: (body: string) => Promise<void>;
	welcomeMessage?: string;
	subjectProductName?: string;
	signInHref: string;
	isSignedInCustomer: boolean;
	guestMessageLimit: number;
}

export function ComposeConversation({
	draft,
	onDraftChange,
	onSend,
	welcomeMessage,
	subjectProductName,
	signInHref,
	isSignedInCustomer,
	guestMessageLimit,
}: ComposeConversationProps) {
	const [sending, setSending] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function sendDraft() {
		if (draft.trim().length === 0 || sending) {
			return;
		}
		const body = draft.trim();
		setSending(true);
		setError(null);
		onDraftChange("");
		try {
			await onSend(body);
		} catch (err) {
			onDraftChange(body);
			setError(err instanceof Error ? err.message : "Send failed.");
		} finally {
			setSending(false);
		}
	}

	return (
		<>
			<div className="flex-1 space-y-3 overflow-y-auto bg-[var(--color-canvas-deep)] px-3 py-3">
				<div className="rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-4 py-3.5 text-[length:var(--chat-font-body)] leading-relaxed text-[var(--color-ink-600)] shadow-[var(--shadow-sm)]">
					{welcomeMessage ??
						chatWelcomeMessage({
							audience: isSignedInCustomer ? "customer" : "guest",
							guestMessageLimit,
						})}
					{subjectProductName ? <p className="mt-2 font-semibold text-[var(--color-ink-800)]">About: {subjectProductName}</p> : null}
				</div>
			</div>
			{error ? <div className="border-t border-[var(--color-danger-200)] bg-[var(--color-danger-50)] px-3 py-1.5 text-[length:var(--chat-font-small)] text-[var(--color-danger-700)]">{error}</div> : null}
			{!isSignedInCustomer ? (
				<p className="border-t border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] px-3 py-1.5 text-center text-[length:var(--chat-font-small)] text-[var(--color-ink-500)]">
					Guest preview —{" "}
					<Link href={signInHref} className="font-semibold text-[var(--color-accent-700)] underline">
						sign in
					</Link>{" "}
					after a few messages to continue.
				</p>
			) : null}
			<ChatComposer
				draft={draft}
				onDraftChange={onDraftChange}
				onSubmit={sendDraft}
				sending={sending}
				placeholder="Type your first message"
				ariaLabel="Type your first message"
			/>
		</>
	);
}

interface SupportHintFooterProps {
	assistantEnabled: boolean;
	assistantPaused?: boolean;
}

function AssistantPausedNotice(_props: { reason?: ChatThread["assistantPauseReason"] }) {
	return (
		<div
			role="status"
			className="flex items-start gap-2 border-b border-[var(--color-warn-200)] bg-[var(--color-warn-50)] px-3 py-2.5 text-[length:var(--chat-font-small)] leading-relaxed text-[var(--color-warn-900)]"
		>
			<AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
			<span>
				<strong className="font-semibold">Your chat needs personal attention.</strong> Automated help is paused for now — you can still send messages here and our team will follow up as soon as we can.
			</span>
		</div>
	);
}

function ChatLoginGate({ signInHref }: { signInHref: string }) {
	return (
		<div className="border-t border-[var(--color-ink-100)] bg-[var(--color-surface)] px-4 py-4">
			<p className="text-center text-[length:var(--chat-font-body)] font-medium text-[var(--color-ink-800)]">Sign in to keep chatting</p>
			<p className="mx-auto mt-1 max-w-prose text-center text-[length:var(--chat-font-body)] leading-relaxed text-[var(--color-ink-600)]">
				You&apos;ve used your {CHAT_GUEST_MESSAGE_LIMIT} free preview messages. Sign in to continue this conversation and get order updates.
			</p>
			<Link
				href={signInHref}
				className="tap mt-3 flex h-10 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-accent-500)] text-[length:var(--chat-font-body)] font-semibold text-[var(--color-ink-900)] hover:bg-[var(--color-accent-600)]"
			>
				Sign in
			</Link>
		</div>
	);
}

export function SupportHintFooter({ assistantEnabled, assistantPaused = false }: SupportHintFooterProps) {
	return (
		<p className="mx-auto border-t border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] px-4 py-2.5 text-center text-[length:var(--chat-font-small)] leading-relaxed text-[var(--color-ink-600)]">
			<span className="mx-auto block max-w-prose">
				{assistantPaused
					? "Leave your message below — a teammate will read this chat and reply here."
					: assistantEnabled
						? 'Need to speak with our team? Type "speak to someone" and we will join this chat.'
						: "A teammate will reply here as soon as possible."}
			</span>
		</p>
	);
}

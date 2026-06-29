"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Paperclip } from "lucide-react";

import {
	CHAT_GUEST_MESSAGE_LIMIT,
	CHAT_SUPPORT_DISPLAY_NAME,
	classNames,
	convertPipeBulletDealsToMarkdownTable,
	isInternalStorefrontPath,
	resolveChatWelcomeMessage,
	type ChatAttachment,
	type ChatMessage,
	type ChatStatus,
	type ChatThreadSummary,
} from "@store/shared";

/** Formal welcome copy for empty inquiry threads. */
export function chatWelcomeMessage(input: { audience: "guest" | "customer"; guestMessageLimit?: number; welcomeMessageGuest?: string; welcomeMessageCustomer?: string }): string {
	return resolveChatWelcomeMessage({
		audience: input.audience,
		guestMessageLimit: input.guestMessageLimit,
		settings: {
			welcomeMessageGuest: input.welcomeMessageGuest ?? "",
			welcomeMessageCustomer: input.welcomeMessageCustomer ?? "",
		},
	});
}

const CHAT_LINK_CLASS = "font-medium text-[var(--color-accent-700)] underline underline-offset-2 hover:text-[var(--color-accent-800)]";

const MARKDOWN_LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;
const BARE_PATH_PATTERN = /(\/(?:[\w-]+(?:\/[\w-]+)?(?:\?[\w%&.=+-]*)?))/g;
const BOLD_PATTERN = /\*\*([^*]+)\*\*/g;
const TABLE_ROW_PATTERN = /^\|.+\|$/;
const BULLET_LINE_PATTERN = /^\s*[-*]\s+(.+)$/;

function renderInternalLink(href: string, label: string, key: number): ReactNode {
	return (
		<Link key={`chat-link-${key}`} href={href} className={CHAT_LINK_CLASS}>
			{label}
		</Link>
	);
}

function parseMarkdownTableRow(line: string): string[] {
	return line
		.trim()
		.replace(/^\|/, "")
		.replace(/\|$/, "")
		.split("|")
		.map((cell) => cell.trim());
}

function isTableSeparatorRow(cells: string[]): boolean {
	return cells.every((cell) => /^:?-{2,}:?$/.test(cell.replace(/\s/g, "")));
}

function renderInlineSegments(text: string, keyPrefix: string): ReactNode[] {
	const segments: ReactNode[] = [];
	let tokenKey = 0;
	let cursor = 0;

	while (cursor < text.length) {
		MARKDOWN_LINK_PATTERN.lastIndex = cursor;
		BOLD_PATTERN.lastIndex = cursor;
		BARE_PATH_PATTERN.lastIndex = cursor;

		const markdownMatch = MARKDOWN_LINK_PATTERN.exec(text);
		const boldMatch = BOLD_PATTERN.exec(text);
		const bareMatch = BARE_PATH_PATTERN.exec(text);

		const markdownIndex = markdownMatch?.index ?? Number.POSITIVE_INFINITY;
		const boldIndex = boldMatch?.index ?? Number.POSITIVE_INFINITY;
		const bareIndex = bareMatch?.index ?? Number.POSITIVE_INFINITY;
		const nextIndex = Math.min(markdownIndex, boldIndex, bareIndex);

		if (nextIndex === Number.POSITIVE_INFINITY) {
			if (cursor < text.length) {
				segments.push(text.slice(cursor));
			}
			break;
		}

		if (nextIndex > cursor) {
			segments.push(text.slice(cursor, nextIndex));
		}

		if (nextIndex === markdownIndex && markdownMatch) {
			const linkPath = markdownMatch[2]?.trim() ?? "";
			if (isInternalStorefrontPath(linkPath)) {
				segments.push(renderInternalLink(linkPath, markdownMatch[1] ?? linkPath, tokenKey++));
			} else {
				segments.push(markdownMatch[1] ?? "");
			}
			cursor = nextIndex + markdownMatch[0].length;
			continue;
		}

		if (nextIndex === boldIndex && boldMatch) {
			segments.push(
				<strong key={`${keyPrefix}-bold-${tokenKey++}`} className="font-semibold text-[var(--color-ink-900)]">
					{boldMatch[1]}
				</strong>,
			);
			cursor = nextIndex + boldMatch[0].length;
			continue;
		}

		if (bareMatch) {
			const rawPath = bareMatch[1] ?? "";
			const cleanPath = rawPath.replace(/[.,;:)]+$/, "");
			if (isInternalStorefrontPath(cleanPath)) {
				segments.push(renderInternalLink(cleanPath, cleanPath, tokenKey++));
				cursor = nextIndex + cleanPath.length;
			} else {
				segments.push(rawPath);
				cursor = nextIndex + rawPath.length;
			}
		}
	}

	return segments;
}

function ChatMarkdownTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
	return (
		<div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-ink-100)]">
			<table className="w-full min-w-[280px] border-collapse text-left text-[length:var(--chat-font-body)] leading-snug">
				<thead>
					<tr className="border-b border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)]">
						{headers.map((header, index) => (
							<th key={`header-${index}`} className="px-2 py-1.5 font-semibold text-[var(--color-ink-700)]">
								{renderInlineSegments(header, `header-${index}`)}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((row, rowIndex) => (
						<tr key={`row-${rowIndex}`} className="border-b border-[var(--color-ink-50)] last:border-0 even:bg-[var(--color-canvas-deep)]/40">
							{row.map((cell, cellIndex) => (
								<td key={`cell-${rowIndex}-${cellIndex}`} className="px-2 py-1.5 align-top text-[var(--color-ink-800)]">
									{renderInlineSegments(cell, `cell-${rowIndex}-${cellIndex}`)}
								</td>
							))}
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/** Parses markdown tables, bullet lists, bold, and internal links into rich chat blocks. */
function renderRichMessageBody(body: string): ReactNode {
	const normalized = convertPipeBulletDealsToMarkdownTable(body.trim());
	const lines = normalized.split("\n");
	const blocks: ReactNode[] = [];
	let blockKey = 0;
	let cursor = 0;

	while (cursor < lines.length) {
		const line = lines[cursor]?.trim() ?? "";
		if (!line) {
			cursor += 1;
			continue;
		}

		if (TABLE_ROW_PATTERN.test(line)) {
			const tableLines: string[] = [];
			while (cursor < lines.length && TABLE_ROW_PATTERN.test(lines[cursor]?.trim() ?? "")) {
				tableLines.push(lines[cursor]?.trim() ?? "");
				cursor += 1;
			}
			const parsedRows = tableLines.map(parseMarkdownTableRow);
			const headerRow = parsedRows[0];
			const bodyRows = parsedRows.slice(1).filter((row) => !isTableSeparatorRow(row));
			if (headerRow?.length) {
				blocks.push(<ChatMarkdownTable key={`table-${blockKey++}`} headers={headerRow} rows={bodyRows} />);
			}
			continue;
		}

		if (BULLET_LINE_PATTERN.test(lines[cursor] ?? "")) {
			const items: string[] = [];
			while (cursor < lines.length && BULLET_LINE_PATTERN.test(lines[cursor] ?? "")) {
				const match = lines[cursor]?.match(BULLET_LINE_PATTERN);
				if (match?.[1]) {
					items.push(match[1]);
				}
				cursor += 1;
			}
			blocks.push(
				<ul key={`list-${blockKey++}`} className="list-disc space-y-1 pl-4 text-[var(--color-ink-800)]">
					{items.map((item, index) => (
						<li key={`item-${index}`}>{renderInlineSegments(item, `item-${index}`)}</li>
					))}
				</ul>,
			);
			continue;
		}

		const paragraphLines: string[] = [];
		while (cursor < lines.length) {
			const current = lines[cursor]?.trim() ?? "";
			if (!current || TABLE_ROW_PATTERN.test(current) || BULLET_LINE_PATTERN.test(lines[cursor] ?? "")) {
				break;
			}
			paragraphLines.push(current);
			cursor += 1;
		}
		if (paragraphLines.length > 0) {
			blocks.push(
				<p key={`para-${blockKey++}`} className="text-[var(--color-ink-800)]">
					{renderInlineSegments(paragraphLines.join("\n"), `para-${blockKey}`)}
				</p>,
			);
		}
	}

	if (blocks.length === 0) {
		return renderInlineSegments(normalized, "fallback");
	}

	return <div className="space-y-2">{blocks}</div>;
}

export interface ChatMessageDayGroup {
	day: string;
	messages: ChatMessage[];
}

export function chatThreadTitle(thread: Pick<ChatThreadSummary, "subjectProductName" | "customerName">): string {
	return thread.subjectProductName?.trim() || "Support chat";
}

export function chatStatusMeta(status: ChatStatus): {
	label: string;
	pillClass: string;
	dotClass: string;
} {
	switch (status) {
		case "open":
			return {
				label: "Active",
				pillClass: "bg-[var(--color-success-50)] text-[var(--color-success-800)] ring-1 ring-inset ring-[var(--color-success-200)]",
				dotClass: "bg-[var(--color-success-500)]",
			};
		case "awaiting-customer":
			return {
				label: "Reply needed",
				pillClass: "bg-[var(--color-warn-50)] text-[var(--color-warn-800)] ring-1 ring-inset ring-[var(--color-warn-200)]",
				dotClass: "bg-[var(--color-warn-500)]",
			};
		case "resolved":
			return {
				label: "Resolved",
				pillClass: "bg-[var(--color-canvas-deep)] text-[var(--color-ink-600)] ring-1 ring-inset ring-[var(--color-ink-200)]",
				dotClass: "bg-[var(--color-ink-400)]",
			};
	}
}

export function formatChatDayLabel(iso: string): string {
	const messageDate = new Date(iso);
	const today = new Date();
	const yesterday = new Date(today);
	yesterday.setDate(today.getDate() - 1);
	const sameDay = (dateLeft: Date, dateRight: Date) =>
		dateLeft.getFullYear() === dateRight.getFullYear() && dateLeft.getMonth() === dateRight.getMonth() && dateLeft.getDate() === dateRight.getDate();
	if (sameDay(messageDate, today)) return "Today";
	if (sameDay(messageDate, yesterday)) return "Yesterday";
	return messageDate.toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
	});
}

export function groupChatMessagesByDay(messages: ChatMessage[]): ChatMessageDayGroup[] {
	const groups: ChatMessageDayGroup[] = [];
	let current: ChatMessageDayGroup | undefined;
	for (const message of messages) {
		const day = formatChatDayLabel(message.createdAt);
		if (!current || current.day !== day) {
			current = { day, messages: [] };
			groups.push(current);
		}
		current.messages.push(message);
	}
	return groups;
}

export function ChatMessageDayDivider({ label }: { label: string }) {
	return (
		<div className="flex justify-center py-1">
			<span className="rounded-[var(--radius-full)] bg-[var(--color-surface)] px-3 py-1 text-[length:var(--chat-font-meta)] font-medium uppercase tracking-[0.18em] text-[var(--color-ink-500)] shadow-[var(--shadow-sm)]">
				{label}
			</span>
		</div>
	);
}

/** Three-dot "support is typing" bubble shown while awaiting an assistant reply. */
export function ChatTypingIndicator({ label }: { label?: string }) {
	return (
		<div className="chat-msg-in flex justify-start">
			<div className="flex items-center gap-2 rounded-[var(--radius-lg)] rounded-tl-sm border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-3.5 py-3 shadow-[var(--shadow-sm)]">
				<span className="text-[length:var(--chat-font-body)] font-medium text-[var(--color-ink-500)]">{label ?? `${CHAT_SUPPORT_DISPLAY_NAME} is typing`}</span>
				<span className="flex items-center gap-1">
					<span className="size-1.5 animate-bounce rounded-full bg-[var(--color-ink-400)] [animation-delay:-0.3s]" />
					<span className="size-1.5 animate-bounce rounded-full bg-[var(--color-ink-400)] [animation-delay:-0.15s]" />
					<span className="size-1.5 animate-bounce rounded-full bg-[var(--color-ink-400)]" />
				</span>
			</div>
		</div>
	);
}

interface ChatMessageBubbleProps {
	message: ChatMessage;
	/** Wider bubbles on full-page chat vs the floating widget. */
	variant?: "widget" | "page";
}

export function ChatMessageBubble({ message, variant = "widget" }: ChatMessageBubbleProps) {
	const isCustomer = message.author === "customer";
	const isAssistant = message.author === "assistant";
	const attachments = message.attachments ?? [];
	const maxWidth = variant === "page" ? "max-w-[min(560px,82%)]" : "max-w-[78%]";
	const teamLabel = isAssistant ? CHAT_SUPPORT_DISPLAY_NAME : message.authorName;

	return (
		<div className={classNames("chat-msg-in flex", isCustomer ? "justify-end" : "justify-start")}>
			<div
				className={classNames(
					maxWidth,
					"whitespace-pre-line rounded-[var(--radius-lg)] px-3.5 py-2.5 text-[length:var(--chat-font-body)] leading-relaxed shadow-[var(--shadow-sm)]",
					isCustomer
						? "rounded-tr-sm border border-[var(--color-accent-300)] bg-[var(--color-accent-50)] text-[var(--color-ink-800)]"
						: "rounded-tl-sm border border-[var(--color-ink-100)] bg-[var(--color-surface)] text-[var(--color-ink-800)]",
				)}
			>
				{teamLabel && !isCustomer && (
					<p className={classNames("mb-1 text-[length:var(--chat-font-caption)] font-semibold uppercase tracking-wide", isAssistant ? "text-[var(--color-ink-700)]" : "text-[var(--color-ink-500)]")}>
						{teamLabel}
					</p>
				)}
				{attachments.length > 0 && (
					<div className="mb-1.5 flex flex-col gap-1.5">
						{attachments.map((attachment, index) => (
							<ChatAttachmentPreview key={`${message.id}-att-${index}`} attachment={attachment} />
						))}
					</div>
				)}
				{message.body.trim().length > 0 && <div>{renderRichMessageBody(message.body)}</div>}
				<p className={classNames("mt-1 text-[length:var(--chat-font-meta)]", isCustomer ? "text-[var(--color-ink-500)]" : "text-[var(--color-ink-500)]")}>
					{new Date(message.createdAt).toLocaleTimeString(undefined, {
						hour: "numeric",
						minute: "2-digit",
					})}
				</p>
			</div>
		</div>
	);
}

function ChatAttachmentPreview({ attachment }: { attachment: ChatAttachment }) {
	if (attachment.kind === "image") {
		const thumb = attachment.image?.variants?.thumb || attachment.image?.variants?.card;
		const full = attachment.image?.variants?.full || attachment.image?.variants?.detail;
		return (
			<a href={full} target="_blank" rel="noopener noreferrer" className="block max-w-[240px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-ink-100)]">
				<Image
					src={thumb!}
					width={240}
					height={240}
					alt={attachment.image?.alt ?? "Attached image"}
					placeholder={attachment.image?.blurDataURL ? "blur" : undefined}
					blurDataURL={attachment.image?.blurDataURL ?? undefined}
					className="block h-auto w-full object-cover"
					unoptimized
				/>
			</a>
		);
	}
	const sizeKb = Math.max(1, Math.round(attachment.sizeBytes / 1024));
	return (
		<a
			href={attachment.url}
			target="_blank"
			rel="noopener noreferrer"
			className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-canvas-deep)] px-2.5 py-1.5 text-[length:var(--chat-font-body)] font-medium text-[var(--color-ink-800)] hover:bg-[var(--color-accent-50)]"
		>
			<Paperclip size={12} />
			<span className="max-w-[180px] truncate">{attachment.filename}</span>
			<span className="text-[length:var(--chat-font-meta)] text-[var(--color-ink-500)]">{sizeKb} KB</span>
		</a>
	);
}

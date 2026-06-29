"use client";

import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { Bold, Italic, Link2, List, ListOrdered, Pilcrow, Underline } from "lucide-react";
import { classNames } from "@store/shared";

interface RichHtmlEditorProps {
	value: string;
	onChange: (html: string) => void;
	disabled?: boolean;
	placeholder?: string;
}

function ToolbarButton({ label, onClick, children, disabled }: { label: string; onClick: () => void; children: ReactNode; disabled?: boolean }) {
	return (
		<button
			type="button"
			aria-label={label}
			disabled={disabled}
			onMouseDown={(event) => {
				event.preventDefault();
				onClick();
			}}
			className="tap grid size-8 place-items-center rounded-[var(--radius-sm)] text-[var(--color-ink-600)] transition-colors hover:bg-[var(--color-ink-100)] hover:text-[var(--color-ink-900)] disabled:cursor-not-allowed disabled:opacity-40"
		>
			{children}
		</button>
	);
}

export function RichHtmlEditor({ value, onChange, disabled, placeholder }: RichHtmlEditorProps) {
	const editorRef = useRef<HTMLDivElement>(null);
	const lastEmittedRef = useRef(value);

	const syncFromDom = useCallback(() => {
		const next = editorRef.current?.innerHTML ?? "";
		if (next !== lastEmittedRef.current) {
			lastEmittedRef.current = next;
			onChange(next);
		}
	}, [onChange]);

	useEffect(() => {
		const node = editorRef.current;
		if (!node || node.innerHTML === value) {
			return;
		}
		node.innerHTML = value;
		lastEmittedRef.current = value;
	}, [value]);

	function runCommand(command: string, commandValue?: string) {
		if (disabled) {
			return;
		}
		editorRef.current?.focus();
		document.execCommand(command, false, commandValue);
		syncFromDom();
	}

	function handleLink() {
		if (disabled) {
			return;
		}
		const url = window.prompt("Link URL");
		if (!url?.trim()) {
			return;
		}
		runCommand("createLink", url.trim());
	}

	return (
		<div className={classNames("overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-canvas)]", disabled && "opacity-60")}>
			<div className="flex flex-wrap items-center gap-0.5 border-b border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] px-2 py-1.5">
				<ToolbarButton label="Bold" onClick={() => runCommand("bold")} disabled={disabled}>
					<Bold size={15} />
				</ToolbarButton>
				<ToolbarButton label="Italic" onClick={() => runCommand("italic")} disabled={disabled}>
					<Italic size={15} />
				</ToolbarButton>
				<ToolbarButton label="Underline" onClick={() => runCommand("underline")} disabled={disabled}>
					<Underline size={15} />
				</ToolbarButton>
				<ToolbarButton label="Paragraph" onClick={() => runCommand("formatBlock", "p")} disabled={disabled}>
					<Pilcrow size={15} />
				</ToolbarButton>
				<ToolbarButton label="Bullet list" onClick={() => runCommand("insertUnorderedList")} disabled={disabled}>
					<List size={15} />
				</ToolbarButton>
				<ToolbarButton label="Numbered list" onClick={() => runCommand("insertOrderedList")} disabled={disabled}>
					<ListOrdered size={15} />
				</ToolbarButton>
				<ToolbarButton label="Insert link" onClick={handleLink} disabled={disabled}>
					<Link2 size={15} />
				</ToolbarButton>
			</div>
			<div
				ref={editorRef}
				contentEditable={!disabled}
				role="textbox"
				aria-multiline
				suppressContentEditableWarning
				data-placeholder={placeholder}
				onInput={syncFromDom}
				onBlur={syncFromDom}
				className="policy-rich-editor min-h-[220px] max-h-[50vh] overflow-y-auto px-4 py-3 text-[14px] leading-relaxed text-[var(--color-ink-800)] outline-none [&:empty]:before:pointer-events-none [&:empty]:before:text-[var(--color-ink-400)] [&:empty]:before:content-[attr(data-placeholder)] [&_a]:text-[var(--color-accent-700)] [&_a]:underline [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold [&_li]:my-1 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-2 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5"
			/>
		</div>
	);
}

"use client";

import { forwardRef, useRef, type ClipboardEvent, type KeyboardEvent } from "react";
import { classNames } from "@store/shared";

export interface OtpInputProps {
	value: string;
	onChange: (value: string) => void;
	length: number;
	label?: string;
	error?: string | null;
	disabled?: boolean;
	autoFocus?: boolean;
	onComplete?: (value: string) => void;
}

const NON_DIGIT_REGEX = /\D/g;

export const OtpInput = forwardRef<HTMLInputElement, OtpInputProps>(function OtpInput({ value, onChange, length, label, error, disabled, autoFocus, onComplete }, ref) {
	const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

	function focusAt(index: number) {
		const target = inputsRef.current[Math.max(0, Math.min(index, length - 1))];
		target?.focus();
		target?.select();
	}

	function commit(next: string) {
		onChange(next);
		if (next.length === length && !next.includes(" ")) {
			onComplete?.(next);
		}
	}

	function setDigit(index: number, digit: string) {
		const chars = value.padEnd(length, " ").split("");
		chars[index] = digit || " ";
		commit(chars.join("").replace(/\s+$/, ""));
	}

	function handleChange(index: number, raw: string) {
		const digits = raw.replace(NON_DIGIT_REGEX, "");
		if (!digits) {
			setDigit(index, "");
			return;
		}
		// Typing into a box with multiple chars (e.g. autofill) spreads forward.
		const chars = value.padEnd(length, " ").split("");
		let cursor = index;
		for (const digit of digits) {
			if (cursor >= length) {
				break;
			}
			chars[cursor] = digit;
			cursor += 1;
		}
		commit(chars.join("").replace(/\s+$/, ""));
		focusAt(cursor);
	}

	function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === "Backspace") {
			event.preventDefault();
			if (value[index]?.trim()) {
				setDigit(index, "");
				return;
			}
			setDigit(index - 1, "");
			focusAt(index - 1);
			return;
		}
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			focusAt(index - 1);
			return;
		}
		if (event.key === "ArrowRight") {
			event.preventDefault();
			focusAt(index + 1);
		}
	}

	function handlePaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
		event.preventDefault();
		const pasted = event.clipboardData.getData("text").replace(NON_DIGIT_REGEX, "");
		if (!pasted) {
			return;
		}
		const chars = value.padEnd(length, " ").split("");
		let cursor = index;
		for (const digit of pasted) {
			if (cursor >= length) {
				break;
			}
			chars[cursor] = digit;
			cursor += 1;
		}
		commit(chars.join("").replace(/\s+$/, ""));
		focusAt(cursor);
	}

	return (
		<div>
			{label && <span className="mb-2 block text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">{label}</span>}
			<div className="flex items-center justify-center gap-1.5 sm:gap-2" role="group" aria-label={label}>
				{Array.from({ length }).map((_, index) => {
					const digit = value[index]?.trim() ?? "";
					const filled = Boolean(digit);
					return (
						<input
							key={index}
							ref={(element) => {
								inputsRef.current[index] = element;
								if (index === 0) {
									if (typeof ref === "function") {
										ref(element);
									} else if (ref) {
										ref.current = element;
									}
								}
							}}
							type="text"
							inputMode="numeric"
							autoComplete={index === 0 ? "one-time-code" : "off"}
							aria-label={`Digit ${index + 1}`}
							aria-invalid={Boolean(error)}
							maxLength={1}
							value={digit}
							disabled={disabled}
							autoFocus={autoFocus && index === 0}
							onChange={(event) => handleChange(index, event.target.value)}
							onKeyDown={(event) => handleKeyDown(index, event)}
							onPaste={(event) => handlePaste(index, event)}
							onFocus={(event) => event.target.select()}
							className={classNames(
								"size-10 shrink-0 rounded-[var(--radius-md)] border text-center font-mono text-base font-semibold tabular-nums transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:bg-[var(--color-canvas-deep)] disabled:text-[var(--color-ink-500)] sm:size-11 sm:text-lg",
								error
									? "border-[var(--color-danger-300)] bg-[var(--color-canvas)] text-[var(--color-danger-900)] focus:border-[var(--color-danger-500)] focus:ring-[var(--color-danger-500)]/30"
									: filled
										? "border-[var(--color-accent-400)] bg-[var(--color-accent-50)] text-[var(--color-ink-900)] focus:border-[var(--color-accent-500)] focus:ring-[var(--color-accent-500)]/30"
										: "border-[var(--color-ink-100)] bg-[var(--color-canvas)] text-[var(--color-ink-900)] focus:border-[var(--color-accent-500)] focus:ring-[var(--color-accent-500)]/30",
							)}
						/>
					);
				})}
			</div>
			{error && (
				<span role="alert" className="mt-2 block text-center text-[12.5px] font-medium text-[var(--color-danger-700)]">
					{error}
				</span>
			)}
		</div>
	);
});

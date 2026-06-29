"use client";

import { useCallback, useState } from "react";
import { Minus, Plus } from "lucide-react";

import { classNames } from "@store/shared";

interface QuantityStepperProps {
	quantity: number;
	max: number;
	min?: number;
	onChange: (quantity: number) => void;
	size?: "sm" | "md";
	className?: string;
}

function clampQuantity(value: number, min: number, max: number): number {
	if (!Number.isFinite(value) || max <= 0) {
		return 0;
	}
	return Math.min(max, Math.max(min, Math.floor(value)));
}

export function QuantityStepper({ quantity, max, min = 1, onChange, size = "md", className }: QuantityStepperProps) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(String(quantity));
	const atMin = quantity <= min;
	const atMax = max <= 0 || quantity >= max;

	const decrement = useCallback(() => {
		onChange(clampQuantity(quantity - 1, min, max));
	}, [max, min, onChange, quantity]);

	const increment = useCallback(() => {
		onChange(clampQuantity(quantity + 1, min, max));
	}, [max, min, onChange, quantity]);

	const commitDraft = () => {
		const parsed = Number.parseInt(draft, 10);
		if (!Number.isFinite(parsed)) {
			onChange(clampQuantity(quantity, min, max));
			return;
		}
		onChange(clampQuantity(parsed, min, max));
	};

	const isMd = size === "md";

	const handleFocus = useCallback(() => {
		setEditing(true);
		setDraft(String(quantity));
	}, [quantity]);

	const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setDraft(event.target.value.replace(/\D/g, ""));
	}, []);

	const handleBlur = useCallback(() => {
		commitDraft();
		setEditing(false);
	}, [commitDraft]);

	const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.currentTarget.blur();
		}
	}, []);

	return (
		<div
			className={classNames(
				"inline-flex shrink-0 items-center overflow-hidden rounded-full border border-[var(--color-ink-100)] bg-[var(--color-surface)]",
				isMd ? "h-10 md:h-11" : "h-7 md:h-8",
				className,
			)}
		>
			<button
				type="button"
				disabled={atMin}
				aria-label="Decrease quantity"
				onClick={decrement}
				className={classNames(
					"tap focus-ring-inset grid h-full place-items-center text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-canvas-deep)]",
					isMd ? "w-9 md:w-10" : "w-7 md:w-8",
					"disabled:cursor-not-allowed disabled:text-[var(--color-ink-300)] disabled:hover:bg-transparent",
				)}
			>
				<Minus size={isMd ? 14 : 12} />
			</button>
			<input
				type="text"
				inputMode="numeric"
				pattern="[0-9]*"
				aria-label="Quantity"
				value={editing ? draft : String(quantity)}
				onFocus={handleFocus}
				onChange={handleChange}
				onBlur={handleBlur}
				onKeyDown={handleKeyDown}
				className={classNames(
					"h-full border-x border-[var(--color-ink-100)] bg-transparent text-center font-semibold tabular-nums text-[var(--color-ink-900)] outline-none focus:bg-[var(--color-canvas-deep)]",
					isMd ? "min-w-[40px] max-w-[72px] text-[13px] md:min-w-[44px] md:text-sm" : "min-w-[32px] max-w-[56px] text-[12px]",
				)}
			/>
			<button
				type="button"
				disabled={atMax}
				aria-label="Increase quantity"
				onClick={increment}
				className={classNames(
					"tap focus-ring-inset grid h-full place-items-center text-[var(--color-ink-700)] transition-colors hover:bg-[var(--color-canvas-deep)]",
					isMd ? "w-9 md:w-10" : "w-7 md:w-8",
					"disabled:cursor-not-allowed disabled:text-[var(--color-ink-300)] disabled:hover:bg-transparent",
				)}
			>
				<Plus size={isMd ? 14 : 12} />
			</button>
		</div>
	);
}

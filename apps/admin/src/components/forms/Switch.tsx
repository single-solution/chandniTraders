"use client";

import { useState } from "react";
import { classNames } from "@store/shared";
import { Toggle } from "@/components/ui/Toggle";

interface SwitchProps {
	label: string;
	description?: string;
	defaultChecked?: boolean;
	/** Controlled value. If provided, `defaultChecked` is ignored. */
	checked?: boolean;
	/** Fires whenever the toggle changes. Use with `checked`. */
	onCheckedChange?: (checked: boolean) => void;
	name?: string;
	disabled?: boolean;
}

export function Switch({ label, description, defaultChecked = false, checked, onCheckedChange, name, disabled = false }: SwitchProps) {
	const isControlled = checked !== undefined;
	const [internalChecked, setInternalChecked] = useState(defaultChecked);
	const isChecked = isControlled ? checked : internalChecked;

	function handleChange(next: boolean) {
		if (!isControlled) {
			setInternalChecked(next);
		}
		onCheckedChange?.(next);
	}

	return (
		<label
			className={classNames(
				"reveal animate-in flex items-start justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] px-3 py-2.5",
				disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
			)}
		>
			<div className="min-w-0">
				<p className="text-sm font-medium text-[var(--color-ink-900)]">{label}</p>
				{Boolean(description) && <p className="mt-0.5 text-xs text-[var(--color-ink-500)]">{description}</p>}
			</div>
			<Toggle checked={isChecked} onCheckedChange={handleChange} disabled={disabled} aria-label={label} />
			{Boolean(name) && <input type="checkbox" name={name} checked={isChecked} readOnly className="sr-only" />}
		</label>
	);
}

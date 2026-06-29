"use client";

import { useRef, useState, type ReactNode } from "react";
import { Layers, MoreVertical, Pencil, Sparkles, Trash2 } from "lucide-react";
import { classNames } from "@store/shared";

import { Popover } from "@/components/ui/Popover";

interface ProductRowEditMenuProps {
	canUpdate: boolean;
	canDelete: boolean;
	onEditProduct: () => void;
	onManageVariants: () => void;
	onEditSeo: () => void;
	onDelete: () => void;
}

export function ProductRowEditMenu({ canUpdate, canDelete, onEditProduct, onManageVariants, onEditSeo, onDelete }: ProductRowEditMenuProps) {
	const [open, setOpen] = useState(false);
	const rootRef = useRef<HTMLDivElement>(null);

	if (!canUpdate && !canDelete) {
		return null;
	}

	function runAction(action: () => void) {
		setOpen(false);
		action();
	}

	return (
		<div ref={rootRef} className="relative flex justify-end">
			<button
				type="button"
				aria-expanded={open}
				aria-haspopup="menu"
				aria-label="Product actions"
				title="Product actions"
				onClick={() => setOpen((current) => !current)}
				className={classNames(
					"grid size-7 place-items-center rounded-[var(--radius-md)] text-[var(--color-ink-500)] transition-colors hover:bg-[var(--color-canvas-deep)] hover:text-[var(--color-ink-800)]",
					open && "bg-[var(--color-canvas-deep)] text-[var(--color-ink-900)]",
				)}
			>
				<MoreVertical size={16} strokeWidth={2.2} aria-hidden />
			</button>

			<Popover
				isOpen={open}
				anchorRef={rootRef}
				onRequestClose={() => setOpen(false)}
				role="menu"
				aria-label="Product actions"
				align="right"
				className="animate-popover-in w-44 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-ink-100)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-lg)]"
			>
				<ul className="flex flex-col gap-0.5">
					{canUpdate ? (
						<>
							<MenuItem icon={<Pencil size={13} aria-hidden />} label="Edit product" onClick={() => runAction(onEditProduct)} />
							<MenuItem icon={<Layers size={13} aria-hidden />} label="Manage variants" onClick={() => runAction(onManageVariants)} />
							<MenuItem icon={<Sparkles size={13} aria-hidden />} label="Edit SEO" onClick={() => runAction(onEditSeo)} />
						</>
					) : null}
					{canDelete ? (
						<>
							{canUpdate ? <li className="my-0.5 border-t border-[var(--color-ink-100)]" aria-hidden /> : null}
							<MenuItem icon={<Trash2 size={13} aria-hidden />} label="Delete product" tone="danger" onClick={() => runAction(onDelete)} />
						</>
					) : null}
				</ul>
			</Popover>
		</div>
	);
}

function MenuItem({ icon, label, onClick, tone = "default" }: { icon: ReactNode; label: string; onClick: () => void; tone?: "default" | "danger" }) {
	return (
		<li>
			<button
				type="button"
				role="menuitem"
				onClick={onClick}
				className={classNames(
					"flex w-full items-center gap-2 rounded-[var(--radius-md)] px-2 py-1.5 text-left text-[12px] font-semibold transition-colors",
					tone === "danger" ? "text-[var(--color-rose-700)] hover:bg-[var(--color-rose-50)]" : "text-[var(--color-ink-800)] hover:bg-[var(--color-canvas-deep)]",
				)}
			>
				{icon}
				{label}
			</button>
		</li>
	);
}

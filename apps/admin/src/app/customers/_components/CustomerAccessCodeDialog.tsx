"use client";

import { useState } from "react";
import { Check, Copy, KeyRound } from "lucide-react";
import { Button } from "@store/ui";
import { Drawer } from "@/components/ui/Drawer";
import { useToast } from "@/components/ui/Toast";

interface CustomerAccessCodeDialogProps {
	isOpen: boolean;
	customerName: string;
	phoneNumber: string;
	code: string;
	expiresInMinutes: number;
	onClose: () => void;
}

export function CustomerAccessCodeDialog({ isOpen, customerName, phoneNumber, code, expiresInMinutes, onClose }: CustomerAccessCodeDialogProps) {
	const toast = useToast();
	const [copied, setCopied] = useState(false);

	async function copyCode() {
		try {
			await navigator.clipboard.writeText(code);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1_500);
		} catch {
			toast.danger("Could not copy the code");
		}
	}

	return (
		<Drawer
			isOpen={isOpen}
			onClose={onClose}
			title="Sign-in code"
			description={`Read this code to ${customerName}. They enter their phone number and this code on the storefront sign-in.`}
			width="sm"
			footer={
				<div className="flex items-center justify-end">
					<Button variant="primary" size="md" type="button" onClick={onClose}>
						Done
					</Button>
				</div>
			}
		>
			<div className="space-y-4">
				<div className="flex flex-col items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] px-4 py-6 text-center">
					<span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--color-ink-500)]">
						<KeyRound size={12} /> One-time code
					</span>
					<span className="font-mono text-[2rem] font-bold tracking-[0.35em] text-[var(--color-ink-900)]">{code}</span>
					<Button variant="outline" size="sm" type="button" leadingIcon={copied ? <Check size={13} /> : <Copy size={13} />} onClick={() => void copyCode()}>
						{copied ? "Copied" : "Copy code"}
					</Button>
				</div>
				<ul className="space-y-1.5 text-xs leading-relaxed text-[var(--color-ink-600)]">
					<li>
						<span className="text-[var(--color-ink-500)]">Phone:</span> <span className="font-semibold text-[var(--color-ink-800)]">{phoneNumber}</span>
					</li>
					<li>
						Valid for <strong>{expiresInMinutes} minutes</strong>, single use. Issuing a new code cancels this one.
					</li>
					<li>Never share codes over insecure channels — read it directly to the customer.</li>
				</ul>
			</div>
		</Drawer>
	);
}

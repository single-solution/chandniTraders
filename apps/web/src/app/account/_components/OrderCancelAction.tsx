"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { isCustomerCancellableOrderStatus } from "@store/shared";
import { Button } from "@store/ui";

interface OrderCancelActionProps {
	orderNumber: string;
	status: string;
}

export function OrderCancelAction({ orderNumber, status }: OrderCancelActionProps) {
	const router = useRouter();
	const [isCancelling, setIsCancelling] = useState(false);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);

	if (!isCustomerCancellableOrderStatus(status)) {
		return null;
	}

	async function handleCancel() {
		if (isCancelling) {
			return;
		}

		const confirmed = window.confirm("Cancel this order? Reserved stock will be released and any redeemed points will be returned to your balance.");
		if (!confirmed) {
			return;
		}

		setIsCancelling(true);
		setErrorMessage(null);

		try {
			const response = await fetch(`/api/orders/${encodeURIComponent(orderNumber)}/cancel`, { method: "POST" });
			const data = (await response.json().catch(() => null)) as { error?: string } | null;

			if (!response.ok) {
				setErrorMessage(data?.error ?? "Could not cancel this order. Please try again or message us on WhatsApp.");
				setIsCancelling(false);
				return;
			}

			router.refresh();
		} catch {
			setErrorMessage("Could not cancel this order. Please try again or message us on WhatsApp.");
			setIsCancelling(false);
		}
	}

	return (
		<div className="space-y-2">
			<Button type="button" variant="outline" size="sm" onClick={() => void handleCancel()} isLoading={isCancelling} leadingIcon={<XCircle size={14} />}>
				Cancel order
			</Button>
			{errorMessage ? <p className="text-[12px] text-[var(--color-danger-700)]">{errorMessage}</p> : null}
		</div>
	);
}

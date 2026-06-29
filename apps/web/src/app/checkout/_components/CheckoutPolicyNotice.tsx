"use client";

import { useState } from "react";
import { useStoreSettings } from "@/lib/core/storeSettingsContext";
import { PolicyDocumentModal } from "@/components/shared/PolicyDocumentModal";

type PolicyKind = "return" | "privacy";

export function CheckoutPolicyNotice() {
	const settings = useStoreSettings();
	const [openPolicy, setOpenPolicy] = useState<PolicyKind | null>(null);

	return (
		<>
			<p className="text-center text-[12px] leading-snug text-[var(--color-ink-600)] md:text-[12.5px]">
				By placing this order you automatically agree to our{" "}
				<button
					type="button"
					onClick={() => setOpenPolicy("return")}
					className="link-underline font-medium text-[var(--color-accent-700)] hover:text-[var(--color-accent-800)]"
				>
					return policy
				</button>{" "}
				and{" "}
				<button
					type="button"
					onClick={() => setOpenPolicy("privacy")}
					className="link-underline font-medium text-[var(--color-accent-700)] hover:text-[var(--color-accent-800)]"
				>
					privacy policy
				</button>
				.
			</p>

			<PolicyDocumentModal
				isOpen={openPolicy === "return"}
				onClose={() => setOpenPolicy(null)}
				title="Return policy"
				html={settings.returnPolicyHtml}
			/>
			<PolicyDocumentModal
				isOpen={openPolicy === "privacy"}
				onClose={() => setOpenPolicy(null)}
				title="Privacy policy"
				html={settings.privacyPolicyHtml}
			/>
		</>
	);
}

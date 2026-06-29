/** Thread status values aligned with `Inquiry` model / storefront chat. */
export type InquiryThreadStatus = "open" | "awaiting-customer" | "resolved";

export function nextInquiryStatusAfterCustomerMessage(current: InquiryThreadStatus): InquiryThreadStatus | null {
	if (current === "resolved") {
		return "open";
	}
	return null;
}

export function nextInquiryStatusAfterTeamMessage(current: InquiryThreadStatus): InquiryThreadStatus | null {
	if (current === "open") {
		return "awaiting-customer";
	}
	return null;
}

/** Status patch for `$set` when a message is posted (empty object if unchanged). */
export function inquiryStatusPatchAfterMessage(current: InquiryThreadStatus, author: "customer" | "team" | "assistant"): { status?: InquiryThreadStatus } {
	const next = author === "customer" ? nextInquiryStatusAfterCustomerMessage(current) : nextInquiryStatusAfterTeamMessage(current);
	return next ? { status: next } : {};
}

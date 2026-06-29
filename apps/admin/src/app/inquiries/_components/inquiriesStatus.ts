import type { StatusTone } from "@/components/shared/StatusPill";
import type { AdminInquiryStatus } from "@/types/models";

export const STATUS_TONE: Record<AdminInquiryStatus, StatusTone> = {
	open: "info",
	"awaiting-customer": "warn",
	resolved: "success",
};

export const STATUS_LABELS: Record<AdminInquiryStatus, string> = {
	open: "Open",
	"awaiting-customer": "Awaiting customer",
	resolved: "Resolved",
};

export const STATUS_OPTIONS: readonly AdminInquiryStatus[] = ["open", "awaiting-customer", "resolved"];

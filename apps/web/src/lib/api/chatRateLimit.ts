import { checkRateLimit, getClientIp, tooManyRequests } from "@store/shared";

const CHAT_POLL_MAX_PER_MINUTE = 120;
const CHAT_POLL_WINDOW_MS = 60_000;

export function enforceChatPollRateLimit(request: Request): Response | null {
	const ip = getClientIp(request);
	const { isAllowed, retryAfterMs } = checkRateLimit({
		scope: "storefront-chat-poll",
		key: ip,
		max: CHAT_POLL_MAX_PER_MINUTE,
		windowMs: CHAT_POLL_WINDOW_MS,
	});
	if (!isAllowed) {
		return tooManyRequests(retryAfterMs, "Too many requests, please try again later.");
	}
	return null;
}

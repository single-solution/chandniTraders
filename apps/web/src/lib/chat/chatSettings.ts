/**
 * Storefront-facing loader for `chat.*` settings.
 */

import { unstable_cache } from "next/cache";

import { connectDB, Setting } from "@store/db";

import { CHAT_SETTING_DB_KEY_LIST, mergeChatSettingsFromDb, type ChatSettingsValues } from "@store/shared";

import { STOREFRONT_CACHE_TAG } from "@/lib/core/cached";

export type ChatSettings = ChatSettingsValues;

const TTL_SECONDS = 30;

const loadChatSettings = unstable_cache(
	async (): Promise<ChatSettings> => {
		try {
			await connectDB();
			const docs = await Setting.find({ key: { $in: CHAT_SETTING_DB_KEY_LIST } })
				.select({ key: 1, value: 1 })
				.lean<Array<{ key: string; value: unknown }>>();
			return mergeChatSettingsFromDb(docs);
		} catch {
			// An Atlas hiccup must not crash the root layout (which renders the
			// chat widget on every page) — fall back to built-in defaults.
			return mergeChatSettingsFromDb([]);
		}
	},
	["chat-settings"],
	{ revalidate: TTL_SECONDS, tags: [STOREFRONT_CACHE_TAG] },
);

export function getChatSettings(): Promise<ChatSettings> {
	return loadChatSettings();
}

import mongoose, { Schema, type Model } from "mongoose";
import type { AssistantMuteReason, StoredImage } from "@store/shared";
import { ASSISTANT_MUTE_REASONS } from "@store/shared";
import { storedImageSchema } from "../schemas/storedImageSchema";

/**
 * Customer ↔ team chat thread. `phoneNumber` is the canonical identity anchor;
 * `customerId` is set when a session or admin link provides one.
 */

export const INQUIRY_STATUSES = ["open", "awaiting-customer", "resolved"] as const;
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number];

/**
 * Admin-facing surfaces (inbox, dashboards, badges, alerts) only show real,
 * signed-in customers. Anonymous guest preview threads (`phoneNumber` =
 * `anon:<uuid>`, no `customerId`) are excluded until the guest signs in and
 * the thread is claimed — which stamps a `customerId`. Merge this into every
 * admin Inquiry query so guest chatter never leaks into admin or inflates
 * counts.
 */
export const SIGNED_IN_INQUIRY_FILTER = {
	customerId: { $exists: true, $ne: null },
} as const;

export const INQUIRY_MESSAGE_AUTHORS = ["customer", "agent", "assistant"] as const;
export type InquiryMessageAuthor = (typeof INQUIRY_MESSAGE_AUTHORS)[number];

export const INQUIRY_ATTACHMENT_KINDS = ["image", "file"] as const;
export type InquiryAttachmentKind = (typeof INQUIRY_ATTACHMENT_KINDS)[number];

/**
 * Per-message attachment. Images use `StoredImage` (`thumb` inline, `full` in lightbox).
 * Non-image files keep raw URL + mime metadata only.
 */
export interface InquiryImageAttachment {
	kind: "image";
	image: StoredImage;
}
export interface InquiryFileAttachment {
	kind: "file";
	url: string;
	mime: string;
	sizeBytes: number;
	filename: string;
}
export type InquiryAttachment = InquiryImageAttachment | InquiryFileAttachment;

export interface InquiryMessageAttributes {
	_id?: mongoose.Types.ObjectId;
	author: InquiryMessageAuthor;
	/**
	 * Display name for the message. For customer messages: the inquiry's
	 * `customerName`. For agent messages: the replying admin's full name.
	 * Denormalised so old messages keep their original signature even if
	 * the underlying user / customer is renamed later.
	 */
	authorName?: string;
	/** Set when `author === "agent"` — the replying admin user. */
	authorUserId?: mongoose.Types.ObjectId;
	body: string;
	attachments?: InquiryAttachment[];
	createdAt: Date;
	/** Customer-side read receipt for agent messages. */
	readByCustomerAt?: Date;
}

export interface InquiryAttributes {
	customerName: string;
	phoneNumber: string;
	customerId?: mongoose.Types.ObjectId;
	subjectProductId?: mongoose.Types.ObjectId;
	subjectProductName?: string;
	status: InquiryStatus;
	assignedToUserId?: mongoose.Types.ObjectId;
	lastMessageAt: Date;
	lastMessagePreview: string;
	lastMessageAuthor: InquiryMessageAuthor;
	unreadByCustomer: number;
	unreadByTeam: number;
	/**
	 * When true, the AI assistant stops auto-replying — set after it escalates
	 * to a human, cleared the moment a human agent replies. Keeps the bot from
	 * talking over the team once a person has taken the conversation.
	 */
	assistantMuted?: boolean;
	/**
	 * Why the bot is paused: auto-escalation or a teammate paused it manually.
	 * Cleared when the bot is re-enabled.
	 */
	assistantMuteReason?: AssistantMuteReason;
	/** When the bot was paused (escalation or manual). */
	assistantMutedAt?: Date;
	/** Admin who manually paused the bot — unset for auto-escalation. */
	assistantMutedByUserId?: mongoose.Types.ObjectId;
	/**
	 * When the bot escalated to a human. After a grace period with no agent
	 * reply, the bot resumes with reassurance-only help so the customer is not
	 * left hanging if the senior is slow. Cleared when an agent replies or the
	 * bot is re-enabled.
	 */
	escalatedAt?: Date;
	internalNotes?: string;
	messages: InquiryMessageAttributes[];
}

/**
 * Attachment storage uses Mongoose's discriminated-subdocument pattern.
 * The parent `inquiryAttachmentSchema` carries the `kind` discriminator
 * key + a shared `_id: false`; the two children declare only their own
 * fields (Mongoose injects `kind` automatically from the discriminator
 * name — declaring it explicitly here throws "cannot have field with
 * name kind"). Mongoose injects `kind` from the discriminator name — do not
 * declare it on child schemas.
 */
const FILE_URL_MAX_LENGTH = 600;
const MIME_MAX_LENGTH = 120;
const FILENAME_MAX_LENGTH = 240;
const AUTHOR_NAME_MAX_LENGTH = 160;
const MESSAGE_BODY_MAX_LENGTH = 8_000;
const CUSTOMER_NAME_MIN_LENGTH = 2;
const CUSTOMER_NAME_MAX_LENGTH = 160;
const PHONE_NUMBER_MAX_LENGTH = 64;
const PRODUCT_NAME_MAX_LENGTH = 200;
const MSG_PREVIEW_MAX_LENGTH = 280;
const INTERNAL_NOTES_MAX_LENGTH = 4_000;

const inquiryImageAttachmentSchema = new Schema<Omit<InquiryImageAttachment, "kind">>(
	{
		image: { type: storedImageSchema, required: true },
	},
	{ _id: false },
);

const inquiryFileAttachmentSchema = new Schema<Omit<InquiryFileAttachment, "kind">>(
	{
		url: { type: String, required: true, trim: true, maxlength: FILE_URL_MAX_LENGTH },
		mime: { type: String, required: true, trim: true, maxlength: MIME_MAX_LENGTH },
		sizeBytes: { type: Number, required: true, min: 0 },
		filename: { type: String, required: true, trim: true, maxlength: FILENAME_MAX_LENGTH },
	},
	{ _id: false },
);

const inquiryAttachmentSchema = new Schema<InquiryAttachment>({}, { _id: false, discriminatorKey: "kind" });
inquiryAttachmentSchema.discriminator("image", inquiryImageAttachmentSchema);
inquiryAttachmentSchema.discriminator("file", inquiryFileAttachmentSchema);

const inquiryMessageSchema = new Schema<InquiryMessageAttributes>(
	{
		author: {
			type: String,
			enum: INQUIRY_MESSAGE_AUTHORS,
			required: true,
		},
		authorName: { type: String, trim: true, maxlength: AUTHOR_NAME_MAX_LENGTH },
		authorUserId: { type: Schema.Types.ObjectId, ref: "User" },
		body: { type: String, required: true, trim: true, maxlength: MESSAGE_BODY_MAX_LENGTH },
		attachments: {
			type: [inquiryAttachmentSchema],
			default: undefined,
		},
		createdAt: { type: Date, required: true, default: () => new Date() },
		readByCustomerAt: { type: Date },
	},
	{ _id: true },
);

const inquirySchema = new Schema<InquiryAttributes>(
	{
		customerName: {
			type: String,
			required: true,
			trim: true,
			minlength: CUSTOMER_NAME_MIN_LENGTH,
			maxlength: CUSTOMER_NAME_MAX_LENGTH,
		},
		phoneNumber: {
			type: String,
			required: true,
			trim: true,
			// Holds either a real phone number or a guest anchor `anon:<uuid>` (41 chars).
			maxlength: PHONE_NUMBER_MAX_LENGTH,
			index: true,
		},
		customerId: { type: Schema.Types.ObjectId, ref: "Customer" },
		subjectProductId: { type: Schema.Types.ObjectId, ref: "Product" },
		subjectProductName: { type: String, trim: true, maxlength: PRODUCT_NAME_MAX_LENGTH },
		status: {
			type: String,
			enum: INQUIRY_STATUSES,
			required: true,
			default: "open",
		},
		assignedToUserId: { type: Schema.Types.ObjectId, ref: "User" },
		lastMessageAt: {
			type: Date,
			required: true,
			default: () => new Date(),
		},
		lastMessagePreview: {
			type: String,
			required: true,
			trim: true,
			maxlength: MSG_PREVIEW_MAX_LENGTH,
			default: "",
		},
		lastMessageAuthor: {
			type: String,
			enum: INQUIRY_MESSAGE_AUTHORS,
			required: true,
			default: "customer",
		},
		unreadByCustomer: { type: Number, required: true, default: 0, min: 0 },
		unreadByTeam: { type: Number, required: true, default: 1, min: 0 },
		assistantMuted: { type: Boolean, default: false },
		assistantMuteReason: { type: String, enum: ASSISTANT_MUTE_REASONS, required: false },
		assistantMutedAt: { type: Date },
		assistantMutedByUserId: { type: Schema.Types.ObjectId, ref: "User" },
		escalatedAt: { type: Date },
		internalNotes: { type: String, trim: true, maxlength: INTERNAL_NOTES_MAX_LENGTH },
		messages: { type: [inquiryMessageSchema], default: [] },
	},
	{ timestamps: true },
);

// One conversation per signed-in customer. Partial so guest threads (no
// `customerId`, phone = `anon:<uuid>`) are exempt and can coexist freely.
inquirySchema.index(
	{ customerId: 1 },
	{
		unique: true,
		partialFilterExpression: { customerId: { $type: "objectId" } },
	},
);
// Inbox sort: status filter + recent activity descending.
inquirySchema.index({ status: 1, lastMessageAt: -1 });
// "My inbox" lookup for an admin viewer.
inquirySchema.index({ assignedToUserId: 1, status: 1, lastMessageAt: -1 });
// /account/messages list — the signed-in customer's own threads.
inquirySchema.index({ customerId: 1, lastMessageAt: -1 });

export const Inquiry: Model<InquiryAttributes> = (mongoose.models.Inquiry as Model<InquiryAttributes>) ?? mongoose.model<InquiryAttributes>("Inquiry", inquirySchema);

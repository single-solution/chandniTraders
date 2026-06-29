/**
 * Public surface of `@store/db`.
 *
 * Apps import everything from this barrel so we can rearrange the internal
 * file layout without breaking consumers. Both the customer-facing storefront
 * and the admin app reach into the same MongoDB cluster through this package
 * — there is no second source of truth.
 */

export { connectDB } from "./connection";
export { handleMongoError, isMongoDuplicateKeyError } from "./mongoErrors";
export { reserveStock, releaseStock, type StockLine, type StockReservationResult } from "./inventory";
export { nextOrderNumberForYear, createWithUniqueOrderNumber } from "./orderNumber";
export { getStoreSettings, invalidateStoreSettingsCache } from "./storeSettings";
export { getIntegrationSettings, invalidateIntegrationSettingsCache, loadRawIntegrationSettingsFromDb } from "./integrationSettings";
export { resolveInquiryStaffNotifyTargets, type InquiryStaffNotifyTargets } from "./inquiryStaffNotifyTargets";
export {
	collectStaffEmailRecipients,
	collectStaffWhatsAppForShopEvent,
	collectStaffWhatsAppForInquiry,
} from "./staffNotifyContacts";
export { fireOrderEventNotifications } from "./orderEventNotifications";
export { incrementOfferUsageCounts, decrementOfferUsageCounts } from "./offerUsage";
export { applyOrderTransition, type OrderTransitionActor } from "./orderTransitions";
export { claimOrderStatusTransition, type ClaimOrderStatusInput } from "./orderStatusClaim";
export { storedImageSchema } from "./schemas/storedImageSchema";
export { seoSchema } from "./schemas/seoSchema";

/**
 * Augment a Mongoose document attributes type with the framework-managed
 * timestamps. Model interfaces never declare `createdAt` / `updatedAt`
 * (timestamps are a Mongoose concern, not an authored-field concern), but
 * consumers that read .lean() documents and want to format timestamps
 * back out can opt in via `WithTimestamps<MyModelAttributes>`.
 */
export type WithTimestamps<TModel> = TModel & { createdAt: Date; updatedAt: Date };

export * from "./models";

/**
 * Public surface of `@store/shared`.
 *
 * Framework-light (Next + clsx, no React), app-agnostic utilities used by
 * BOTH the storefront and the admin app. Anything that's only one app's
 * concern lives inside that app's `src/lib`, never here.
 */

export * from "./chat/chatSettingsSchema";
export * from "./chat/chatTransport";
export * from "./chat/guestLimits";
export * from "./chat/guestToken";
export * from "./chat/inquiryAssistant";
export * from "./chat/inquiryStatus";
export * from "./chat/messagePagination";
export * from "./chat/poll";
export * from "./chat/types";
export * from "./chat/validators";
export * from "./chat/assistantReply";
export * from "./chat/assistantEscalation";
export * from "./chat/assistantIntent";
export * from "./chat/assistantProvider";
export * from "./chat/assistantPrompt";
export * from "./chat/assistantConstants";
export * from "./chat/storefrontPaths";
export * from "./chat/assistantLanguage";
export * from "./chat/assistantMessageRich";
export * from "./chat/assistantQueryExtract";
export * from "./wireCoercion";
export * from "./icons";
export * from "./classNames";
export * from "./colorContrast";
export * from "./constants";
export * from "./escapeRegex";
export * from "./formatters";
export * from "./floatingPosition";
export * from "./logger";
export * from "./loyalty";
export * from "./phone";
export * from "./integration/integrationSettingsSchema";
export * from "./integration/resolveIntegration";
export * from "./integrationStatus";
export * from "./orderLifecycle";
export * from "./publicSiteUrl";
export * from "./rateLimit";
export * from "./responseHelpers";
export * from "./seo/composeSeoMeta";
export * from "./seo/seoChecklist";
export * from "./seo/seoMeta";
export * from "./seo/titleTemplate";
export * from "./attributeOption";
export * from "./attributeVisibility";
export * from "./productAttributeConfig";
export * from "./catalog/productImages";
export * from "./catalog/variantAvailability";
export * from "./catalogBrands";
export * from "./checkout/paymentTotals";
export * from "./checkout/shippingTotals";
export * from "./checkout/paymentInstructions";
export * from "./slug";
export * from "./storage/magicBytes";
export * from "./storage/providers";
export * from "./storage/types";
export * from "./storage/urlPolicy";
export * from "./sanitizePolicyHtml";
export * from "./storeSettings";
export * from "./structuredContent";
export * from "./types";
export * from "./customerAddresses";
export * from "./validation";
export * from "./warranty";
export * from "./youtube";
export * from "./pricing/cartOfferLock";
export * from "./pricing/offerDisplay";
export * from "./pricing/offerTypes";
export * from "./pricing/offerEvaluator";
export * from "./pricing/offerMatching";
export * from "./pricing/offerSchedule";
export * from "./pricing/offerScope";
export * from "./pricing/toActiveOffer";

import { useState, useMemo, useEffect } from "react";
import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { ScenarioStepPicker } from "./ScenarioStepPicker";
import type { OfferCondition, OfferAction, OfferSchedule, OfferConstraints } from "@store/shared";
import { formatOfferScopeConflictMessage, normalizeCatalogOfferAction, normalizeOfferConstraintsForScope, wouldProductSelectionConflict } from "@store/shared";
import type { AdminCategory, AdminBrand, AdminAttribute, AdminProductSummary, AdminOffer } from "@/types/models";
import { TextField } from "@/components/forms/TextField";
import { SelectField } from "@/components/forms/SelectField";
import { SelectionToggleCards } from "@/components/forms/SelectionToggleCards";
import { Switch } from "@/components/forms/Switch";
import { Button } from "@store/ui";
import { apiFetch } from "@/lib/api";
import { useStoreSettings } from "@/lib/storeSettingsContext";

interface OfferRulesEditorProps {
	conditions: OfferCondition[];
	onChangeConditions: (conditions: OfferCondition[]) => void;
	action: OfferAction;
	onChangeAction: (action: OfferAction) => void;
	schedule: OfferSchedule;
	onChangeSchedule: (schedule: OfferSchedule) => void;
	constraints: OfferConstraints;
	onChangeConstraints: (constraints: OfferConstraints) => void;
	peerOffers?: AdminOffer[];
	editingOfferId?: string | null;
	onScopeConflict?: (message: string) => void;
}

const PAYMENT_METHOD_OPTIONS = [
	{ value: "bank-transfer", label: "Bank transfer", settingsKey: "paymentBankTransferEnabled" as const },
	{ value: "card", label: "Card payment", settingsKey: "paymentCardEnabled" as const },
	{ value: "cod", label: "Cash on delivery", settingsKey: "paymentCodEnabled" as const },
];

const CATALOG_ACTION_TYPES = [
	{ value: "percentage_discount", label: "Percentage Discount (%)" },
	{ value: "fixed_amount_discount", label: "Fixed Amount Discount (Rs)" },
];

const CHECKOUT_ACTION_TYPES = [
	...CATALOG_ACTION_TYPES,
	{ value: "free_shipping", label: "Free Shipping" },
];

function defaultCatalogConditions(): OfferCondition[] {
	return [
		{
			type: "group",
			operator: "or",
			value: [{ type: "group", operator: "and", value: [] }],
		},
	];
}

function findCatalogOrGroup(conditions: OfferCondition[]): OfferCondition | undefined {
	return conditions.find((condition) => condition.type === "group" && condition.operator === "or");
}

function listCatalogScenarios(conditions: OfferCondition[]): OfferCondition[] {
	const orGroup = findCatalogOrGroup(conditions);
	if (!orGroup || !Array.isArray(orGroup.value)) {
		return [];
	}
	return (orGroup.value as OfferCondition[]).filter((condition) => condition.type === "group" && condition.operator === "and");
}

function numericConditionValue(value: unknown): number | "" {
	return typeof value === "number" && !Number.isNaN(value) ? value : "";
}

export function OfferRulesEditor({
	conditions,
	onChangeConditions,
	action,
	onChangeAction,
	schedule,
	onChangeSchedule,
	constraints,
	onChangeConstraints,
	peerOffers = [],
	editingOfferId = null,
	onScopeConflict,
}: OfferRulesEditorProps) {
	const storeSettings = useStoreSettings();
	const [categories, setCategories] = useState<AdminCategory[]>([]);
	const [brands, setBrands] = useState<AdminBrand[]>([]);
	const [products, setProducts] = useState<AdminProductSummary[]>([]);
	const [attributes, setAttributes] = useState<AdminAttribute[]>([]);

	useEffect(() => {
		apiFetch<{ items: AdminCategory[] }>("/api/categories?limit=100")
			.then((res) => setCategories(res.items))
			.catch(() => {});
		apiFetch<{ items: AdminBrand[] }>("/api/brands?limit=200")
			.then((res) => setBrands(res.items))
			.catch(() => {});
		apiFetch<{ items: AdminAttribute[] }>("/api/attributes?limit=100")
			.then((res) => setAttributes(res.items))
			.catch(() => {});
		apiFetch<{ items: AdminProductSummary[] }>("/api/products?limit=200")
			.then((res) => setProducts(res.items))
			.catch(() => {});
	}, []);

	// Split conditions into logical groups
	const cartTotalCondition = useMemo(() => conditions.find((c) => c.type === "cart_total"), [conditions]);
	const paymentMethodCondition = useMemo(() => conditions.find((c) => c.type === "payment_method"), [conditions]);
	const minQuantityCondition = useMemo(() => conditions.find((c) => c.type === "min_quantity"), [conditions]);

	const scenarios = useMemo(() => listCatalogScenarios(conditions), [conditions]);

	const catalogScenarios = useMemo(() => {
		if (scenarios.length > 0) {
			return scenarios;
		}
		return [{ type: "group" as const, operator: "and" as const, value: [] }];
	}, [scenarios]);

	const peerOfferRows = useMemo(
		() =>
			peerOffers.map((offer) => ({
				id: offer.id,
				title: offer.title,
				conditions: offer.conditions ?? [],
			})),
		[peerOffers],
	);

	function trySelectProduct(scenarioIndex: number, product: AdminProductSummary, nextValue: string) {
		if (!nextValue) {
			updateScenario(scenarioIndex, "products", []);
			return;
		}

		const catalogProduct = {
			id: product.id,
			name: product.name,
			categorySlug: product.categorySlug,
			brandSlug: product.brand.slug,
			variants: [{ attributes: {} }],
		};
		const conflict = wouldProductSelectionConflict(conditions, scenarioIndex, catalogProduct, peerOfferRows, editingOfferId ?? undefined);
		if (conflict) {
			const message = formatOfferScopeConflictMessage(conflict);
			onScopeConflict?.(message);
			return;
		}

		updateScenario(scenarioIndex, "products", [nextValue]);
	}

	function isProductOptionBlocked(scenarioIndex: number, product: AdminProductSummary): boolean {
		const catalogProduct = {
			id: product.id,
			name: product.name,
			categorySlug: product.categorySlug,
			brandSlug: product.brand.slug,
			variants: product.variantCount > 0 ? [{ attributes: {} }] : [],
		};
		return wouldProductSelectionConflict(conditions, scenarioIndex, catalogProduct, peerOfferRows, editingOfferId ?? undefined) !== null;
	}

	type OfferScope = "catalog" | "checkout";
	type CheckoutTrigger = "cart_total" | "payment_method";

	const scope: OfferScope = useMemo(() => {
		if (cartTotalCondition || paymentMethodCondition) {
			return "checkout";
		}
		return "catalog";
	}, [cartTotalCondition, paymentMethodCondition]);

	const checkoutTrigger: CheckoutTrigger = useMemo(() => {
		if (paymentMethodCondition && !cartTotalCondition) {
			return "payment_method";
		}
		return "cart_total";
	}, [cartTotalCondition, paymentMethodCondition]);

	const enabledPaymentMethodOptions = useMemo(
		() => PAYMENT_METHOD_OPTIONS.filter((option) => storeSettings[option.settingsKey]),
		[storeSettings],
	);

	const actionTypeOptions = scope === "catalog" ? CATALOG_ACTION_TYPES : CHECKOUT_ACTION_TYPES;

	useEffect(() => {
		if (scope !== "catalog") {
			return;
		}
		if (action.type === "free_shipping" || action.type === "buy_x_get_y" || action.target !== "matched_items") {
			onChangeAction(normalizeCatalogOfferAction(action));
		}
	}, [action, onChangeAction, scope]);

	useEffect(() => {
		if (scope !== "catalog") {
			return;
		}
		if (constraints.allowLoyaltyPoints) {
			onChangeConstraints(normalizeOfferConstraintsForScope(conditions, constraints));
		}
	}, [conditions, constraints, onChangeConstraints, scope]);

	function preserveMinQuantityCondition(nextConditions: OfferCondition[]): OfferCondition[] {
		const minQuantity = conditions.find((condition) => condition.type === "min_quantity");
		if (!minQuantity || nextConditions.some((condition) => condition.type === "min_quantity")) {
			return nextConditions;
		}
		return [...nextConditions, minQuantity];
	}

	function setScope(newScope: OfferScope) {
		if (newScope === "catalog") {
			onChangeConditions(preserveMinQuantityCondition(defaultCatalogConditions()));
			onChangeAction(normalizeCatalogOfferAction({ ...action, target: "matched_items" }));
			onChangeConstraints(normalizeOfferConstraintsForScope(defaultCatalogConditions(), constraints));
			return;
		}

		onChangeConditions(
			preserveMinQuantityCondition([
				{
					type: "cart_total",
					operator: "gte",
					value: typeof cartTotalCondition?.value === "number" && !Number.isNaN(cartTotalCondition.value) ? cartTotalCondition.value : 0,
				},
			]),
		);
		onChangeAction({ ...action, target: "cart_total" });
	}

	function setCheckoutTrigger(trigger: CheckoutTrigger) {
		if (trigger === "cart_total") {
			onChangeConditions(
				preserveMinQuantityCondition([
					{
						type: "cart_total",
						operator: "gte",
						value: typeof cartTotalCondition?.value === "number" && !Number.isNaN(cartTotalCondition.value) ? cartTotalCondition.value : 0,
					},
				]),
			);
			return;
		}

		const currentPaymentValue = typeof paymentMethodCondition?.value === "string" ? paymentMethodCondition.value : "";
		const defaultPaymentValue = enabledPaymentMethodOptions.some((option) => option.value === currentPaymentValue)
			? currentPaymentValue
			: (enabledPaymentMethodOptions[0]?.value ?? "");

		onChangeConditions(
			preserveMinQuantityCondition([{ type: "payment_method", operator: "in", value: defaultPaymentValue }]),
		);
	}

	function updateCartTotalCondition(value: number) {
		onChangeConditions(preserveMinQuantityCondition([{ type: "cart_total", operator: "gte", value }]));
	}

	function updatePaymentMethodCondition(value: string) {
		if (!value) {
			return;
		}
		onChangeConditions(preserveMinQuantityCondition([{ type: "payment_method", operator: "in", value }]));
	}

	function addScenario() {
		const nextConditions = [...conditions];
		let orGroupIdx = nextConditions.findIndex((condition) => condition.type === "group" && condition.operator === "or");

		if (orGroupIdx === -1) {
			nextConditions.push({
				type: "group",
				operator: "or",
				value: [
					{ type: "group", operator: "and", value: [] },
					{ type: "group", operator: "and", value: [] },
				],
			});
		} else {
			const orGroup = { ...nextConditions[orGroupIdx] };
			orGroup.value = [...(Array.isArray(orGroup.value) ? orGroup.value : []), { type: "group", operator: "and", value: [] }];
			nextConditions[orGroupIdx] = orGroup;
		}

		onChangeConditions(nextConditions);
	}

	function removeScenario(index: number) {
		const nextConditions = [...conditions];
		const orGroupIdx = nextConditions.findIndex((condition) => condition.type === "group" && condition.operator === "or");
		if (orGroupIdx === -1) {
			return;
		}

		const orGroup = { ...nextConditions[orGroupIdx] };
		const newScenarios = Array.isArray(orGroup.value) ? [...orGroup.value] : [];
		newScenarios.splice(index, 1);

		if (newScenarios.length === 0) {
			return;
		}

		orGroup.value = newScenarios;
		nextConditions[orGroupIdx] = orGroup;
		onChangeConditions(nextConditions);
	}

	function updateScenario(index: number, type: OfferCondition["type"], values: unknown, operator: OfferCondition["operator"] = "in") {
		const nextConditions = [...conditions];
		let orGroupIdx = nextConditions.findIndex((c) => c.type === "group" && c.operator === "or");

		if (orGroupIdx === -1) {
			nextConditions.push({ type: "group", operator: "or", value: [] });
			orGroupIdx = nextConditions.length - 1;
		}

		const orGroup = { ...nextConditions[orGroupIdx] };
		const newScenarios = Array.isArray(orGroup.value) ? [...orGroup.value] : [];

		if (!newScenarios[index]) {
			newScenarios[index] = { type: "group", operator: "and", value: [] };
		}

		const scenario = { ...newScenarios[index] };
		const subConditions = Array.isArray(scenario.value) ? [...scenario.value] : [];

		const subIdx = subConditions.findIndex((c: OfferCondition) => c.type === type);

		let isEmpty = false;
		if (Array.isArray(values)) {
			isEmpty = values.length === 0;
		} else if (type === "min_quantity") {
			isEmpty = isNaN(values as number);
		} else if (typeof values === "object" && values !== null && "slug" in values) {
			isEmpty = !(values as { slug?: string }).slug;
		} else {
			isEmpty = !values;
		}

		if (isEmpty) {
			if (subIdx > -1) subConditions.splice(subIdx, 1);
		} else {
			if (subIdx > -1) {
				subConditions[subIdx] = { type, operator, value: values };
			} else {
				subConditions.push({ type, operator, value: values });
			}
		}

		const downstreamByType: Partial<Record<OfferCondition["type"], OfferCondition["type"][]>> = {
			categories: ["brands", "products", "attributes"],
			brands: ["products", "attributes"],
			products: ["attributes"],
		};
		const downstreamTypes = downstreamByType[type];
		if (downstreamTypes?.length) {
			for (let conditionIndex = subConditions.length - 1; conditionIndex >= 0; conditionIndex -= 1) {
				if (downstreamTypes.includes(subConditions[conditionIndex]?.type)) {
					subConditions.splice(conditionIndex, 1);
				}
			}
		}

		scenario.value = subConditions;
		newScenarios[index] = scenario;
		orGroup.value = newScenarios;
		nextConditions[orGroupIdx] = orGroup;

		onChangeConditions(nextConditions);
	}

	const scheduleMode = schedule.daysOfWeek?.length || schedule.startTime ? "recurring" : "once";

	return (
		<div className="space-y-8">
			{/* 1. SCOPE */}
			<section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] md:p-5">
				<h3 className="text-[14px] font-bold tracking-tight text-[var(--color-ink-900)]">1. What triggers this offer?</h3>
				<SelectionToggleCards
					value={scope}
					onChange={setScope}
					columns={2}
					options={[
						{
							value: "catalog",
							title: "Catalog",
							description: "Category or product scope — one catalog deal per product. Checkout offers are separate.",
						},
						{
							value: "checkout",
							title: "Checkout",
							description: "Minimum spend and/or payment method.",
						},
					]}
				/>

			</section>

			{scope === "catalog" && (
				<section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] md:p-5">
					<div className="flex items-center justify-between">
						<div>
							<h3 className="text-[14px] font-bold tracking-tight text-[var(--color-ink-900)]">Catalog rules</h3>
							<p className="mt-1 text-[13px] text-[var(--color-ink-500)]">
								Pick a category (required), then optionally narrow by brand, product, or variant. Add scenarios for OR paths. Overlapping products are blocked.
							</p>
						</div>
						<Button type="button" variant="outline" size="sm" onClick={addScenario} className="h-7 px-2.5 text-[12px]">
							<Plus size={12} className="mr-1" />
							Add scenario
						</Button>
					</div>

					<div className="space-y-4">
						{catalogScenarios.map((scenario: OfferCondition, scenarioIndex: number) => {
							const subConditions = Array.isArray(scenario.value) ? scenario.value : [];
							const getVals = (t: string) => subConditions.find((c: OfferCondition) => c.type === t)?.value || [];

							const selectedCategorySlugs = getVals("categories") as string[];
							const selectedBrandSlugs = getVals("brands") as string[];
							const selectedProductIds = getVals("products") as string[];
							const selectedAttribute = subConditions.find((c: OfferCondition) => c.type === "attributes")?.value as { slug: string; value: string } | undefined;

							const showBrand = selectedCategorySlugs.length > 0;
							const showProduct = showBrand;
							const showAttribute = showProduct && selectedProductIds.length > 0;

							const canRemoveScenario = scenarios.length > 1;

							return (
								<div key={scenarioIndex} className="relative space-y-4 rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] p-4">
									<div className="flex items-center justify-between border-b border-[var(--color-ink-200)] pb-3">
										<h4 className="text-[13px] font-bold text-[var(--color-ink-900)]">Scenario {scenarioIndex + 1}</h4>
										{canRemoveScenario ? (
											<button type="button" onClick={() => removeScenario(scenarioIndex)} className="text-[var(--color-ink-400)] hover:text-rose-600" aria-label="Remove scenario">
												<Trash2 size={16} />
											</button>
										) : null}
									</div>

									<div className="flex w-full items-end gap-2 overflow-x-auto pb-2 scroll-smooth">
										<ScenarioStepPicker
											label="Category"
											options={categories.map((category) => ({
												label: category.label || category.slug,
												value: category.slug,
											}))}
											value={selectedCategorySlugs[0] || ""}
											onChange={(nextValue) => {
												if (!nextValue) {
													return;
												}
												updateScenario(scenarioIndex, "categories", [nextValue]);
											}}
											placeholder="Select category"
										/>

										{showBrand ? (
											<>
												<ChevronRight size={16} aria-hidden className="mb-2 shrink-0 text-[var(--color-ink-300)]" />
												<ScenarioStepPicker
													label="Brand"
													optional
													options={(selectedCategorySlugs.length > 0
														? brands.filter((brand) => brand.categorySlugs.some((slug) => selectedCategorySlugs.includes(slug)))
														: brands
													).map((brand) => ({ label: brand.name, value: brand.slug }))}
													value={selectedBrandSlugs[0] || ""}
													onChange={(nextValue) => updateScenario(scenarioIndex, "brands", nextValue ? [nextValue] : [])}
													placeholder="Any brand"
												/>
											</>
										) : null}

										{showProduct ? (
											<>
												<ChevronRight size={16} aria-hidden className="mb-2 shrink-0 text-[var(--color-ink-300)]" />
												<ScenarioStepPicker
													label="Product"
													optional
													options={products
														.filter((product) => {
															if (selectedCategorySlugs.length > 0 && !selectedCategorySlugs.includes(product.categorySlug)) {
																return false;
															}
															if (selectedBrandSlugs.length > 0 && !selectedBrandSlugs.includes(product.brand.slug)) {
																return false;
															}
															return true;
														})
														.map((product) => {
															const blocked = isProductOptionBlocked(scenarioIndex, product);
															return {
																label: blocked ? `${product.name} (in another offer)` : product.name,
																value: product.id,
															};
														})}
													value={selectedProductIds[0] || ""}
													onChange={(nextValue) => {
														const product = products.find((row) => row.id === nextValue);
														if (!nextValue || !product) {
															updateScenario(scenarioIndex, "products", []);
															return;
														}
														trySelectProduct(scenarioIndex, product, nextValue);
													}}
													placeholder="Any product"
												/>
											</>
										) : null}

										{showAttribute ? (
											<>
												<ChevronRight size={16} aria-hidden className="mb-2 shrink-0 text-[var(--color-ink-300)]" />
												<div className="flex shrink-0 flex-col gap-2">
													<ScenarioStepPicker
														label="Variant"
														optional
														options={(selectedCategorySlugs.length > 0 ? attributes.filter((attribute) => selectedCategorySlugs.includes(attribute.categorySlug)) : attributes).map(
															(attribute) => ({ label: attribute.label, value: attribute.slug }),
														)}
														value={selectedAttribute?.slug ?? ""}
														onChange={(slug) => updateScenario(scenarioIndex, "attributes", slug ? { slug, value: "" } : null)}
														placeholder="Any variant"
													/>
													{selectedAttribute?.slug ? (
														<ScenarioStepPicker
															label="Variant value"
															optional
															options={
																attributes
																	.find((attribute) => attribute.slug === selectedAttribute.slug)
																	?.options.map((option) => ({
																		label: option.label,
																		value: option.value,
																	})) ?? []
															}
															value={selectedAttribute.value ?? ""}
															onChange={(nextValue) =>
																updateScenario(scenarioIndex, "attributes", {
																	slug: selectedAttribute.slug,
																	value: nextValue,
																})
															}
															placeholder="Any value"
														/>
													) : null}
												</div>
											</>
										) : null}
									</div>
								</div>
							);
						})}
					</div>
				</section>
			)}

			{scope === "checkout" && (
				<section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] md:p-5">
					<h3 className="text-[14px] font-bold tracking-tight text-[var(--color-ink-900)]">Checkout rules</h3>
					<SelectionToggleCards
						label="Checkout trigger"
						value={checkoutTrigger}
						onChange={setCheckoutTrigger}
						columns={2}
						options={[
							{
								value: "cart_total",
								title: "Cart total",
								description: "Triggered by minimum spend.",
							},
							{
								value: "payment_method",
								title: "Payment method",
								description: "Specific checkout payment type.",
							},
						]}
					/>

					{checkoutTrigger === "cart_total" ? (
						<div className="rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-canvas)] p-4">
							<TextField
								label="Minimum cart total (Rs)"
								type="number"
								min="0"
								value={numericConditionValue(cartTotalCondition?.value)}
								onChange={(event) => {
									const parsed = parseFloat(event.target.value);
									updateCartTotalCondition(Number.isNaN(parsed) ? 0 : parsed);
								}}
								placeholder="e.g. 5000"
							/>
						</div>
					) : (
						<div className="rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-canvas)] p-4">
							{enabledPaymentMethodOptions.length > 0 ? (
								<SelectField
									label="Required payment method"
									value={typeof paymentMethodCondition?.value === "string" ? paymentMethodCondition.value : ""}
									onChange={(event) => updatePaymentMethodCondition(event.target.value)}
									options={enabledPaymentMethodOptions.map((option) => ({ value: option.value, label: option.label }))}
								/>
							) : (
								<p className="text-[13px] text-[var(--color-ink-500)]">
									No payment methods are enabled in Settings → Payments. Enable at least one method to use this trigger.
								</p>
							)}
						</div>
					)}
				</section>
			)}

			{/* 2. DISCOUNT ACTION */}
			<section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] md:p-5">
				<h3 className="text-[14px] font-bold tracking-tight text-[var(--color-ink-900)]">2. Discount Action</h3>
				<div className="flex w-full flex-wrap items-end gap-3">
					<div className="min-w-0 flex-1 basis-48">
						<SelectField
							label="Type"
							value={action.type}
							onChange={(event) => onChangeAction({ ...action, type: event.target.value as OfferAction["type"] })}
							options={actionTypeOptions}
						/>
					</div>
					{action.type !== "free_shipping" && (
						<div className="w-28 shrink-0">
							<TextField
								label="Value"
								type="number"
								min="0"
								step="0.01"
								value={action.value}
								onChange={(e) => onChangeAction({ ...action, value: parseFloat(e.target.value) || 0 })}
								trailingAddon={action.type === "percentage_discount" ? "%" : "Rs"}
							/>
						</div>
					)}
					<div className="min-w-0 flex-1 basis-40">
						<TextField
							label="Min. Qty (Optional)"
							type="number"
							min="1"
							value={numericConditionValue(minQuantityCondition?.value)}
							onChange={(e) => {
								const val = parseInt(e.target.value, 10);
								const next = [...conditions];
								const idx = next.findIndex((c) => c.type === "min_quantity");
								if (isNaN(val) || val <= 0) {
									if (idx > -1) next.splice(idx, 1);
								} else {
									if (idx > -1) {
										next[idx] = { type: "min_quantity", operator: "gte", value: val };
									} else {
										next.push({ type: "min_quantity", operator: "gte", value: val });
									}
								}
								onChangeConditions(next);
							}}
							placeholder="e.g. 2"
						/>
					</div>
				</div>
			</section>

			{/* 3. SCHEDULE */}
			<section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] md:p-5">
				<h3 className="text-[14px] font-bold tracking-tight text-[var(--color-ink-900)]">3. Schedule</h3>
				<div className="space-y-4">
					<SelectionToggleCards
						label="Schedule type"
						value={scheduleMode}
						onChange={(mode) => {
							if (mode === "once") {
								onChangeSchedule({
									...schedule,
									daysOfWeek: undefined,
									startTime: undefined,
									endTime: undefined,
								});
								return;
							}
							onChangeSchedule({ ...schedule, daysOfWeek: [0, 1, 2, 3, 4, 5, 6] });
						}}
						options={[
							{
								value: "once",
								title: "One-time",
								description: "Runs between a start and end date.",
							},
							{
								value: "recurring",
								title: "Recurring",
								description: "Repeats on selected days and times.",
							},
						]}
					/>

					{scheduleMode === "once" ? (
						<div className="grid gap-4 sm:grid-cols-2">
							<TextField
								label="Start Date & Time"
								type="datetime-local"
								value={schedule.startDate ? new Date(schedule.startDate).toISOString().slice(0, 16) : ""}
								onChange={(e) =>
									onChangeSchedule({
										...schedule,
										startDate: e.target.value ? new Date(e.target.value) : undefined,
									})
								}
							/>
							<TextField
								label="End Date & Time"
								type="datetime-local"
								value={schedule.endDate ? new Date(schedule.endDate).toISOString().slice(0, 16) : ""}
								onChange={(e) =>
									onChangeSchedule({
										...schedule,
										endDate: e.target.value ? new Date(e.target.value) : undefined,
									})
								}
							/>
						</div>
					) : (
						<div className="space-y-4 rounded-[var(--radius-md)] border border-[var(--color-ink-200)] bg-[var(--color-canvas)] p-4">
							<TextField
								label="Recurring Days of Week"
								value={schedule.daysOfWeek?.join(",") || ""}
								onChange={(e) => {
									const vals = e.target.value
										.split(",")
										.map((str) => parseInt(str.trim(), 10))
										.filter((num) => !isNaN(num) && num >= 0 && num <= 6);
									onChangeSchedule({
										...schedule,
										daysOfWeek: vals.length > 0 ? vals : undefined,
									});
								}}
								hint="0=Sun, 1=Mon...6=Sat. Comma separated."
							/>
							<div className="grid gap-4 sm:grid-cols-2">
								<TextField
									label="Daily Start Time"
									type="time"
									value={schedule.startTime || ""}
									onChange={(e) => onChangeSchedule({ ...schedule, startTime: e.target.value || undefined })}
								/>
								<TextField
									label="Daily End Time"
									type="time"
									value={schedule.endTime || ""}
									onChange={(e) => onChangeSchedule({ ...schedule, endTime: e.target.value || undefined })}
								/>
							</div>
							<div className="grid gap-4 sm:grid-cols-2">
								<TextField
									label="Active From Date (Optional)"
									type="datetime-local"
									value={schedule.startDate ? new Date(schedule.startDate).toISOString().slice(0, 16) : ""}
									onChange={(e) =>
										onChangeSchedule({
											...schedule,
											startDate: e.target.value ? new Date(e.target.value) : undefined,
										})
									}
								/>
								<TextField
									label="Active Until Date (Optional)"
									type="datetime-local"
									value={schedule.endDate ? new Date(schedule.endDate).toISOString().slice(0, 16) : ""}
									onChange={(e) =>
										onChangeSchedule({
											...schedule,
											endDate: e.target.value ? new Date(e.target.value) : undefined,
										})
									}
								/>
							</div>
						</div>
					)}
				</div>
			</section>

			{scope === "checkout" ? (
				<section className="space-y-4 rounded-[var(--radius-lg)] border border-[var(--color-ink-200)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-sm)] md:p-5">
					<h3 className="text-[14px] font-bold tracking-tight text-[var(--color-ink-900)]">4. Checkout constraints</h3>
					<Switch
						label="Allow loyalty points"
						description="When off, customers cannot redeem loyalty points while this checkout offer applies."
						checked={constraints.allowLoyaltyPoints}
						onCheckedChange={(checked) => onChangeConstraints({ ...constraints, allowLoyaltyPoints: checked })}
					/>
				</section>
			) : null}
		</div>
	);
}

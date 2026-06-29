"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { classNames, compareAlphabetically, formatAttributeOptionLabel, type ProductAttributeConfig, sortAttributeOptions } from "@store/shared";

import { Toggle } from "@/components/ui/Toggle";
import type { AdminAttribute } from "@/types/models";

import {
	addProductCustomOption,
	customOptionErrorMessage,
	effectiveProductOptionPool,
	previewProductCustomOptionSlug,
	removeProductCustomOption,
} from "./productAttributeConfigState";

interface ProductAttributeSetupProps {
	attributes: AdminAttribute[];
	config: ProductAttributeConfig;
	onChange: Dispatch<SetStateAction<ProductAttributeConfig>>;
	errorByPath?: Map<string, string>;
	compact?: boolean;
	onConfirmDisableAttribute?: (attribute: AdminAttribute, proceed: () => void) => void;
}

function poolValueSet(pool: string[]): Set<string> {
	return new Set(pool.map((entry) => entry.toLowerCase()));
}

function optionPillClasses(isSelected: boolean): string {
	return classNames(
		"inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-semibold transition-all",
		isSelected
			? "border-[var(--color-accent-500)] bg-[var(--color-accent-50)] text-[var(--color-accent-900)] shadow-[var(--shadow-sm)]"
			: "border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[var(--color-ink-700)] hover:border-[var(--color-ink-300)] hover:bg-[var(--color-canvas-deep)]",
	);
}

interface OptionPoolPillProps {
	label: string;
	isSelected: boolean;
	onToggle: () => void;
	onRemove?: () => void;
}

function OptionPoolPill({ label, isSelected, onToggle, onRemove }: OptionPoolPillProps) {
	return (
		<span className="inline-flex items-center gap-0.5">
			<button
				type="button"
				aria-pressed={isSelected}
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					onToggle();
				}}
				className={optionPillClasses(isSelected)}
			>
				{isSelected ? (
					<span className="grid size-3.5 place-items-center rounded-full bg-[var(--color-accent-600)] text-white">
						<Check size={8} strokeWidth={3} aria-hidden />
					</span>
				) : null}
				<span>{label}</span>
			</button>
			{onRemove ? (
				<button
					type="button"
					aria-label={`Remove ${label}`}
					onClick={(event) => {
						event.preventDefault();
						event.stopPropagation();
						onRemove();
					}}
					className="grid size-5 shrink-0 place-items-center rounded-full text-[var(--color-ink-500)] transition hover:bg-[var(--color-rose-50)] hover:text-[var(--color-rose-700)]"
				>
					<X size={10} strokeWidth={2.5} aria-hidden />
				</button>
			) : null}
		</span>
	);
}

function enabledAttributeSlugs(sortedAttributes: AdminAttribute[], config: ProductAttributeConfig): string[] {
	return sortedAttributes.filter((attribute) => config.attributeSlugs.includes(attribute.slug)).map((attribute) => attribute.slug);
}

interface AttributeSetupUiState {
	attributesKey: string;
	expandedSlugs: Set<string>;
	customDrafts: Record<string, string>;
	customErrors: Record<string, string>;
}

function createAttributeSetupUiState(sortedAttributes: AdminAttribute[], config: ProductAttributeConfig, attributesKey: string): AttributeSetupUiState {
	const enabled = enabledAttributeSlugs(sortedAttributes, config);
	return {
		attributesKey,
		expandedSlugs: enabled.length > 0 ? new Set(enabled) : new Set(),
		customDrafts: {},
		customErrors: {},
	};
}

export function ProductAttributeSetup({ attributes, config, onChange, errorByPath, compact = false, onConfirmDisableAttribute }: ProductAttributeSetupProps) {
	const sortedAttributes = useMemo(() => [...attributes].sort((left, right) => compareAlphabetically(left.label, right.label)), [attributes]);
	const attributesKey = useMemo(() => sortedAttributes.map((attribute) => attribute.slug).join("\0"), [sortedAttributes]);

	const [uiState, setUiState] = useState<AttributeSetupUiState>(() => createAttributeSetupUiState(sortedAttributes, config, attributesKey));

	if (uiState.attributesKey !== attributesKey) {
		setUiState(createAttributeSetupUiState(sortedAttributes, config, attributesKey));
	}

	const { expandedSlugs, customDrafts, customErrors } = uiState;

	function setExpandedSlugs(update: Set<string> | ((current: Set<string>) => Set<string>)) {
		setUiState((current) => ({
			...current,
			expandedSlugs: typeof update === "function" ? update(current.expandedSlugs) : update,
		}));
	}

	function setCustomDrafts(update: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)) {
		setUiState((current) => ({
			...current,
			customDrafts: typeof update === "function" ? update(current.customDrafts) : update,
		}));
	}

	function setCustomErrors(update: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)) {
		setUiState((current) => ({
			...current,
			customErrors: typeof update === "function" ? update(current.customErrors) : update,
		}));
	}

	function toggleAttribute(slug: string, enabled: boolean) {
		const attribute = attributes.find((row) => row.slug === slug);
		if (!enabled) {
			const applyDisable = () => {
				setExpandedSlugs((current) => {
					const next = new Set(current);
					next.delete(slug);
					return next;
				});
				onChange((prev) => {
					const nextSlugs = prev.attributeSlugs.filter((entry) => entry !== slug);
					const nextPool = { ...prev.attributeOptionPool };
					delete nextPool[slug];
					const nextCustom = { ...(prev.attributeCustomOptions ?? {}) };
					delete nextCustom[slug];
					const nextDefaults = { ...(prev.attributeDefaults ?? {}) };
					delete nextDefaults[slug];
					return {
						attributeSlugs: nextSlugs,
						attributeOptionPool: nextPool,
						...(Object.keys(nextCustom).length > 0 ? { attributeCustomOptions: nextCustom } : {}),
						...(Object.keys(nextDefaults).length > 0 ? { attributeDefaults: nextDefaults } : {}),
					};
				});
			};
			if (attribute && onConfirmDisableAttribute) {
				onConfirmDisableAttribute(attribute, applyDisable);
				return;
			}
			applyDisable();
			return;
		}

		if (!attribute) {
			return;
		}

		setExpandedSlugs((current) => new Set([...current, slug]));
		onChange((prev) => ({
			...prev,
			attributeSlugs: [...prev.attributeSlugs, slug],
			attributeOptionPool: {
				...prev.attributeOptionPool,
				[slug]: attribute.options.map((option) => option.value.toLowerCase()),
			},
		}));
	}

	function handleAccordionToggle(slug: string, isEnabled: boolean) {
		if (!isEnabled) {
			return;
		}
		setExpandedSlugs((current) => {
			const next = new Set(current);
			if (next.has(slug)) {
				next.delete(slug);
			} else {
				next.add(slug);
			}
			return next;
		});
	}

	function setPool(slug: string, values: string[]) {
		const normalizedValues = values.map((entry) => entry.toLowerCase());
		onChange((prev) => {
			const nextDefaults = { ...(prev.attributeDefaults ?? {}) };
			const defaultValue = nextDefaults[slug];
			if (defaultValue && !normalizedValues.includes(defaultValue.toLowerCase())) {
				delete nextDefaults[slug];
			}
			return {
				...prev,
				attributeOptionPool: {
					...prev.attributeOptionPool,
					[slug]: normalizedValues,
				},
				attributeDefaults: Object.keys(nextDefaults).length > 0 ? nextDefaults : undefined,
			};
		});
	}

	function togglePoolOption(attribute: AdminAttribute, value: string) {
		const normalizedValue = value.toLowerCase();
		const current = effectiveProductOptionPool(config, attribute);
		const currentSet = poolValueSet(current);
		const next = currentSet.has(normalizedValue) ? current.filter((entry) => entry.toLowerCase() !== normalizedValue) : [...current, normalizedValue];
		setPool(attribute.slug, next);
	}

	function handleAddCustom(attribute: AdminAttribute) {
		const draft = customDrafts[attribute.slug] ?? "";
		const result = addProductCustomOption(config, attribute, draft);
		if (!result.ok) {
			setCustomErrors((current) => ({
				...current,
				[attribute.slug]: customOptionErrorMessage(result.reason),
			}));
			return;
		}
		onChange(result.config);
		setCustomDrafts((current) => ({ ...current, [attribute.slug]: "" }));
		setCustomErrors((current) => {
			const next = { ...current };
			delete next[attribute.slug];
			return next;
		});
		setExpandedSlugs((current) => new Set([...current, attribute.slug]));
	}

	function handleRemoveCustom(attributeSlug: string, value: string) {
		onChange((prev) => removeProductCustomOption(prev, attributeSlug, value));
	}

	return (
		<div className={compact ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
			{!compact ? (
				<p className="text-[11.5px] leading-snug text-[var(--color-ink-500)]">Enable attributes for this product, then choose which options variants can use.</p>
			) : (
				<header className="mb-2 px-0.5">
					<h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--color-ink-500)]">Attributes</h3>
					<p className="mt-1 text-[10.5px] leading-snug text-[var(--color-ink-400)]">Toggle on, pick options, or add product-only options below.</p>
				</header>
			)}

			{sortedAttributes.length === 0 ? (
				<p className="text-[12px] text-[var(--color-ink-500)]">No attributes for this category.</p>
			) : (
				<ul className="flex flex-col gap-1.5">
					{sortedAttributes.map((attribute) => {
						const isEnabled = config.attributeSlugs.includes(attribute.slug);
						const isExpanded = isEnabled && expandedSlugs.has(attribute.slug);
						const pool = effectiveProductOptionPool(config, attribute);
						const selectedPool = poolValueSet(pool);
						const allValues = attribute.options.map((option) => option.value);
						const customOptions = config.attributeCustomOptions?.[attribute.slug] ?? [];
						const sortedOptions = sortAttributeOptions(attribute.options, attribute.unit);
						const customDraft = customDrafts[attribute.slug] ?? "";
						const customError = customErrors[attribute.slug];
						const slugPreview = previewProductCustomOptionSlug(attribute, customDraft);

						return (
							<li
								key={attribute.id}
								className={classNames(
									"overflow-hidden rounded-[var(--radius-lg)] border transition-[border-color,box-shadow,background-color] duration-200",
									isEnabled
										? isExpanded
											? "border-[var(--color-accent-300)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)] ring-1 ring-[var(--color-accent-100)]"
											: "border-[var(--color-ink-200)] bg-[var(--color-surface)] shadow-[var(--shadow-sm)]"
										: "border-[var(--color-ink-100)] bg-[var(--color-canvas)]",
								)}
							>
								<div className="flex items-center gap-2 px-2.5 py-2">
									<button
										type="button"
										disabled={!isEnabled}
										onClick={() => handleAccordionToggle(attribute.slug, isEnabled)}
										className={classNames(
											"flex min-w-0 flex-1 items-center gap-2 text-left transition-opacity",
											isEnabled ? "cursor-pointer hover:opacity-80" : "cursor-default opacity-70",
										)}
									>
										<ChevronDown
											size={14}
											strokeWidth={2.25}
											aria-hidden
											className={classNames(
												"shrink-0 text-[var(--color-ink-400)] transition-transform duration-200",
												isExpanded ? "rotate-180 text-[var(--color-accent-600)]" : "",
												!isEnabled && "opacity-40",
											)}
										/>
										<span
											className={classNames(
												"truncate text-[13px] tracking-tight",
												isEnabled ? "font-semibold text-[var(--color-ink-900)]" : "font-medium text-[var(--color-ink-600)]",
											)}
										>
											{attribute.label}
										</span>
										{isEnabled ? (
											<span className="shrink-0 rounded-full bg-[var(--color-canvas-deep)] px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--color-ink-500)]">
												{pool.length}/{allValues.length + customOptions.length}
											</span>
										) : null}
									</button>
									<Toggle checked={isEnabled} onCheckedChange={(checked) => toggleAttribute(attribute.slug, checked)} aria-label={`Enable ${attribute.label}`} />
								</div>

								{isExpanded ? (
									<div className="space-y-3 border-t border-[var(--color-ink-100)] bg-gradient-to-b from-[var(--color-surface)] to-[var(--color-canvas)] px-2.5 py-3">
										{sortedOptions.length > 0 ? (
											<div className="flex flex-wrap gap-1.5" role="group" aria-label={`${attribute.label} catalog options`}>
												{sortedOptions.map((option) => {
													const isSelected = selectedPool.has(option.value.toLowerCase());
													return (
														<OptionPoolPill
															key={option.value}
															label={formatAttributeOptionLabel(option.label, attribute.unit)}
															isSelected={isSelected}
															onToggle={() => togglePoolOption(attribute, option.value)}
														/>
													);
												})}
											</div>
										) : null}

										{pool.length === 0 ? (
											<p className="rounded-md border border-dashed border-[var(--color-amber-200)] bg-[var(--color-amber-50)] px-2.5 py-2 text-[11px] leading-snug text-[var(--color-amber-800)]">
												No options selected — add options before creating variants.
											</p>
										) : null}

										<div className="space-y-1.5 border-t border-[var(--color-ink-100)] pt-2.5">
											<p className="text-[10.5px] font-semibold uppercase tracking-[0.12em] text-[var(--color-ink-500)]">Customized</p>
											{customOptions.length > 0 ? (
												<div className="flex flex-wrap gap-1.5" role="group" aria-label={`${attribute.label} customized options`}>
													{[...customOptions]
														.sort((left, right) => compareAlphabetically(left.label, right.label))
														.map((option) => {
															const isSelected = selectedPool.has(option.value.toLowerCase());
															return (
																<OptionPoolPill
																	key={option.value}
																	label={option.label}
																	isSelected={isSelected}
																	onToggle={() => togglePoolOption(attribute, option.value)}
																	onRemove={() => handleRemoveCustom(attribute.slug, option.value)}
																/>
															);
														})}
												</div>
											) : null}
											<div className="flex items-center rounded-full border border-[var(--color-ink-200)] bg-[var(--color-surface)] py-1 pl-3 pr-1 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow] focus-within:border-[var(--color-accent-500)] focus-within:ring-2 focus-within:ring-[var(--color-accent-100)]">
												<input
													type="text"
													value={customDraft}
													onChange={(event) => {
														const value = event.target.value;
														setCustomDrafts((current) => ({
															...current,
															[attribute.slug]: value,
														}));
														if (customErrors[attribute.slug]) {
															setCustomErrors((current) => {
																const next = { ...current };
																delete next[attribute.slug];
																return next;
															});
														}
													}}
													onKeyDown={(event) => {
														if (event.key !== "Enter") {
															return;
														}
														event.preventDefault();
														event.stopPropagation();
														handleAddCustom(attribute);
													}}
													placeholder={`Add ${attribute.label.toLowerCase()} option…`}
													maxLength={48}
													className="min-w-0 flex-1 border-0 bg-transparent py-1 text-[12px] text-[var(--color-ink-900)] placeholder:text-[var(--color-ink-400)] focus:outline-none"
												/>
												<button
													type="button"
													disabled={!customDraft.trim()}
													onClick={() => handleAddCustom(attribute)}
													className="shrink-0 rounded-full border border-[var(--color-accent-500)] bg-[var(--color-accent-500)] px-3 py-1 text-[11px] font-semibold text-[var(--color-accent-800)] transition hover:bg-[var(--color-accent-400)] disabled:cursor-not-allowed disabled:opacity-40"
												>
													Add
												</button>
											</div>
											{slugPreview ? (
												<p className="text-[10px] text-[var(--color-ink-500)]">
													Slug: <code className="rounded bg-[var(--color-canvas-deep)] px-1 py-0.5 text-[10px] text-[var(--color-ink-700)]">{slugPreview}</code>
												</p>
											) : null}
											{customError ? <p className="text-[11px] font-medium text-[var(--color-rose-700)]">{customError}</p> : null}
										</div>
									</div>
								) : null}
							</li>
						);
					})}
				</ul>
			)}
			{errorByPath?.get("attributeConfig") ? <p className="text-[12px] text-[var(--color-rose-700)]">{errorByPath.get("attributeConfig")}</p> : null}
		</div>
	);
}

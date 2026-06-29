"use client";

import { useState, type FormEvent } from "react";
import { Trash2, Plus } from "lucide-react";
import { Button, QuantityStepper } from "@store/ui";
import { SelectField } from "@/components/forms/SelectField";
import { TextField } from "@/components/forms/TextField";
import { Modal } from "@/components/ui/Modal";
import { formatPrice, pointsToRupees } from "@store/shared";
import type { AdminOrder, AdminOrderEditPayload } from "@/types/models";

interface OrderEditModalProps {
	isOpen: boolean;
	onClose: () => void;
	order: AdminOrder;
	onSave: (payload: AdminOrderEditPayload) => Promise<void>;
	isSaving: boolean;
}

export function OrderEditModal({ isOpen, onClose, order, onSave, isSaving }: OrderEditModalProps) {
	const [editedItems, setEditedItems] = useState(order.items);
	const [editedAddress, setEditedAddress] = useState(order.address ?? null);
	const [editedPayment, setEditedPayment] = useState(order.payment);
	const [editedDelivery, setEditedDelivery] = useState(order.delivery);

	const emptyAddressFields = (): NonNullable<AdminOrder["address"]> => ({
		recipientName: order.address?.recipientName ?? "",
		phoneNumber: order.address?.phoneNumber ?? order.customer.phoneNumber,
		city: order.address?.city ?? order.customer.city,
		area: order.address?.area,
		street: order.address?.street,
		postalCode: order.address?.postalCode,
	});

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		await onSave({
			items: editedItems,
			address: editedAddress,
			payment: editedPayment,
			delivery: editedDelivery,
		});
	}

	const subtotal = editedItems.reduce((acc, item) => acc + item.unitPriceRupees * item.quantity, 0);
	const pointsRedeemedRupees = pointsToRupees(order.pointsRedeemed);
	const total = Math.max(
		0,
		subtotal +
			order.totals.shippingRupees -
			order.totals.discountRupees +
			(order.totals.paymentSurchargeRupees ?? 0) -
			pointsRedeemedRupees,
	);

	return (
		<Modal
			isOpen={isOpen}
			onClose={onClose}
			title={`Edit Order ${order.orderNumber}`}
			maxWidth="2xl"
			footer={
				<div className="flex justify-end">
					<Button variant="primary" size="md" type="submit" form="order-edit-form" isLoading={isSaving}>
						Save changes
					</Button>
				</div>
			}
		>
			<form id="order-edit-form" onSubmit={handleSubmit} className="space-y-6">
				<section className="grid gap-3 sm:grid-cols-2">
					<SelectField
						label="Payment method"
						value={editedPayment}
						onChange={(e) => setEditedPayment(e.target.value)}
						options={[
							{ value: "bank-transfer", label: "Bank transfer" },
							{ value: "card", label: "Card payment" },
							{ value: "cod", label: "Cash on delivery" },
						]}
					/>
					<SelectField
						label="Delivery method"
						value={editedDelivery}
						onChange={(e) => setEditedDelivery(e.target.value)}
						options={[
							{ value: "courier", label: "Courier" },
							{ value: "pickup", label: "Store Pickup" },
						]}
					/>
				</section>

				<section>
					<p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Delivery address</p>
					<div className="grid gap-3 sm:grid-cols-2">
						<TextField
							label="Name"
							value={editedAddress?.recipientName || ""}
							onChange={(event) => setEditedAddress({ ...emptyAddressFields(), ...editedAddress, recipientName: event.target.value })}
						/>
						<TextField
							label="Phone"
							value={editedAddress?.phoneNumber || ""}
							onChange={(event) => setEditedAddress({ ...emptyAddressFields(), ...editedAddress, phoneNumber: event.target.value })}
						/>
						<div className="sm:col-span-2">
							<TextField
								label="Delivery address"
								value={editedAddress?.street || ""}
								onChange={(event) => setEditedAddress({ ...emptyAddressFields(), ...editedAddress, street: event.target.value })}
							/>
						</div>
					</div>
				</section>

				<section>
					<p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--color-ink-500)]">Line items</p>
					<ul className="space-y-3">
						{editedItems.map((line, index) => (
							<li
								key={line.id || index}
								className="flex flex-col gap-2 sm:flex-row sm:items-start text-sm text-[var(--color-ink-800)] border border-[var(--color-ink-100)] rounded p-2 bg-[var(--color-canvas-deep)]/40"
							>
								<div className="flex-1 flex flex-col gap-1 min-w-[200px] justify-center">
									{line.isNewCustom ? (
										<>
											<input
												type="text"
												className="w-full rounded border border-transparent hover:border-[var(--color-ink-200)] focus:border-[var(--color-accent-500)] px-2 py-1 text-sm font-semibold bg-[var(--color-surface)] outline-none transition-colors"
												value={line.productName}
												placeholder="Product name"
												onChange={(e) => {
													const next = [...editedItems];
													next[index].productName = e.target.value;
													setEditedItems(next);
												}}
											/>
											<input
												type="text"
												className="w-full rounded border border-transparent hover:border-[var(--color-ink-200)] focus:border-[var(--color-accent-500)] px-2 py-1 text-xs bg-[var(--color-surface)] outline-none transition-colors text-[var(--color-ink-600)]"
												value={line.variantSummary}
												placeholder="Variant details"
												onChange={(e) => {
													const next = [...editedItems];
													next[index].variantSummary = e.target.value;
													setEditedItems(next);
												}}
											/>
										</>
									) : (
										<>
											<p className="text-sm font-semibold text-[var(--color-ink-900)]">{line.productName}</p>
											<p className="text-xs text-[var(--color-ink-500)]">{line.variantSummary}</p>
										</>
									)}
								</div>
								<div className="flex items-center justify-between sm:justify-end gap-3 mt-2 sm:mt-0">
									<QuantityStepper
										quantity={line.quantity}
										max={99}
										size="sm"
										onChange={(qty) => {
											const next = [...editedItems];
											next[index].quantity = qty;
											setEditedItems(next);
										}}
									/>
									<div className="flex items-center gap-1">
										<span className="text-xs text-[var(--color-ink-500)]">Rs</span>
										<input
											type="number"
											className="w-24 rounded border border-[var(--color-ink-200)] px-2 py-1 text-sm font-semibold text-right bg-transparent outline-none focus:border-[var(--color-accent-500)]"
											value={line.unitPriceRupees}
											min={0}
											onChange={(e) => {
												const next = [...editedItems];
												next[index].unitPriceRupees = parseInt(e.target.value, 10) || 0;
												setEditedItems(next);
											}}
										/>
									</div>
									<button
										type="button"
										className="text-[var(--color-danger-500)] hover:text-[var(--color-danger-700)] p-1.5 rounded-full hover:bg-[var(--color-danger-50)] transition-colors"
										onClick={() => setEditedItems(editedItems.filter((_, i) => i !== index))}
										title="Remove item"
									>
										<Trash2 size={15} />
									</button>
								</div>
							</li>
						))}
						{editedItems.length === 0 && <p className="text-sm text-[var(--color-ink-500)] py-2">No items in order.</p>}
						<div className="pt-2">
							<Button
								type="button"
								variant="secondary"
								size="sm"
								leadingIcon={<Plus size={13} />}
								onClick={() => {
									setEditedItems([
										...editedItems,
										{
											id: crypto.randomUUID().replace(/-/g, "").slice(0, 24),
											productId: crypto.randomUUID().replace(/-/g, "").slice(0, 24),
											variantId: crypto.randomUUID().replace(/-/g, "").slice(0, 24),
											productName: "Custom Product",
											variantSummary: "",
											unitPriceRupees: 0,
											quantity: 1,
											isNewCustom: true,
										},
									]);
								}}
							>
								Add custom item
							</Button>
						</div>
					</ul>

					<div className="mt-3 space-y-1 border-t border-[var(--color-ink-100)] pt-3 text-sm">
						<div className="flex items-baseline justify-between gap-2">
							<span className="text-[var(--color-ink-500)]">Subtotal</span>
							<span className="font-medium text-[var(--color-ink-800)]">{formatPrice(subtotal)}</span>
						</div>
						<div className="flex items-baseline justify-between gap-2">
							<span className="text-[var(--color-ink-500)]">Shipping</span>
							<span className="font-medium text-[var(--color-ink-800)]">{formatPrice(order.totals.shippingRupees)}</span>
						</div>
						{order.totals.discountRupees > 0 ? (
							<div className="flex items-baseline justify-between gap-2">
								<span className="text-[var(--color-ink-500)]">Discount</span>
								<span className="font-medium text-[var(--color-ink-800)]">-{formatPrice(order.totals.discountRupees)}</span>
							</div>
						) : null}
						{(order.totals.paymentSurchargeRupees ?? 0) > 0 ? (
							<div className="flex items-baseline justify-between gap-2">
								<span className="text-[var(--color-ink-500)]">Cash handling</span>
								<span className="font-medium text-[var(--color-ink-800)]">+{formatPrice(order.totals.paymentSurchargeRupees!)}</span>
							</div>
						) : null}
						<div className="flex items-baseline justify-between gap-2 mt-2 border-t border-[var(--color-ink-100)] pt-2">
							<span className="text-[var(--color-ink-500)] font-semibold">Total</span>
							<span className="font-bold text-[var(--color-ink-900)] text-base">{formatPrice(total)}</span>
						</div>
					</div>
				</section>
			</form>
		</Modal>
	);
}

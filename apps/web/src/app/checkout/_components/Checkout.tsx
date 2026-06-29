"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import {
	computeCodSurchargeRupees,
	computeCourierShippingRupees,
	maxRedeemable,
	pointsEarnedFor,
	pointsToRupees,
	getPaymentMethods,
	CHECKOUT_TO_ORDER_PAYMENT,
} from "@store/shared";
import { launchOnlineCheckout, type OnlineCheckoutApiPayload } from "@/lib/payments/launchOnlineCheckout";
import { useCartReconciliationControls } from "@/lib/cart/useCartReconciliation";
import { getCartSnapshot } from "@/lib/cart/store";
import { useCartOfferPricing } from "@/lib/pricing/useCartOfferPricing";
import { CheckoutOfferNotices } from "@/components/shared/CheckoutOfferNotices";
import { useStoreSettings } from "@/lib/core/storeSettingsContext";
import { useNavigationTransition } from "@/lib/navigation/navigationProgress";
import type { AccountAddress, AccountCustomer } from "@/lib/core/account";
import { resolvePublicErrorMessage } from "@/lib/errors/publicErrorMessage";
import { STOREFRONT_SHELL_CLASS } from "@/lib/layout/storefrontShell";
import { useCart } from "@/lib/cart/useCart";
import {
	CheckoutHeader,
	CheckoutSignInPanel,
	ContactPanel,
	DeliveryPanel,
	EmptyCartState,
	LoyaltyPanel,
	OrderSummaryPanel,
	OrderSummaryPreview,
	PaymentPanel,
	type AddressFormState,
	type DeliveryMethod,
	type PaymentMethodId,
} from "@/app/checkout/_components/CheckoutPanels";

const EMPTY_ADDRESS: AddressFormState = {
	street: "",
};

interface CheckoutProps {
	customer: AccountCustomer | null;
	paymentCancelled?: boolean;
	cancelledOrderNumber?: string;
}

function addressToForm(address: AccountAddress | undefined): AddressFormState {
	if (!address) {
		return EMPTY_ADDRESS;
	}
	return {
		street: address.street ?? "",
	};
}

export function Checkout({ customer, paymentCancelled = false, cancelledOrderNumber = "" }: CheckoutProps) {
	const router = useRouter();
	const { startNavigation } = useNavigationTransition();
	const cart = useCart();
	const { ensureReconciled, isReconciling } = useCartReconciliationControls();
	const settings = useStoreSettings();
	const [payment, setPayment] = useState<PaymentMethodId>("bank-transfer");
	const { pricing, appliedOffers, isOffersLoading } = useCartOfferPricing(payment);
	const enabledPaymentMethods = useMemo(() => getPaymentMethods(settings), [settings]);

	const defaultAddress = customer?.addresses.find((candidate) => candidate.isDefault) ?? customer?.addresses[0];
	const [fullName, setFullName] = useState(customer?.name ?? "");
	const [phoneNumber, setPhoneNumber] = useState(customer?.phoneNumber ?? "");
	const [delivery, setDelivery] = useState<DeliveryMethod>("pickup");
	const [address, setAddress] = useState<AddressFormState>(() => addressToForm(defaultAddress));
	const [isPlacing, setIsPlacing] = useState<boolean>(false);
	const [shouldRedeemLoyalty, setShouldRedeemLoyalty] = useState<boolean>(false);
	const [loyaltyBalance, setLoyaltyBalance] = useState<number>(0);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	// Stable across retries of the same attempt so a double-click / flaky network
	// can't place two orders; reset only after a confirmed success.
	const idempotencyKeyRef = useRef<string | null>(null);

	const subtotalRupees = cart.subtotalRupees;
	const subtotalAfterOffersRupees = pricing.finalTotal;

	const maxPointsForOrder = useMemo(
		() => maxRedeemable(subtotalAfterOffersRupees, loyaltyBalance),
		[subtotalAfterOffersRupees, loyaltyBalance],
	);

	const cappedPointsToUse = shouldRedeemLoyalty ? maxPointsForOrder : 0;

	const totals = useMemo(() => {
		const itemCount = cart.itemCount;
		const subtotalAfterOffersRupees = pricing.finalTotal;
		const offersDiscountRupees = pricing.totalDiscount;
		const paymentSurchargeRupees =
			payment === "cod" ? computeCodSurchargeRupees(subtotalAfterOffersRupees, settings.codSurchargePercent) : 0;
		const deliveryRupees = computeCourierShippingRupees({
			isCourierDelivery: delivery === "delivery",
			subtotalAfterOffersRupees,
			freeDeliveryThresholdRupees: settings.freeDeliveryThresholdRupees,
			courierFlatFeeRupees: settings.courierFlatFeeRupees,
			offerGrantsFreeShipping: pricing.freeShipping,
		});
		const pointsRedeemedRupees = pricing.isLoyaltyPointsAllowed ? pointsToRupees(cappedPointsToUse) : 0;
		const totalRupees = Math.max(0, subtotalAfterOffersRupees + paymentSurchargeRupees + deliveryRupees - pointsRedeemedRupees);
		return {
			itemCount,
			subtotalRupees: cart.subtotalRupees,
			offersDiscountRupees,
			paymentSurchargeRupees,
			deliveryRupees,
			pointsRedeemedRupees,
			totalRupees,
		};
	}, [
		cart.itemCount,
		cart.subtotalRupees,
		pricing.finalTotal,
		pricing.totalDiscount,
		pricing.isLoyaltyPointsAllowed,
		delivery,
		payment,
		cappedPointsToUse,
		pricing.freeShipping,
		settings.codSurchargePercent,
		settings.freeDeliveryThresholdRupees,
		settings.courierFlatFeeRupees,
	]);

	const pointsEarnedOnThisOrder = pointsEarnedFor(totals.totalRupees, settings.loyaltyEarnPercent);

	const isAddressValid = delivery === "pickup" || address.street.trim().length >= 2;

	const isPricingReady = !isOffersLoading;
	const hasPaymentMethod = enabledPaymentMethods.length > 0;

	const isValid =
		!cart.isEmpty && fullName.trim().length > 1 && phoneNumber.trim().length >= 7 && isAddressValid && isPricingReady && hasPaymentMethod;

	useEffect(() => {
		if (enabledPaymentMethods.length === 0) {
			return;
		}
		if (!enabledPaymentMethods.some((method) => method.id === payment)) {
			// eslint-disable-next-line react-hooks/set-state-in-effect -- clamp selection when enabled methods change
			setPayment(enabledPaymentMethods[0]?.id ?? "bank-transfer");
		}
	}, [enabledPaymentMethods, payment]);

	const lookupLoyalty = async () => {
		try {
			const response = await fetch("/api/loyalty-balance", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
			});
			if (!response.ok) {
				return;
			}
			const data = (await response.json()) as { isMember: boolean; balance: number };
			setLoyaltyBalance(data.isMember ? data.balance : 0);
		} catch {
			// Network errors are non-fatal — checkout continues without loyalty.
		}
	};

	useEffect(() => {
		if (!customer?.id) {
			return;
		}
		const timeoutId = window.setTimeout(() => {
			void lookupLoyalty();
		}, 0);
		return () => window.clearTimeout(timeoutId);
	}, [customer?.id]);

	const handlePlaceOrder = async () => {
		if (!isValid || isPlacing || isReconciling) {
			return;
		}
		setErrorMessage(null);
		setIsPlacing(true);
		if (!idempotencyKeyRef.current) {
			idempotencyKeyRef.current = crypto.randomUUID();
		}
		try {
			const reconciled = await ensureReconciled();
			if (!reconciled) {
				setErrorMessage("Your cart could not be refreshed. Check your connection and try again.");
				setIsPlacing(false);
				return;
			}
			const freshItems = getCartSnapshot().items;
			if (freshItems.length === 0) {
				setErrorMessage("Your cart is empty. Add items from the shop before placing an order.");
				setIsPlacing(false);
				return;
			}
			const response = await fetch("/api/orders", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					customer: { name: fullName },
					delivery: delivery === "delivery" ? "courier" : "pickup",
					payment: CHECKOUT_TO_ORDER_PAYMENT[payment],
					address:
						delivery === "delivery"
							? {
									recipientName: fullName,
									street: address.street || undefined,
								}
							: undefined,
					items: freshItems.map((line) => ({
						productId: line.productId,
						variantId: line.variantId,
						quantity: line.quantity,
						attributes: line.attributes ?? {},
						...(line.appliedOffer
							? {
									appliedOfferId: line.appliedOffer.id,
									appliedOfferLockedAt: line.appliedOffer.lockedAt,
								}
							: line.appliedOfferId
								? { appliedOfferId: line.appliedOfferId }
								: {}),
					})),
					loyalty: {
						redeemPoints: cappedPointsToUse,
					},
					idempotencyKey: idempotencyKeyRef.current,
				}),
			});

			if (!response.ok) {
				const data = (await response.json().catch(() => null)) as { error?: string } | null;
				setErrorMessage(data?.error ?? "Could not place your order. Please try again.");
				setIsPlacing(false);
				return;
			}

			const data = (await response.json()) as OnlineCheckoutApiPayload & {
				orderNumber: string;
				totalRupees?: number;
				pointsEarned?: number;
				pointsRedeemed?: number;
			};

			if (data.checkoutUrl || data.checkoutForm) {
				if (!data.checkoutUrl && (!data.checkoutForm?.postUrl || !data.checkoutForm?.fields)) {
					setErrorMessage("Online payment could not be started. Try again or choose bank transfer / cash on delivery.");
					setIsPlacing(false);
					return;
				}
				cart.clear();
				idempotencyKeyRef.current = null;
				launchOnlineCheckout(data);
				return;
			}

			cart.clear();
			const params = new URLSearchParams({
				order: data.orderNumber,
				payment,
				total: String(data.totalRupees ?? totals.totalRupees),
				earned: String(data.pointsEarned ?? pointsEarnedOnThisOrder),
			});
			const serverRedeemed = data.pointsRedeemed ?? cappedPointsToUse;
			if (serverRedeemed > 0) {
				params.set("redeemed", String(serverRedeemed));
			}
			// Order confirmed — the next placement should get a fresh key.
			idempotencyKeyRef.current = null;
			const url = `/checkout/success?${params.toString()}`;
			startNavigation(() => router.push(url));
		} catch (error) {
			setErrorMessage(resolvePublicErrorMessage(error, "Could not place your order. Please try again."));
			setIsPlacing(false);
		}
	};

	if (cart.isEmpty) {
		return <EmptyCartState />;
	}

	if (!customer) {
		return (
			<div className={`${STOREFRONT_SHELL_CLASS} pb-24 pt-4 md:pb-16 md:pt-10`}>
				<CheckoutHeader />
				<div className="reveal mt-4 md:mt-5">
					<CheckoutOfferNotices appliedOffers={appliedOffers} />
				</div>
				<div className="mt-5 grid gap-6 md:mt-8 md:grid-cols-[minmax(0,1fr)_360px] lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-8">
					<div className="reveal">
						<CheckoutSignInPanel />
					</div>
					<aside className="space-y-3 md:space-y-4">
						<div className="reveal">
							<OrderSummaryPreview totals={totals} delivery={delivery} payment={payment} />
						</div>
					</aside>
				</div>
			</div>
		);
	}

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				void handlePlaceOrder();
			}}
			className={`${STOREFRONT_SHELL_CLASS} pb-24 pt-4 md:pb-16 md:pt-10`}
		>
			<CheckoutHeader />

			{paymentCancelled ? (
				<div className="reveal mt-4 rounded-[var(--radius-md)] border border-[var(--color-warn-200)] bg-[var(--color-warn-50)] px-4 py-3 md:mt-5">
					<div className="flex items-start gap-3">
						<AlertTriangle size={18} className="mt-0.5 shrink-0 text-[var(--color-warn-700)]" />
						<div className="min-w-0 text-[13px] leading-snug text-[var(--color-warn-900)]">
							<p className="font-semibold">Online payment was not completed.</p>
							<p className="mt-1 text-[var(--color-warn-800)]">
								{cancelledOrderNumber ? (
									<>
										Your order <span className="font-mono font-semibold">{cancelledOrderNumber}</span> is still waiting for payment.{" "}
										<Link href={`/account/orders/${encodeURIComponent(cancelledOrderNumber)}`} className="font-semibold underline">
											Complete payment in your account
										</Link>{" "}
										or choose bank transfer / cash on delivery for a new order.
									</>
								) : (
									<>You can place a new order below or open your account to finish a pending payment.</>
								)}
							</p>
						</div>
					</div>
				</div>
			) : null}

			<div className="reveal mt-4 md:mt-5">
				<CheckoutOfferNotices appliedOffers={appliedOffers} />
			</div>

			<div className="mt-5 grid gap-6 md:mt-8 md:grid-cols-[1fr_360px] lg:grid-cols-[1fr_400px] lg:gap-8">
				<div className="reveal-stagger space-y-3 md:space-y-4">
					<div className="reveal">
						<ContactPanel fullName={fullName} phoneNumber={phoneNumber} onFullName={setFullName} isPlacing={isPlacing} />
					</div>
					<div className="reveal">
						<DeliveryPanel delivery={delivery} onChange={setDelivery} address={address} onAddressChange={setAddress} isPlacing={isPlacing} />
					</div>
					<div className="reveal">
						<PaymentPanel
							payment={payment}
							onChange={setPayment}
							isPlacing={isPlacing}
							totalRupees={totals.totalRupees}
							paymentSurchargeRupees={totals.paymentSurchargeRupees}
						/>
					</div>
				</div>

				<aside className="reveal-stagger space-y-3 md:space-y-4">
					{loyaltyBalance > 0 && (
						<div className="reveal">
							<LoyaltyPanel
								balance={loyaltyBalance}
								maxPointsForOrder={maxPointsForOrder}
								shouldRedeemLoyalty={shouldRedeemLoyalty}
								onToggle={setShouldRedeemLoyalty}
								isAllowedWithOffers={pricing.isLoyaltyPointsAllowed}
							/>
						</div>
					)}
					<div className="reveal">
						<OrderSummaryPanel
							totals={totals}
							payment={payment}
							delivery={delivery}
							isPlacing={isPlacing || isReconciling}
							isValid={isValid && !isReconciling}
							pointsEarnedOnThisOrder={pointsEarnedOnThisOrder}
							pointsRedeemed={cappedPointsToUse}
							errorMessage={errorMessage}
							infoMessage={
								!hasPaymentMethod
									? "Checkout is paused — no payment methods are enabled. Contact the store."
									: isOffersLoading
										? "Updating offers and delivery…"
										: null
							}
						/>
					</div>
				</aside>
			</div>
		</form>
	);
}

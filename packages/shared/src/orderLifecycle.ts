/** Order statuses a signed-in customer may cancel without staff help. */
export const CUSTOMER_CANCELLABLE_ORDER_STATUSES = ["pending-payment", "confirmed"] as const;

export type CustomerCancellableOrderStatus = (typeof CUSTOMER_CANCELLABLE_ORDER_STATUSES)[number];

export function isCustomerCancellableOrderStatus(status: string): status is CustomerCancellableOrderStatus {
	return (CUSTOMER_CANCELLABLE_ORDER_STATUSES as readonly string[]).includes(status);
}

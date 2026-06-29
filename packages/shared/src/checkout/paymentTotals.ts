/** Extra % added to the order subtotal when the customer pays cash on delivery. */
export function computeCodSurchargeRupees(subtotalRupees: number, codSurchargePercent: number): number {
	const percent = Math.max(0, codSurchargePercent);
	if (percent <= 0 || subtotalRupees <= 0) {
		return 0;
	}
	return Math.round((subtotalRupees * percent) / 100);
}

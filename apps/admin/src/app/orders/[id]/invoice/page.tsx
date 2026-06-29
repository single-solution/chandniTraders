import { notFound } from "next/navigation";
import { Order, connectDB, getStoreSettings } from "@store/db";
import { formatPrice, STORE_SETTING_DEFAULTS } from "@store/shared";
import { requirePagePermission } from "@/lib/server/requirePageSession";
import type { OrderLean } from "@/lib/serializers/order";
import { AutoPrint } from "./_components/AutoPrint";

export default async function InvoicePage(props: { params: Promise<{ id: string }> }) {
	await requirePagePermission("order_view", "/orders");
	const params = await props.params;

	await connectDB();
	const [order, storeSettings] = await Promise.all([Order.findById(params.id).lean<OrderLean>(), getStoreSettings()]);

	if (!order) {
		return notFound();
	}

	const siteName = storeSettings.siteName?.trim() || STORE_SETTING_DEFAULTS.siteName;
	const siteTagline = storeSettings.siteTagline?.trim() || "Professional Sales & Service";
	const publicSiteUrl = (storeSettings.publicSiteUrl?.trim() || "https://chandnitraders.pk").replace(/\/$/, "");
	const siteUrlLabel = publicSiteUrl.replace(/^https?:\/\//, "");

	const paymentLabel = order.payment === "cod" ? "Cash on Delivery" : order.payment;
	const deliveryLabel = order.delivery === "pickup" ? "Store Pickup" : "Courier";

	return (
		<div className="mx-auto max-w-3xl bg-white p-8 text-black print:p-0">
			<div className="mb-8 flex items-start justify-between border-b border-gray-200 pb-4">
				<div>
					<h1 className="text-3xl font-bold uppercase tracking-widest text-gray-900">Invoice</h1>
					<p className="mt-1 text-sm text-gray-500">Order #{order.orderNumber}</p>
				</div>
				<div className="text-right">
					<p className="text-xl font-bold">{siteName}</p>
					<p className="text-sm text-gray-500">{siteTagline}</p>
					<p className="text-sm text-gray-500">{siteUrlLabel}</p>
				</div>
			</div>

			<div className="mb-8 grid grid-cols-2 gap-8">
				<div>
					<h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Billed To</h2>
					<p className="font-semibold text-gray-900">{order.address?.recipientName || "Customer"}</p>
					<p className="text-sm text-gray-700">{order.address?.phoneNumber}</p>
					<p className="mt-1 text-sm leading-relaxed text-gray-700">
						{[order.address?.street, order.address?.area, order.address?.city, order.address?.postalCode].filter(Boolean).join(", ")}
					</p>
				</div>
				<div className="text-right">
					<h2 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Order Details</h2>
					<p className="text-sm text-gray-700">
						<span className="font-medium">Date:</span> {new Date(order.createdAt).toLocaleDateString()}
					</p>
					<p className="text-sm text-gray-700">
						<span className="font-medium">Payment:</span> {paymentLabel}
					</p>
					<p className="text-sm text-gray-700">
						<span className="font-medium">Delivery:</span> {deliveryLabel}
					</p>
				</div>
			</div>

			<div className="mb-8">
				<table className="w-full text-left text-sm text-gray-800">
					<thead>
						<tr className="border-b-2 border-gray-900 text-[10px] uppercase tracking-[0.14em] text-gray-500">
							<th className="pb-2 font-semibold">Item</th>
							<th className="pb-2 text-center font-semibold">Warranty</th>
							<th className="pb-2 text-right font-semibold">Qty</th>
							<th className="pb-2 text-right font-semibold">Unit Price</th>
							<th className="pb-2 text-right font-semibold">Total</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-gray-200">
						{order.items.map((item) => (
							<tr key={String(item._id)}>
								<td className="py-3 pr-2">
									<p className="font-semibold text-gray-900">{item.productName}</p>
									<p className="text-xs text-gray-500">{item.variantSummary}</p>
								</td>
								<td className="py-3 text-center text-xs text-gray-500">
									{/* Default warranty text, can be dynamic if order stores it */}
									Official Warranty
								</td>
								<td className="py-3 pl-2 text-right font-medium">{item.quantity}</td>
								<td className="py-3 pl-2 text-right">{formatPrice(item.unitPriceRupees)}</td>
								<td className="py-3 pl-2 text-right font-semibold text-gray-900">{formatPrice(item.unitPriceRupees * item.quantity)}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="flex justify-end">
				<div className="w-64 space-y-2 text-sm text-gray-800">
					<div className="flex justify-between">
						<span className="text-gray-500">Subtotal</span>
						<span>{formatPrice(order.totals.subtotalRupees)}</span>
					</div>
					<div className="flex justify-between">
						<span className="text-gray-500">Shipping</span>
						<span>{formatPrice(order.totals.shippingRupees)}</span>
					</div>
					{order.totals.discountRupees > 0 && (
						<div className="flex justify-between">
							<span className="text-gray-500">Discount</span>
							<span>-{formatPrice(order.totals.discountRupees)}</span>
						</div>
					)}
					{(order.totals.paymentSurchargeRupees ?? 0) > 0 && (
						<div className="flex justify-between">
							<span className="text-gray-500">Cash handling</span>
							<span>+{formatPrice(order.totals.paymentSurchargeRupees!)}</span>
						</div>
					)}
					<div className="mt-2 flex justify-between border-t-2 border-gray-900 pt-2 text-lg font-bold text-gray-900">
						<span>Total</span>
						<span>{formatPrice(order.totals.totalRupees)}</span>
					</div>
				</div>
			</div>

			<div className="mt-16 border-t border-gray-200 pt-8 text-center text-xs text-gray-500 print:mt-32">
				<p>Thank you for shopping with {siteName}!</p>
				<p className="mt-1">For support or warranty claims, please contact us with this invoice.</p>
			</div>

			<AutoPrint />
		</div>
	);
}

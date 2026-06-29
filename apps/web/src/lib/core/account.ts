/**
 * Server-side queries for the customer-account section of the storefront.
 *
 * These run inside server components and route handlers — they require an
 * authenticated session (role = "customer") and they always scope queries
 * by `customerId` so a customer can never read another customer's data.
 */

import { Types } from "mongoose";

import {
	Customer,
	LoyaltyAccount,
	Order as OrderModel,
	connectDB,
	type CustomerAttributes,
	type LoyaltyAccountAttributes,
	type OrderAttributes,
	type WithTimestamps,
} from "@store/db";
import { asArray, asNumber, asString, objectIdString, toIsoDate } from "@store/shared";

import { toOrder, type Order } from "@/lib/core/orderSerializer";

export interface AccountCustomer {
	id: string;
	name: string;
	phoneNumber: string;
	city: string;
	isLoyaltyMember: boolean;
	joinedAt: string;
	addresses: AccountAddress[];
}

export interface AccountAddress {
	id: string;
	label?: string;
	recipientName: string;
	phoneNumber: string;
	city: string;
	area?: string;
	street?: string;
	postalCode?: string;
	isDefault: boolean;
}

interface AccountLoyalty {
	balance: number;
	lifetimeEarned: number;
	pendingFromShipping: number;
}

/** Fetch the customer the session is tied to. Returns null if missing. */
export async function getAccountCustomer(customerId: string): Promise<AccountCustomer | null> {
	if (!Types.ObjectId.isValid(customerId)) {
		return null;
	}
	await connectDB();
	const customer = await Customer.findById(customerId).lean<WithTimestamps<CustomerAttributes> & { _id: Types.ObjectId }>();
	if (!customer) {
		return null;
	}

	return {
		id: objectIdString(customer._id),
		name: asString(customer.name, "Customer"),
		phoneNumber: asString(customer.phoneNumber),
		city: asString(customer.city),
		isLoyaltyMember: customer.isLoyaltyMember ?? false,
		joinedAt: toIsoDate(customer.createdAt),
		addresses: asArray<NonNullable<CustomerAttributes["addresses"]>[number]>(customer.addresses).map((address) => ({
			id: objectIdString(address?._id) || `${objectIdString(customer._id)}:${asString(address?.recipientName)}`,
			label: address.label,
			recipientName: asString(address.recipientName),
			phoneNumber: asString(address.phoneNumber),
			city: asString(address.city),
			area: address.area,
			street: address.street,
			postalCode: address.postalCode,
			isDefault: address.isDefault ?? false,
		})),
	};
}

/** Customer's order history, newest first. */
export async function getAccountOrders(customerId: string, limit = 50): Promise<Order[]> {
	if (!Types.ObjectId.isValid(customerId)) {
		return [];
	}
	await connectDB();
	const orders = await OrderModel.find({ customerId: new Types.ObjectId(customerId) })
		.sort({ placedAt: -1 })
		.limit(limit)
		.lean<(OrderAttributes & { _id: Types.ObjectId })[]>();
	return orders.map(toOrder);
}

/** Single order — only returns it if it belongs to this customer. */
export async function getAccountOrder(customerId: string, orderNumber: string): Promise<Order | null> {
	if (!Types.ObjectId.isValid(customerId)) {
		return null;
	}
	await connectDB();
	const order = await OrderModel.findOne({
		customerId: new Types.ObjectId(customerId),
		orderNumber,
	}).lean<OrderAttributes & { _id: Types.ObjectId }>();
	return order ? toOrder(order) : null;
}

/** Loyalty balance for a customer; returns null if they aren't a member. */
async function getAccountLoyalty(customerId: string): Promise<AccountLoyalty | null> {
	if (!Types.ObjectId.isValid(customerId)) {
		return null;
	}
	await connectDB();
	const account = await LoyaltyAccount.findOne({
		customerId: new Types.ObjectId(customerId),
	}).lean<LoyaltyAccountAttributes>();
	if (!account) {
		return null;
	}
	return {
		balance: asNumber(account.balance),
		lifetimeEarned: asNumber(account.lifetimeEarned),
		pendingFromShipping: asNumber(account.pendingFromShipping),
	};
}

export interface AccountChatProfile {
	name: string;
	city: string;
	isLoyaltyMember: boolean;
	loyaltyBalance: number | null;
	addresses: AccountAddress[];
}

/**
 * Compact, session-scoped profile the chat assistant may read for a verified
 * customer: greeting name, loyalty balance, and saved delivery addresses.
 * Never includes other customers' data — scoped entirely by `customerId`.
 */
export async function getAccountChatProfile(customerId: string): Promise<AccountChatProfile | null> {
	const [customer, loyalty] = await Promise.all([getAccountCustomer(customerId), getAccountLoyalty(customerId)]);
	if (!customer) {
		return null;
	}
	return {
		name: customer.name,
		city: customer.city,
		isLoyaltyMember: customer.isLoyaltyMember,
		loyaltyBalance: loyalty?.balance ?? null,
		addresses: customer.addresses,
	};
}

/** High-level account summary used by the /account landing page. */
interface AccountOverview {
	customer: AccountCustomer;
	loyalty: AccountLoyalty | null;
	allOrders: Order[];
	activeCount: number;
	totalCount: number;
	totalSpentRupees: number;
}

const ACTIVE_STATUSES = new Set<OrderAttributes["status"]>(["pending-payment", "confirmed", "packed", "dispatched"]);

export async function getAccountOverview(customerId: string): Promise<AccountOverview | null> {
	const customer = await getAccountCustomer(customerId);
	if (!customer) {
		return null;
	}

	await connectDB();
	const [orders, loyalty] = await Promise.all([
		OrderModel.find({ customerId: new Types.ObjectId(customerId) })
			.sort({ placedAt: -1 })
			.lean<(OrderAttributes & { _id: Types.ObjectId })[]>(),
		getAccountLoyalty(customerId),
	]);

	const allOrders = asArray<OrderAttributes & { _id: Types.ObjectId }>(orders).map(toOrder);
	const activeCount = orders.filter((order) => ACTIVE_STATUSES.has(order.status)).length;
	const totalSpent = orders.filter((order) => order.status !== "cancelled" && order.status !== "refunded").reduce((sum, order) => sum + asNumber(order.totals?.totalRupees), 0);

	return {
		customer,
		loyalty,
		allOrders,
		activeCount,
		totalCount: orders.length,
		totalSpentRupees: totalSpent,
	};
}

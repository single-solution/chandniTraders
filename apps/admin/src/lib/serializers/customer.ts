import type { Types } from "mongoose";
import type { CustomerAttributes, CustomerAddressAttributes, WithTimestamps } from "@store/db";
import { asArray, asNumber, asString, objectIdString, toIsoDate } from "@store/shared";
import type { AdminCustomer, AdminCustomerAddress } from "@/types/models";

export type CustomerLean = WithTimestamps<CustomerAttributes> & { _id: Types.ObjectId };

interface CustomerStats {
	orderCount: number;
	lifetimeSpendRupees: number;
	lastOrderAt?: Date;
	loyaltyBalance?: number;
	loyaltyLifetimeEarned?: number;
}

function toAddress(address: CustomerAddressAttributes): AdminCustomerAddress {
	return {
		id: objectIdString(address?._id),
		label: address?.label,
		recipientName: asString(address?.recipientName),
		phoneNumber: asString(address?.phoneNumber),
		city: asString(address?.city),
		area: address?.area,
		street: address?.street,
		postalCode: address?.postalCode,
		isDefault: address?.isDefault ?? false,
	};
}

export function toCustomerResponse(customer: CustomerLean, stats: CustomerStats = { orderCount: 0, lifetimeSpendRupees: 0 }): AdminCustomer {
	return {
		id: objectIdString(customer?._id),
		name: asString(customer?.name, "Customer"),
		phoneNumber: asString(customer?.phoneNumber),
		city: asString(customer?.city),
		isLoyaltyMember: customer?.isLoyaltyMember ?? false,
		loyaltyBalance: asNumber(stats?.loyaltyBalance),
		loyaltyLifetimeEarned: asNumber(stats?.loyaltyLifetimeEarned),
		orderCount: asNumber(stats?.orderCount),
		lifetimeSpendRupees: asNumber(stats?.lifetimeSpendRupees),
		lastOrderAt: stats?.lastOrderAt ? toIsoDate(stats?.lastOrderAt) : undefined,
		notes: customer?.notes,
		addresses: asArray<CustomerAddressAttributes>(customer?.addresses).map(toAddress),
		createdAt: toIsoDate(customer?.createdAt),
		updatedAt: toIsoDate(customer?.updatedAt),
	};
}

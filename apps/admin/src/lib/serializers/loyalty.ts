import type { Types } from "mongoose";
import type { LoyaltyAccountAttributes, WithTimestamps } from "@store/db";
import { asArray, asNumber, asString, objectIdString, toIsoDate } from "@store/shared";
import type { AdminLoyaltyAccount } from "@/types/models";

export type LoyaltyAccountLean = WithTimestamps<LoyaltyAccountAttributes> & { _id: Types.ObjectId };

export function toLoyaltyAccountResponse(account: LoyaltyAccountLean, customerName: string): AdminLoyaltyAccount {
	return {
		id: objectIdString(account?._id),
		customerId: objectIdString(account?.customerId),
		customerName: asString(customerName, "Customer"),
		balance: asNumber(account?.balance),
		lifetimeEarned: asNumber(account?.lifetimeEarned),
		pendingFromShipping: asNumber(account?.pendingFromShipping),
		transactions: asArray<NonNullable<LoyaltyAccountAttributes["transactions"]>[number]>(account?.transactions).map((transaction) => ({
			// Lean documents always carry the auto-generated _id; the optional type
			// is only relaxed for in-memory `push` calls before save.
			id: objectIdString(transaction?._id),
			kind: transaction?.kind,
			amount: asNumber(transaction?.amount),
			occurredAt: toIsoDate(transaction?.occurredAt),
			reason: transaction?.reason,
			orderRef: transaction?.orderRef,
		})),
		createdAt: toIsoDate(account?.createdAt),
		updatedAt: toIsoDate(account?.updatedAt),
	};
}

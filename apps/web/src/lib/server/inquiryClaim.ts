import { Types } from "mongoose";

import { Inquiry as InquiryModel } from "@store/db";

export async function claimInquiriesForCustomer(args: { customerId: Types.ObjectId; phoneNumber: string }): Promise<void> {
	const phoneNumber = args.phoneNumber.trim();
	if (!phoneNumber) {
		return;
	}

	await InquiryModel.updateMany(
		{
			phoneNumber,
			$or: [{ customerId: { $exists: false } }, { customerId: null }],
		},
		{
			$set: { customerId: args.customerId },
		},
	);
}

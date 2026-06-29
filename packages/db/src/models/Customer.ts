import mongoose, { Schema, type Model } from "mongoose";

const ADDRESS_LABEL_MAX_LENGTH = 60;
const RECIPIENT_NAME_MAX_LENGTH = 120;
const PHONE_NUMBER_MAX_LENGTH = 32;
const CITY_MAX_LENGTH = 80;
const AREA_MAX_LENGTH = 120;
const STREET_MAX_LENGTH = 200;
const POSTAL_CODE_MAX_LENGTH = 16;
const CUSTOMER_NAME_MAX_LENGTH = 160;
const NOTES_MAX_LENGTH = 2_000;

export interface CustomerAddressAttributes {
	/** Mongoose-generated when pushing into the parent doc. */
	_id?: mongoose.Types.ObjectId;
	label?: string;
	recipientName: string;
	phoneNumber: string;
	city: string;
	area?: string;
	street?: string;
	postalCode?: string;
	isDefault: boolean;
}

export interface CustomerAttributes {
	name: string;
	phoneNumber: string;
	city: string;
	isLoyaltyMember: boolean;
	notes?: string;
	addresses: CustomerAddressAttributes[];
	/** Array of admin User IDs who have viewed this customer. */
	seenByAdminIds: mongoose.Types.ObjectId[];
	/** Optional account hookup once we open public sign-up. */
	userId?: mongoose.Types.ObjectId;
}

const addressSchema = new Schema<CustomerAddressAttributes>(
	{
		label: { type: String, trim: true, maxlength: ADDRESS_LABEL_MAX_LENGTH },
		recipientName: { type: String, required: true, trim: true, maxlength: RECIPIENT_NAME_MAX_LENGTH },
		phoneNumber: { type: String, required: true, trim: true, maxlength: PHONE_NUMBER_MAX_LENGTH },
		city: { type: String, required: true, trim: true, maxlength: CITY_MAX_LENGTH },
		area: { type: String, trim: true, maxlength: AREA_MAX_LENGTH },
		street: { type: String, trim: true, maxlength: STREET_MAX_LENGTH },
		postalCode: { type: String, trim: true, maxlength: POSTAL_CODE_MAX_LENGTH },
		isDefault: { type: Boolean, required: true, default: false },
	},
	{ _id: true, timestamps: false },
);

const customerSchema = new Schema<CustomerAttributes>(
	{
		name: { type: String, required: true, trim: true, maxlength: CUSTOMER_NAME_MAX_LENGTH },
		phoneNumber: { type: String, required: true, trim: true, maxlength: PHONE_NUMBER_MAX_LENGTH, index: true },
		city: { type: String, required: true, trim: true, maxlength: CITY_MAX_LENGTH },
		isLoyaltyMember: { type: Boolean, required: true, default: false },
		notes: { type: String, trim: true, maxlength: NOTES_MAX_LENGTH },
		addresses: { type: [addressSchema], default: [] },
		seenByAdminIds: { type: [{ type: Schema.Types.ObjectId, ref: "User" }], default: [] },
		userId: { type: Schema.Types.ObjectId, ref: "User" },
	},
	{ timestamps: true },
);

customerSchema.index({ name: 1 });
customerSchema.index({ createdAt: -1 });

export const Customer: Model<CustomerAttributes> = (mongoose.models.Customer as Model<CustomerAttributes>) ?? mongoose.model<CustomerAttributes>("Customer", customerSchema);

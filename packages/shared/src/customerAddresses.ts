import { FIELD_LIMITS } from "./constants";
import { isValidationError, validateString } from "./validation";

export const MAX_CUSTOMER_ADDRESSES = 6;

export interface CustomerAddressInput {
	label?: unknown;
	recipientName?: unknown;
	phoneNumber?: unknown;
	city?: unknown;
	area?: unknown;
	street?: unknown;
	postalCode?: unknown;
	isDefault?: unknown;
}

export interface ValidatedCustomerAddress {
	label?: string;
	recipientName: string;
	phoneNumber: string;
	city: string;
	area?: string;
	street?: string;
	postalCode?: string;
	isDefault: boolean;
}

function validateOptionalField(raw: unknown, label: string, max: number): { value?: string; error?: string } {
	if (raw === undefined || raw === null || raw === "") {
		return { value: undefined };
	}
	const result = validateString(raw, { label, required: false, max });
	if (isValidationError(result)) {
		return { error: result.error };
	}
	return { value: result || undefined };
}

/**
 * Validates and normalizes a customer address list for atomic replacement.
 * Ensures exactly one default when the list is non-empty.
 */
export function validateCustomerAddresses(list: unknown): { addresses: ValidatedCustomerAddress[] } | { error: string } {
	if (!Array.isArray(list)) {
		return { error: "Addresses must be an array." };
	}
	if (list.length > MAX_CUSTOMER_ADDRESSES) {
		return { error: `You can save up to ${MAX_CUSTOMER_ADDRESSES} addresses.` };
	}

	const validated: ValidatedCustomerAddress[] = [];
	for (let index = 0; index < list.length; index += 1) {
		const entry = list[index] as CustomerAddressInput;
		const positionLabel = `Address #${index + 1}`;

		const recipient = validateString(entry.recipientName, {
			label: `${positionLabel} recipient`,
			min: 1,
			max: FIELD_LIMITS.recipientName,
		});
		if (isValidationError(recipient)) {
			return { error: recipient.error };
		}

		const phone = validateString(entry.phoneNumber, {
			label: `${positionLabel} phone`,
			min: 5,
			max: FIELD_LIMITS.phoneNumber,
		});
		if (isValidationError(phone)) {
			return { error: phone.error };
		}

		const city = validateString(entry.city, {
			label: `${positionLabel} city`,
			min: 1,
			max: FIELD_LIMITS.city,
		});
		if (isValidationError(city)) {
			return { error: city.error };
		}

		const street = validateOptionalField(entry.street, `${positionLabel} street`, FIELD_LIMITS.addressStreet);
		if (street.error) {
			return { error: street.error };
		}

		const area = validateOptionalField(entry.area, `${positionLabel} area`, FIELD_LIMITS.addressArea);
		if (area.error) {
			return { error: area.error };
		}

		const postal = validateOptionalField(entry.postalCode, `${positionLabel} postcode`, FIELD_LIMITS.postalCode);
		if (postal.error) {
			return { error: postal.error };
		}

		const labelInput = validateOptionalField(entry.label, `${positionLabel} label`, FIELD_LIMITS.addressLabel);
		if (labelInput.error) {
			return { error: labelInput.error };
		}

		validated.push({
			label: labelInput.value,
			recipientName: recipient,
			phoneNumber: phone,
			city,
			area: area.value,
			street: street.value,
			postalCode: postal.value,
			isDefault: entry.isDefault === true,
		});
	}

	let defaultIndex = validated.findIndex((address) => address.isDefault);
	if (defaultIndex < 0 && validated.length > 0) {
		defaultIndex = 0;
	}
	validated.forEach((address, index) => {
		address.isDefault = index === defaultIndex;
	});

	return { addresses: validated };
}

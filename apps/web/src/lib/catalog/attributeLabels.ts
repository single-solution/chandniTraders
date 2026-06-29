import { compareAlphabetically, resolveVariantAttributeLabel, type AttributeLabelSource } from "@store/shared";
import type { AttributeDescriptor } from "@store/shared";

export function toAttributeLabelSource(attribute: AttributeDescriptor): AttributeLabelSource {
	return {
		slug: attribute.slug,
		label: attribute.label,
		unit: attribute.unit,
		options: attribute.options,
	};
}

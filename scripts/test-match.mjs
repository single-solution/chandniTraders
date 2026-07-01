const dbVariants = [
  { attributes: { 'motor-type': 'ac', winding: 'copper', color: 'a1' } },
  { attributes: { 'motor-type': 'ac', winding: 'copper', color: 'a2' } },
  { attributes: { 'motor-type': 'ac', winding: 'copper', color: 'black-lightwood' } }
];
const wooVariation = {
  attributes: [
    { id: 5, name: 'colours', slug: 'pa_colours', option: 'black &amp; lightwood' }
  ]
};

function slugify(text) {
	return text.toString().toLowerCase()
		.replace(/\s+/g, '-')           // Replace spaces with -
		.replace(/[^\w\-]+/g, '')       // Remove all non-word chars
		.replace(/\-\-+/g, '-')         // Replace multiple - with single -
		.replace(/^-+/, '')             // Trim - from start of text
		.replace(/-+$/, '');            // Trim - from end of text
}

function parseWooVariationAttributes(row) {
	const attributes = {};
	if (!Array.isArray(row?.attributes)) {
		return attributes;
	}
	for (const attribute of row.attributes) {
		const name = attribute?.name?.trim();
		const option = attribute?.option?.trim();
		if (!name || !option) {
			continue;
		}
		attributes[slugify(name)] = slugify(option);
	}
	return attributes;
}

function matchVariant(dbVariants, wooVariation) {
	const wooAttrs = parseWooVariationAttributes(wooVariation);
	
	// 1. Try exact match on all wooAttrs
	let match = dbVariants.find(v => {
		const dbAttrs = v.attributes || {};
		for (const [key, value] of Object.entries(wooAttrs)) {
			// fuzzy match value
			const wooVal = value.replace('-amp-', '-');
			const dbVal = dbAttrs[key] || dbAttrs['color']; // fallback to color
			if (!dbVal || (!dbVal.includes(wooVal) && !wooVal.includes(dbVal))) {
				return false;
			}
		}
		return true;
	});

	if (match) return match;

	// 2. Try to match by just the option name if there's only one attribute
	if (Object.keys(wooAttrs).length === 1) {
		const wooVal = Object.values(wooAttrs)[0].replace('-amp-', '-');
		match = dbVariants.find(v => {
			const dbAttrs = v.attributes || {};
			return Object.values(dbAttrs).some(dbVal => dbVal.includes(wooVal) || wooVal.includes(dbVal));
		});
	}

	return match;
}

console.log(matchVariant(dbVariants, wooVariation));

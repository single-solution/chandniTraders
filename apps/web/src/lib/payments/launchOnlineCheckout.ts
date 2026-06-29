/** Submit a hosted gateway checkout form in the browser. */
export function submitHostedCheckoutForm(postUrl: string, fields: Record<string, string>) {
	const form = document.createElement("form");
	form.method = "POST";
	form.action = postUrl;
	form.style.display = "none";

	for (const [name, value] of Object.entries(fields)) {
		const input = document.createElement("input");
		input.type = "hidden";
		input.name = name;
		input.value = value;
		form.appendChild(input);
	}

	document.body.appendChild(form);
	form.submit();
}

export interface OnlineCheckoutApiPayload {
	checkoutUrl?: string;
	checkoutForm?: {
		postUrl: string;
		fields: Record<string, string>;
	};
}

export function launchOnlineCheckout(payload: OnlineCheckoutApiPayload) {
	if (payload.checkoutUrl) {
		window.location.assign(payload.checkoutUrl);
		return;
	}

	if (payload.checkoutForm?.postUrl && payload.checkoutForm.fields) {
		submitHostedCheckoutForm(payload.checkoutForm.postUrl, payload.checkoutForm.fields);
	}
}

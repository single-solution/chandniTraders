/**

 * Read-only integration health for admin settings.

 */



import { requireSession } from "@/lib/api/requireSession";

import { getIntegrationSettings } from "@store/db";

import { ok, readOtpIntegrationStatus, readOnlinePaymentIntegrationStatus, readStorageIntegrationStatus } from "@store/shared";



export async function GET() {

	const { response } = await requireSession("settings_view");

	if (response) {

		return response;

	}



	const settings = await getIntegrationSettings();



	return ok({

		otp: readOtpIntegrationStatus(settings),

		storage: readStorageIntegrationStatus(settings),

		onlinePayment: readOnlinePaymentIntegrationStatus(settings),

	});

}


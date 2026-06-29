import { ListPageShell } from "@/components/shared/ListPageShell";
import { AccountSettings } from "@/app/account/_components/AccountSettings";

import { requirePageSession } from "@/lib/server/requirePageSession";

export const dynamic = "force-dynamic";

export default async function AdminAccountPage() {
	await requirePageSession("/account");

	return (
		<ListPageShell>
			<AccountSettings />
		</ListPageShell>
	);
}

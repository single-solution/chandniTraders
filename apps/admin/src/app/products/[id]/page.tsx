import { redirect } from "next/navigation";

import { isValidId } from "@store/shared";
import { requirePageSession } from "@/lib/server/requirePageSession";

interface ProductEditPageProps {
	params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";

/** Legacy product URL — editing happens on `/products` via drawers. */
export default async function ProductEditPage({ params }: ProductEditPageProps) {
	const { id } = await params;
	await requirePageSession(`/products/${id}`);

	if (!isValidId(id)) {
		redirect("/products");
	}

	redirect(`/products?product=${id}&panel=variants`);
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@store/ui";
import { Drawer } from "@/components/ui/Drawer";
import { MobileFab } from "@/components/ui/MobileFab";
import { WorkspacePrimaryAction } from "@/components/shared/workspaceUi";
import { apiFetch, ApiError } from "@/lib/api";
import { scheduleStateUpdate } from "@/lib/scheduleStateUpdate";
import type { ProductWizardCatalog } from "@/lib/products/loadProductWizardCatalog";
import { useUrlParams } from "@/lib/url/useUrlParams";
import type { AdminProduct } from "@/types/models";

import { ProductWizardStep1 } from "./ProductWizardStep1";
import { ProductWizardStep2 } from "./ProductWizardStep2";

import { Stepper } from "@/components/ui/Stepper";

type WizardPhase = "closed" | "step1" | "step2";

interface ProductCreateWizardProps {
	catalog: ProductWizardCatalog;
	/** `toolbar` = compact button in the products workspace header. */
	variant?: "header" | "sidebar" | "toolbar";
}

export function ProductCreateWizard({ catalog, variant = "header" }: ProductCreateWizardProps) {
	const router = useRouter();
	const { searchParams, replace } = useUrlParams();
	const [phase, setPhase] = useState<WizardPhase>("closed");
	const [product, setProduct] = useState<AdminProduct | null>(null);
	const pendingWizardRef = useRef<string | null>(null);

	const closeWizard = useCallback(() => {
		pendingWizardRef.current = null;
		setPhase("closed");
		setProduct(null);
		replace({ wizard: null, newProduct: null });
	}, [replace]);

	const finish = useCallback(() => {
		closeWizard();
		router.refresh();
	}, [closeWizard, router]);

	const openStep1 = useCallback(() => {
		pendingWizardRef.current = "1";
		setProduct(null);
		setPhase("step1");
		replace({ wizard: "1", newProduct: null });
	}, [replace]);

	const openStep2 = useCallback(
		(created: AdminProduct) => {
			pendingWizardRef.current = "2";
			setProduct(created);
			setPhase("step2");
			replace({ wizard: "2", newProduct: created.id });
			router.refresh();
		},
		[replace, router],
	);

	useEffect(() => {
		const wizard = searchParams.get("wizard");

		if (pendingWizardRef.current !== null) {
			if (wizard === pendingWizardRef.current) {
				pendingWizardRef.current = null;
			} else {
				return;
			}
		}

		if (wizard === "2") {
			const productId = searchParams.get("newProduct");
			if (!productId) {
				scheduleStateUpdate(() => setPhase("closed"));
				return;
			}
			if (product?.id === productId) {
				scheduleStateUpdate(() => setPhase("step2"));
				return;
			}
			let cancelled = false;
			apiFetch<AdminProduct>(`/api/products/${productId}`)
				.then((loaded) => {
					if (!cancelled) {
						setProduct(loaded);
						setPhase("step2");
					}
				})
				.catch(() => {
					if (!cancelled) closeWizard();
				});
			return () => {
				cancelled = true;
			};
		}

		scheduleStateUpdate(() => {
			if (wizard === "1") {
				setProduct(null);
				setPhase("step1");
				return;
			}

			setPhase("closed");
			setProduct(null);
		});
	}, [searchParams, replace, product?.id, closeWizard]);

	function handleCreated(created: AdminProduct) {
		openStep2(created);
	}

	const trigger =
		variant === "toolbar" ? (
			<>
				<span className="hidden md:inline-flex">
					<WorkspacePrimaryAction label="New product" iconElement={<Plus size={14} />} onClick={openStep1} />
				</span>
				<MobileFab label="New product" icon={Plus} onClick={openStep1} />
			</>
		) : variant === "sidebar" ? (
			<div className="mx-2 mb-3">
				<Button type="button" variant="primary" size="sm" className="w-full" leadingIcon={<Plus size={15} aria-hidden />} onClick={openStep1}>
					Add product
				</Button>
			</div>
		) : (
			<Button type="button" variant="primary" size="md" leadingIcon={<Plus size={15} />} onClick={openStep1}>
				Add product
			</Button>
		);

	const isManage = false;

	const steps = [
		{ id: 1, label: "Details & Photos" },
		{ id: 2, label: "Variants" },
	];

	return (
		<>
			{trigger}
			<Drawer
				isOpen={phase !== "closed"}
				onClose={closeWizard}
				title={phase === "step1" ? "New product" : "Add variations"}
				description={phase === "step1" ? "Step 1 of 2 — category, brand, name, and photos. Variations come next." : `Step 2 of 2 — ${product?.name}`}
				width="2xl"
				bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !p-0"
				topBar={
					<div className="flex justify-center py-2">
						<Stepper steps={steps} currentStep={phase === "step1" ? 1 : 2} className="max-w-md" />
					</div>
				}
			>
				{phase === "step1" && <ProductWizardStep1 catalog={catalog} onClose={closeWizard} onCreated={handleCreated} />}
				{phase === "step2" &&
					(product ? (
						<ProductWizardStep2 product={product} catalog={catalog} onClose={finish} onSkip={finish} onSaved={finish} purpose="wizard" />
					) : (
						<div className="flex flex-1 flex-col items-center justify-center p-6 text-center animate-pulse">
							<p className="text-sm font-semibold text-[var(--color-ink-800)]">Preparing variant editor...</p>
						</div>
					))}
			</Drawer>
		</>
	);
}

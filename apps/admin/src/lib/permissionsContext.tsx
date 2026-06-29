"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { apiFetch } from "@/lib/api";
import type { PermissionKey } from "@/lib/permissionsCatalog";

interface SessionPayload {
	permissions: PermissionKey[];
	id: string;
	name: string;
}

interface AdminPermissionsContextValue {
	permissions: PermissionKey[];
	userId: string;
	userName: string;
	isLoading: boolean;
	can: (permission: PermissionKey) => boolean;
}

const AdminPermissionsContext = createContext<AdminPermissionsContextValue>({
	permissions: [],
	userId: "",
	userName: "",
	isLoading: true,
	can: () => false,
});

export function AdminPermissionsProvider({
	children,
	initialSession = null,
}: {
	children: ReactNode;
	initialSession?: SessionPayload | null;
}) {
	const [session, setSession] = useState<SessionPayload | null>(initialSession);
	const [isLoading, setIsLoading] = useState(initialSession === null);

	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				const data = await apiFetch<SessionPayload>("/api/session");
				if (!cancelled) {
					setSession(data);
				}
			} catch {
				if (!cancelled && !initialSession) {
					setSession(null);
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		}
		void load();
		return () => {
			cancelled = true;
		};
	}, [initialSession]);

	const value = useMemo<AdminPermissionsContextValue>(() => {
		const permissions = session?.permissions ?? [];
		const set = new Set(permissions);
		return {
			permissions,
			userId: session?.id ?? "",
			userName: session?.name ?? "",
			isLoading,
			can: (permission) => set.has(permission),
		};
	}, [session, isLoading]);

	return <AdminPermissionsContext.Provider value={value}>{children}</AdminPermissionsContext.Provider>;
}

export function useAdminPermissions(): AdminPermissionsContextValue {
	return useContext(AdminPermissionsContext);
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageSquare, ShoppingCart, Tag, User, X } from "lucide-react";
import { buildWhatsAppLink, classNames } from "@store/shared";
import { useIsSignedIn } from "@/lib/auth/useIsSignedIn";
import { useCart } from "@/lib/cart/useCart";
import { useStoreSettings } from "@/lib/core/storeSettingsContext";
import { useShopHref } from "@/lib/core/storefrontReferenceContext";
import { useChatSettings } from "@/lib/chat/chatSettingsContext";
import { openChatWidget, closeChatWidget } from "@/lib/chat/openChat";
import { useChatOpenState } from "@/lib/chat/useChatOpenState";
import { fetchChatUnreadSummary } from "@/lib/chat/transport";
import { usePrefetchOnIntent } from "@/lib/navigation/usePrefetchOnIntent";

interface Tab {
	id: string;
	matchBase: string;
	href?: string;
	label: string;
	icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
	matchPaths: string[];
	showCartBadge?: boolean;
	kind?: "link" | "message";
}

const TABS: Tab[] = [
	{ id: "home", matchBase: "/", label: "Home", icon: Home, matchPaths: ["/"] },
	{ id: "deals", matchBase: "/deals", label: "Deals", icon: Tag, matchPaths: ["/deals"] },
	{
		id: "message",
		matchBase: "message",
		label: "Support",
		icon: MessageSquare,
		matchPaths: [],
		kind: "message",
	},
	{ id: "cart", matchBase: "/cart", label: "Cart", icon: ShoppingCart, matchPaths: ["/cart"], showCartBadge: true },
	{ id: "account", matchBase: "/account", label: "Account", icon: User, matchPaths: ["/account"] },
];

export function MobileBottomTabBar() {
	const pathname = usePathname() ?? "/";
	const catalogHomeHref = useShopHref();
	const { itemCount } = useCart();
	const showSignIn = useIsSignedIn() === false;

	function resolveTab(tab: Tab): { href: string; label: string } {
		if (tab.matchBase === "/account" && showSignIn) {
			return { href: "/account/sign-in", label: "Sign in" };
		}
		return { href: tab.href ?? tab.matchBase, label: tab.label };
	}

	return (
		<nav
			aria-label="Primary"
			className="fixed inset-x-3 z-30 overflow-visible rounded-full border border-[var(--color-ink-100)] bg-[var(--color-canvas)] shadow-[var(--shadow-lg)] md:hidden"
			style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 4px)" }}
		>
			<ul className="grid grid-cols-5" style={{ height: "var(--mobile-tabbar-h)" }}>
				{TABS.map((tab) => {
					const resolved = resolveTab(tab);
					if (tab.kind === "message") {
						return (
							<li key={tab.id} className="relative flex items-center justify-center p-1.5">
								<TabMessageItem />
							</li>
						);
					}
					const href = tab.matchBase === "/" ? catalogHomeHref : resolved.href;
					return (
						<li key={tab.id} className="flex p-1.5">
							<TabLinkItem tab={tab} href={href} label={resolved.label} pathname={pathname} badgeCount={tab.showCartBadge ? itemCount : 0} />
						</li>
					);
				})}
			</ul>
		</nav>
	);
}

function isLinkActive(matchBase: string, matchPaths: string[], pathname: string): boolean {
	if (matchBase === "/") {
		return pathname === "/";
	}
	if (matchPaths.includes(pathname)) {
		return true;
	}
	if (pathname.startsWith(matchBase)) {
		return true;
	}
	return false;
}

interface TabLinkItemProps {
	tab: Tab;
	href: string;
	label: string;
	pathname: string;
	badgeCount: number;
}

function TabLinkItem({ tab, href, label, pathname, badgeCount }: TabLinkItemProps) {
	const isActive = isLinkActive(tab.matchBase, tab.matchPaths, pathname);
	const Icon = tab.icon;
	const prefetchHandlers = usePrefetchOnIntent(isActive ? null : href);
	return (
		<Link
			href={href}
			className={classNames(
				"tap focus-ring-inset flex w-full flex-col items-center justify-center gap-0.5 rounded-full text-[11px] transition-colors",
				isActive ? "bg-[var(--color-accent-100)] font-semibold text-[var(--color-accent-800)]" : "font-medium text-[var(--color-ink-500)] active:text-[var(--color-ink-800)]",
			)}
			aria-current={isActive ? "page" : undefined}
			onPointerDown={prefetchHandlers.onPointerDown}
			onTouchStart={prefetchHandlers.onTouchStart}
			onFocus={prefetchHandlers.onFocus}
		>
			<span className="relative">
				<Icon size={20} strokeWidth={isActive ? 2.4 : 2} />
				{badgeCount > 0 && (
					<span
						key={badgeCount}
						className="animate-badge-pop absolute -right-2 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-[var(--color-accent-500)] px-1 text-[10px] font-bold text-[var(--color-ink-900)]"
					>
						{badgeCount > 9 ? "9+" : badgeCount}
					</span>
				)}
			</span>
			<span className="leading-none">{label}</span>
		</Link>
	);
}

function TabMessageItem() {
	const chatSettings = useChatSettings();
	const { whatsappNumber } = useStoreSettings();
	const [unread, setUnread] = useState(0);
	const [isMounted, setIsMounted] = useState(false);
	const isChatOpen = useChatOpenState();

	useEffect(() => {
		setIsMounted(true);
	}, []);

	useEffect(() => {
		if (!chatSettings.enabled) {
			return;
		}

		let cancelled = false;

		async function refreshUnread() {
			try {
				const count = await fetchChatUnreadSummary();
				if (!cancelled) {
					setUnread(count);
				}
			} catch {
				// badge is best-effort
			}
		}

		void refreshUnread();

		const onVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				void refreshUnread();
			}
		};

		document.addEventListener("visibilitychange", onVisibilityChange);
		const pollTimer = window.setInterval(refreshUnread, 60_000);

		return () => {
			cancelled = true;
			document.removeEventListener("visibilitychange", onVisibilityChange);
			window.clearInterval(pollTimer);
		};
	}, [chatSettings.enabled]);

	function handleClick() {
		if (chatSettings.enabled) {
			if (isChatOpen) {
				closeChatWidget();
			} else {
				openChatWidget();
			}
			return;
		}
		const whatsappUrl = buildWhatsAppLink("Salam!", whatsappNumber);
		window.open(whatsappUrl, "_blank", "noopener,noreferrer");
	}

	const isActive = isChatOpen && chatSettings.enabled;
	const showElevatedButton = isActive && isMounted;
	const tabBarBottom = "calc(env(safe-area-inset-bottom, 0px) + 4px)";
	const buttonProps = { isActive, unread, onClick: handleClick };

	return (
		<>
			{showElevatedButton ? (
				<div className="invisible" aria-hidden>
					<TabMessageButton {...buttonProps} />
				</div>
			) : (
				<TabMessageButton {...buttonProps} />
			)}
			{showElevatedButton
				? createPortal(
						<div
							className="pointer-events-none fixed inset-x-3 z-[calc(var(--z-modal)+1)] md:hidden"
							style={{ bottom: tabBarBottom, height: "var(--mobile-tabbar-h)" }}
						>
							<div className="grid h-full grid-cols-5">
								<div aria-hidden />
								<div aria-hidden />
								<div className="pointer-events-auto relative flex items-center justify-center p-1.5">
									<TabMessageButton {...buttonProps} />
								</div>
								<div aria-hidden />
								<div aria-hidden />
							</div>
						</div>,
						document.body,
					)
				: null}
		</>
	);
}

interface TabMessageButtonProps {
	isActive: boolean;
	unread: number;
	onClick: () => void;
}

function TabMessageButton({ isActive, unread, onClick }: TabMessageButtonProps) {
	const TabIcon = isActive ? X : MessageSquare;

	return (
		<button
			type="button"
			onClick={onClick}
			className="tap focus-ring group relative flex h-full w-full items-center justify-center"
			aria-label={isActive ? "Close chat" : "Need any help? Open chat support"}
			aria-pressed={isActive}
		>
			<span
				className={classNames(
					"relative grid size-14 place-items-center rounded-[var(--radius-full)] text-[var(--color-on-dark)] shadow-[var(--shadow-md)] transition-[transform,box-shadow] duration-300 active:scale-[0.97] -translate-y-[var(--mobile-tabbar-fab-lift)]",
					"bg-[var(--color-ink-900)]",
					isActive ? "shadow-[var(--shadow-lg)]" : "",
				)}
			>
				<span className="grid size-10 place-items-center rounded-full bg-gradient-to-br from-[var(--color-accent-400)] to-[var(--color-accent-500)] text-[var(--color-ink-900)] transition-transform group-active:scale-105">
					<TabIcon size={18} strokeWidth={2.4} />
				</span>
				{!isActive && unread > 0 && (
					<span
						key={unread}
						className="animate-badge-pop absolute -right-0.5 -top-0.5 flex min-w-[18px] items-center justify-center rounded-full bg-[var(--color-danger-500)] px-1 text-[10px] font-bold text-[var(--color-on-dark)]"
					>
						{unread > 9 ? "9+" : unread}
					</span>
				)}
			</span>
			<span
				className={classNames(
					"absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[11px] leading-none",
					isActive ? "font-semibold text-[var(--color-accent-800)]" : "font-medium text-[var(--color-ink-500)]",
				)}
			>
				{isActive ? "Close" : "Need any help?"}
			</span>
		</button>
	);
}

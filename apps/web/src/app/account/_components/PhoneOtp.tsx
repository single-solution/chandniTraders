"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { ArrowRight, KeyRound, MessageCircle, Phone as PhoneIcon } from "lucide-react";
import { Button } from "@store/ui";
import { Input } from "@/components/ui/Input";
import { OtpInput } from "@/components/ui/OtpInput";
import { buildWhatsAppLink, classNames, OTP_CODE_LENGTH } from "@store/shared";

import { setSignedIn } from "@/lib/auth/useIsSignedIn";
import { resolvePublicErrorMessage } from "@/lib/errors/publicErrorMessage";
import { useStoreSettings } from "@/lib/core/storeSettingsContext";

const RESEND_AFTER_SECONDS = 30;
const COUNTDOWN_TICK_MS = 1_000;
const CODE_AUTOFOCUS_DELAY_MS = 80;

interface IssueOtpResponse {
	phoneTail?: string;
	expiresAt?: string;
	error?: string;
}

export interface PhoneOtpProps {
	phoneSubmitLabel: string;
	codeSubmitLabel: string;
	onVerified: () => void;
	phonePlaceholder?: string;
	autoFocusPhone?: boolean;
}

export function PhoneOtp({ phoneSubmitLabel, codeSubmitLabel, onVerified, phonePlaceholder = "+92 300 1234567", autoFocusPhone = false }: PhoneOtpProps) {
	const { whatsappNumber, supportPhone } = useStoreSettings();
	const [step, setStep] = useState<"phone" | "code">("phone");
	const [phone, setPhone] = useState("");
	const [code, setCode] = useState("");
	const [phoneTail, setPhoneTail] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isSendingCode, setIsSendingCode] = useState(false);
	const [isVerifying, setIsVerifying] = useState(false);
	const [resendIn, setResendIn] = useState(0);
	// True once a send attempt fails — unlocks the "code from our team" fallback.
	const [deliveryFailed, setDeliveryFailed] = useState(false);
	// True when verifying a code the team issued out-of-band (no "sent to" wording).
	const [adminCodeMode, setAdminCodeMode] = useState(false);
	const codeInputRef = useRef<HTMLInputElement | null>(null);

	useEffect(() => {
		if (resendIn <= 0) {
			return;
		}
		const intervalId = window.setInterval(() => {
			setResendIn((previous) => Math.max(0, previous - 1));
		}, COUNTDOWN_TICK_MS);
		return () => window.clearInterval(intervalId);
	}, [resendIn]);

	async function requestCode(currentPhone: string): Promise<boolean> {
		setIsSendingCode(true);
		setError(null);
		try {
			const response = await fetch("/api/auth/otp", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ phoneNumber: currentPhone }),
			});
			const data = (await response.json()) as IssueOtpResponse;
			if (!response.ok) {
				setError(data.error ?? "Couldn't send code. Please try again.");
				const retryAfterSeconds = Number(response.headers.get("Retry-After"));
				if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
					setResendIn(retryAfterSeconds);
				}
				// Only offer the team-issued-code path on a genuine delivery failure
				// (5xx). An invalid number (400) or throttle (429) isn't a delivery
				// problem, so surfacing the fallback there just confuses the user.
				if (response.status >= 500) {
					setDeliveryFailed(true);
				}
				return false;
			}
			setPhoneTail(data.phoneTail ?? null);
			setDeliveryFailed(false);
			setAdminCodeMode(false);
			setStep("code");
			setResendIn(RESEND_AFTER_SECONDS);
			return true;
		} catch {
			// Network error — not a delivery failure; don't unlock the team-code path.
			setError("Network error. Please try again.");
			return false;
		} finally {
			setIsSendingCode(false);
		}
	}

	function enterAdminCode() {
		if (!phone.trim()) {
			setError("Enter your phone number first, then tap this again.");
			return;
		}
		setAdminCodeMode(true);
		setPhoneTail(null);
		setError(null);
		setStep("code");
		window.setTimeout(() => codeInputRef.current?.focus(), CODE_AUTOFOCUS_DELAY_MS);
	}

	async function handlePhoneSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const currentPhone = phone.trim();
		if (!currentPhone) {
			return;
		}
		const issued = await requestCode(currentPhone);
		if (issued) {
			window.setTimeout(() => codeInputRef.current?.focus(), CODE_AUTOFOCUS_DELAY_MS);
		}
	}

	async function verifyCode(currentCode: string) {
		if (isVerifying) {
			return;
		}
		if (currentCode.length < OTP_CODE_LENGTH) {
			setError(`Please enter the full ${OTP_CODE_LENGTH}-digit code.`);
			return;
		}
		setIsVerifying(true);
		setError(null);
		try {
			const result = await signIn("customer-otp", {
				redirect: false,
				phoneNumber: phone.trim(),
				code: currentCode,
			});
			if (result?.error) {
				setError("That code didn't match. Please try again.");
				return;
			}
			setSignedIn(true);
			onVerified();
		} catch (error) {
			setError(resolvePublicErrorMessage(error));
		} finally {
			setIsVerifying(false);
		}
	}

	function handleCodeSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		void verifyCode(code);
	}

	const contactHref = whatsappNumber
		? buildWhatsAppLink("Salam! I can't receive my sign-in code — can you help me sign in?", whatsappNumber)
		: supportPhone
			? `tel:${supportPhone.replace(/\s+/g, "")}`
			: null;

	if (step === "phone") {
		return (
			<div className="space-y-4">
				<form onSubmit={handlePhoneSubmit} className="reveal-stagger space-y-4">
					<div className="reveal">
						<Input
							label="WhatsApp number"
							value={phone}
							onChange={(e) => setPhone(e.target.value)}
							placeholder={phonePlaceholder}
							icon={<PhoneIcon size={14} />}
							inputMode="tel"
							autoComplete="tel"
							autoFocus={autoFocusPhone}
							error={error}
							isLoading={isSendingCode}
						/>
					</div>
					<div className="reveal">
						<Button
							type="submit"
							variant="primary"
							size="md"
							className="w-full"
							isLoading={isSendingCode}
							trailingIcon={<ArrowRight size={14} />}
							disabled={!phone.trim() || isSendingCode}
						>
							{phoneSubmitLabel}
						</Button>
					</div>
				</form>

				{deliveryFailed ? (
					<div className="space-y-2.5 rounded-[var(--radius-md)] border border-[var(--color-ink-100)] bg-[var(--color-canvas-deep)] px-3.5 py-3 text-[12px] leading-relaxed text-[var(--color-ink-600)]">
						<p>Not receiving the code? Ask our team for a sign-in code, then enter it here.</p>
						<div className="flex flex-wrap items-center gap-2">
							<Button type="button" variant="outline" size="sm" leadingIcon={<KeyRound size={13} />} onClick={enterAdminCode}>
								I have a code from our team
							</Button>
							{contactHref ? (
								<a
									href={contactHref}
									target={whatsappNumber ? "_blank" : undefined}
									rel={whatsappNumber ? "noopener noreferrer" : undefined}
									className="tap inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--color-accent-700)] hover:text-[var(--color-accent-800)]"
								>
									<MessageCircle size={13} />
									{whatsappNumber ? "Contact us on WhatsApp" : "Call us"}
								</a>
							) : null}
						</div>
					</div>
				) : null}
			</div>
		);
	}

	return (
		<form onSubmit={handleCodeSubmit} className="reveal-stagger space-y-4">
			<p className="reveal max-w-prose text-[12.5px] text-[var(--color-ink-600)]">
				{adminCodeMode ? (
					<>
						Enter the {OTP_CODE_LENGTH}-digit code our team gave you for <span className="font-semibold text-[var(--color-ink-900)]">{phone}</span>.
					</>
				) : (
					<>
						Enter the {OTP_CODE_LENGTH}-digit code sent to <span className="font-semibold text-[var(--color-ink-900)]">{phoneTail ? `••• ${phoneTail}` : phone}</span>.
					</>
				)}
			</p>
			<div className="reveal">
				<OtpInput
					ref={codeInputRef}
					label="Verification code"
					value={code}
					onChange={setCode}
					length={OTP_CODE_LENGTH}
					error={error}
					disabled={isVerifying}
					onComplete={(completed) => void verifyCode(completed)}
				/>
			</div>
			<div className="reveal">
				<Button
					type="submit"
					variant="primary"
					size="md"
					className="w-full"
					isLoading={isVerifying}
					trailingIcon={<ArrowRight size={14} />}
					disabled={code.length < OTP_CODE_LENGTH || isVerifying}
				>
					{codeSubmitLabel}
				</Button>
			</div>

			<div className="reveal">
				<ResendControls
					resendIn={resendIn}
					isSendingCode={isSendingCode}
					allowResend={!adminCodeMode}
					onUseDifferentPhone={() => {
						setStep("phone");
						setCode("");
						setError(null);
						setAdminCodeMode(false);
					}}
					onResend={() => void requestCode(phone.trim())}
				/>
			</div>
		</form>
	);
}

function ResendControls({
	resendIn,
	isSendingCode,
	allowResend,
	onUseDifferentPhone,
	onResend,
}: {
	resendIn: number;
	isSendingCode: boolean;
	allowResend: boolean;
	onUseDifferentPhone: () => void;
	onResend: () => void;
}) {
	return (
		<div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[12px]">
			<button type="button" onClick={onUseDifferentPhone} className="tap font-semibold text-[var(--color-ink-600)] hover:text-[var(--color-ink-900)]">
				Use a different phone
			</button>
			{allowResend ? (
				<button
					type="button"
					onClick={() => {
						if (resendIn > 0) {
							return;
						}
						onResend();
					}}
					disabled={resendIn > 0 || isSendingCode}
					className={classNames(
						"tap font-semibold",
						resendIn > 0 || isSendingCode ? "cursor-not-allowed text-[var(--color-ink-400)]" : "text-[var(--color-accent-700)] hover:text-[var(--color-accent-800)]",
					)}
				>
					{resendIn > 0 ? `Resend in ${resendIn}s` : "Resend code"}
				</button>
			) : null}
		</div>
	);
}

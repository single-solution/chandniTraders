"use client";

import { Check } from "lucide-react";
import { classNames } from "@store/shared";

interface Step {
	id: number;
	label: string;
}

interface StepperProps {
	steps: Step[];
	currentStep: number;
	className?: string;
}

function StepItem({ step, currentStep, isLast }: { step: Step; currentStep: number; isLast: boolean }) {
	const isCompleted = currentStep > step.id;
	const isCurrent = currentStep === step.id;

	return (
		<div className={classNames("flex items-center", !isLast && "flex-1")}>
			<div className="flex items-center gap-2.5">
				<div
					className={classNames(
						"flex size-7 shrink-0 items-center justify-center rounded-full border-[1.5px] text-[12px] font-bold transition-all duration-300",
						isCompleted
							? "border-[var(--color-accent-500)] bg-[var(--color-accent-500)] text-[var(--color-ink-900)]"
							: isCurrent
								? "border-[var(--color-ink-900)] bg-[var(--color-ink-900)] text-[var(--color-surface)] ring-4 ring-[var(--color-ink-100)]"
								: "border-[var(--color-ink-200)] bg-[var(--color-surface)] text-[var(--color-ink-400)]",
					)}
				>
					{isCompleted ? <Check size={14} strokeWidth={3} /> : step.id}
				</div>
				<span
					className={classNames(
						"hidden sm:block text-[12.5px] font-semibold tracking-tight transition-colors duration-300",
						isCurrent ? "text-[var(--color-ink-900)]" : isCompleted ? "text-[var(--color-ink-700)]" : "text-[var(--color-ink-400)]",
					)}
				>
					{step.label}
				</span>
			</div>

			{!isLast && (
				<div className="flex-1 mx-3 sm:mx-4 h-[2px] rounded-full bg-[var(--color-ink-100)] overflow-hidden">
					<div className="h-full bg-[var(--color-accent-500)] transition-all duration-500 ease-out" style={{ width: isCompleted ? "100%" : "0%" }} />
				</div>
			)}
		</div>
	);
}

export function Stepper({ steps, currentStep, className }: StepperProps) {
	return (
		<div className={classNames("flex items-center w-full", className)}>
			{steps.map((step, index) => (
				<StepItem key={step.id} step={step} currentStep={currentStep} isLast={index === steps.length - 1} />
			))}
		</div>
	);
}

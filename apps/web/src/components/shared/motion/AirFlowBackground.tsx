"use client";

import { useEffect, useRef } from "react";

interface AirStream {
	x: number;
	y: number;
	baseVx: number;
	baseVy: number;
	phaseX: number;
	phaseY: number;
	freq: number;
	amp: number;
	ageMs: number;
	lifetimeMs: number;
	peakOpacity: number;
	scale: number;
}

function spawnStream(width: number, height: number, initial: boolean): AirStream {
	const lifetimeMs = 4000 + Math.random() * 6000; // 4 to 10 seconds
	return {
		x: initial ? Math.random() * width : -100 - Math.random() * 100,
		y: Math.random() * height,
		baseVx: 1.5 + Math.random() * 2.5, // General flow from left to right
		baseVy: (Math.random() - 0.5) * 0.8, // Slight vertical drift
		phaseX: Math.random() * Math.PI * 2,
		phaseY: Math.random() * Math.PI * 2,
		freq: 0.0003 + Math.random() * 0.0007,
		amp: 0.5 + Math.random() * 1.5,
		ageMs: initial ? Math.random() * lifetimeMs : 0,
		lifetimeMs,
		peakOpacity: 0.08 + Math.random() * 0.18,
		scale: 1 + Math.random() * 2.5,
	};
}

function prefersReducedMotion(): boolean {
	return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Fixed ambient breeze — flowing, meandering air streams behind storefront pages. */
export function AirFlowBackground() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const animationRef = useRef<number | null>(null);
	const streamsRef = useRef<AirStream[]>([]);

	useEffect(() => {
		if (prefersReducedMotion()) {
			return;
		}

		if (!canvasRef.current?.getContext("2d")) {
			return;
		}

		function readContext(): CanvasRenderingContext2D | null {
			const canvas = canvasRef.current;
			if (!canvas) {
				return null;
			}
			return canvas.getContext("2d");
		}

		function resize() {
			const canvas = canvasRef.current;
			if (!canvas) {
				return;
			}
			const devicePixelRatio = Math.min(window.devicePixelRatio || 1, 2);
			const width = window.innerWidth;
			const height = window.innerHeight;
			canvas.width = Math.floor(width * devicePixelRatio);
			canvas.height = Math.floor(height * devicePixelRatio);
			canvas.style.width = `${width}px`;
			canvas.style.height = `${height}px`;
			const context = readContext();
			if (!context) {
				return;
			}
			context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

			const count = Math.min(60, Math.max(20, Math.floor((width * height) / 12000)));
			// Only re-initialize if empty to avoid popping on resize
			if (streamsRef.current.length === 0) {
				streamsRef.current = Array.from({ length: count }, () => spawnStream(width, height, true));
			} else if (streamsRef.current.length < count) {
				const diff = count - streamsRef.current.length;
				streamsRef.current.push(...Array.from({ length: diff }, () => spawnStream(width, height, true)));
			} else if (streamsRef.current.length > count) {
				streamsRef.current.splice(count);
			}
		}

		resize();
		window.addEventListener("resize", resize);

		let lastTime = performance.now();

		function frame(now: number) {
			const context = readContext();
			if (!context) {
				return;
			}

			const deltaMs = Math.min(now - lastTime, 48);
			lastTime = now;
			const width = window.innerWidth;
			const height = window.innerHeight;

			context.clearRect(0, 0, width, height);

			for (let i = 0; i < streamsRef.current.length; i++) {
				const stream = streamsRef.current[i];
				stream.ageMs += deltaMs;

				if (stream.ageMs >= stream.lifetimeMs || stream.x > width + 150) {
					streamsRef.current[i] = spawnStream(width, height, false);
					continue;
				}

				const progress = stream.ageMs / stream.lifetimeMs;
				// Fade in first 15%, fade out last 25%
				let fade = 1;
				if (progress < 0.15) {
					fade = progress / 0.15;
				} else if (progress > 0.75) {
					fade = 1 - (progress - 0.75) / 0.25;
				}

				const opacity = stream.peakOpacity * fade;

				// Calculate velocity with noise to create meandering paths
				const vx = stream.baseVx + Math.sin(now * stream.freq + stream.phaseX) * stream.amp;
				const vy = stream.baseVy + Math.cos(now * stream.freq + stream.phaseY) * stream.amp;

				stream.x += vx * (deltaMs / 16.67);
				stream.y += vy * (deltaMs / 16.67);

				// Angle of movement so the streak aligns with its path
				const angle = Math.atan2(vy, vx);
				const speed = Math.sqrt(vx * vx + vy * vy);
				
				// Elongate based on speed
				const length = stream.scale * (4 + speed * 2.5);
				const thickness = stream.scale * 1.5;

				context.beginPath();
				context.fillStyle = `rgba(10, 48, 53, ${opacity})`;
				context.ellipse(stream.x, stream.y, length, thickness, angle, 0, Math.PI * 2);
				context.fill();
			}

			animationRef.current = requestAnimationFrame(frame);
		}

		animationRef.current = requestAnimationFrame(frame);

		return () => {
			window.removeEventListener("resize", resize);
			if (animationRef.current !== null) {
				cancelAnimationFrame(animationRef.current);
			}
		};
	}, []);

	if (prefersReducedMotion()) {
		return null;
	}

	return (
		<div className="air-flow-bg" aria-hidden>
			<canvas ref={canvasRef} className="air-flow-bg__canvas" />
		</div>
	);
}

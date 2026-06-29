interface SparklineProps {
	values: number[];
	width?: number;
	height?: number;
	color?: string;
}

export function Sparkline({ values, width = 80, height = 24, color = "var(--color-accent-500)" }: SparklineProps) {
	if (values.length === 0) {
		return null;
	}

	const minValue = Math.min(...values);
	const maxValue = Math.max(...values);
	const range = maxValue - minValue || 1;
	const stepX = values.length > 1 ? width / (values.length - 1) : 0;

	const points = values
		.map((value, index) => {
			const x = index * stepX;
			const normalized = (value - minValue) / range;
			const y = height - normalized * height;
			return `${x.toFixed(2)},${y.toFixed(2)}`;
		})
		.join(" ");

	return (
		<svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible" aria-hidden>
			<polyline points={points} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
		</svg>
	);
}

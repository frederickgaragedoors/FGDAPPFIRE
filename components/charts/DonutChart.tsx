import React, { useState } from 'react';

interface DonutChartProps {
    data: { label: string; value: number; color: string }[];
}

export const DonutChart: React.FC<DonutChartProps> = ({ data }) => {
    const [hoveredSegment, setHoveredSegment] = useState<string | null>(null);

    const total = data.reduce((acc, d) => acc + d.value, 0);
    if (total === 0) return <div className="flex items-center justify-center h-64 text-slate-500">No expense data</div>;

    const size = 250;
    const strokeWidth = 25;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    let accumulatedPercentage = 0;

    const segments = data.map(d => {
        const percentage = d.value / total;
        const strokeDashoffset = circumference * (1 - accumulatedPercentage);
        const strokeDasharray = `${circumference * percentage} ${circumference * (1 - percentage)}`;
        accumulatedPercentage += percentage;
        return { ...d, strokeDasharray, strokeDashoffset };
    });

    return (
        <div className="flex flex-col md:flex-row items-center justify-center gap-8">
            <div className="relative">
                <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Donut chart showing expense breakdown by category">
                    <circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={strokeWidth}
                        className="text-slate-100 dark:text-slate-700"
                    />
                    {segments.map((segment) => (
                        <circle
                            key={segment.label}
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke={segment.color}
                            strokeWidth={strokeWidth}
                            strokeDasharray={segment.strokeDasharray}
                            strokeDashoffset={segment.strokeDashoffset}
                            transform={`rotate(-90 ${size / 2} ${size / 2})`}
                            className="transition-all duration-300"
                            style={{ transition: 'stroke-dashoffset 1s ease-out' }}
                            onMouseEnter={() => setHoveredSegment(segment.label)}
                            onMouseLeave={() => setHoveredSegment(null)}
                        >
                             <animateTransform
                                attributeName="transform"
                                type="rotate"
                                from={`0 ${size / 2} ${size / 2}`}
                                to={`-90 ${size / 2} ${size / 2}`}
                                dur="1s"
                                fill="freeze"
                              />
                        </circle>
                    ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    {hoveredSegment ? (
                        <>
                            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                                {`$${data.find(d => d.label === hoveredSegment)?.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </span>
                            <span className="text-sm text-slate-500 dark:text-slate-400">{hoveredSegment}</span>
                        </>
                    ) : (
                        <>
                            <span className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                                {`$${total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </span>
                            <span className="text-sm text-slate-500 dark:text-slate-400">Total Expenses</span>
                        </>
                    )}
                </div>
            </div>
            <ul className="grid grid-cols-2 gap-x-6 gap-y-2">
                {data.map(d => (
                    <li
                        key={d.label}
                        onMouseEnter={() => setHoveredSegment(d.label)}
                        onMouseLeave={() => setHoveredSegment(null)}
                        className="flex items-center cursor-pointer"
                    >
                        <span style={{ backgroundColor: d.color }} className="w-3 h-3 rounded-full mr-2"></span>
                        <span className="text-sm text-slate-600 dark:text-slate-300">{d.label}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
};

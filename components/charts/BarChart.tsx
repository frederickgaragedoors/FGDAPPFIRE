import React from 'react';

interface BarChartProps {
    data: { label: string; value: number; color: string }[];
}

export const BarChart: React.FC<BarChartProps> = ({ data }) => {
    const maxValue = Math.max(...data.map(d => d.value), 1); // Avoid division by zero
    const chartHeight = 200;
    const barWidth = 40;
    const barMargin = 30;

    return (
        <svg
            width="100%"
            height={chartHeight + 40}
            aria-label="Bar chart showing income versus expenses"
            role="img"
        >
            <g transform="translate(0, 20)">
                {data.map((d, i) => {
                    const barHeight = (d.value / maxValue) * chartHeight;
                    const x = i * (barWidth + barMargin) + barMargin / 2;
                    return (
                        <g key={d.label}>
                            <rect
                                x={x}
                                y={chartHeight - barHeight}
                                width={barWidth}
                                height={barHeight}
                                fill={d.color}
                                rx="4"
                                ry="4"
                            >
                                <animate
                                    attributeName="height"
                                    from="0"
                                    to={barHeight}
                                    dur="0.5s"
                                    fill="freeze"
                                />
                                <animate
                                    attributeName="y"
                                    from={chartHeight}
                                    to={chartHeight - barHeight}
                                    dur="0.5s"
                                    fill="freeze"
                                />
                            </rect>
                            <text
                                x={x + barWidth / 2}
                                y={chartHeight - barHeight - 8}
                                textAnchor="middle"
                                className="text-sm font-bold fill-current text-slate-700 dark:text-slate-200"
                            >
                                {`$${d.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                            </text>
                             <text
                                x={x + barWidth / 2}
                                y={chartHeight + 18}
                                textAnchor="middle"
                                className="text-xs font-medium fill-current text-slate-500 dark:text-slate-400"
                            >
                                {d.label}
                            </text>
                        </g>
                    );
                })}
            </g>
        </svg>
    );
};

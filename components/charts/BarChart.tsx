import React from 'react';

interface Bar {
    value: number;
    color: string;
    label: string; // e.g., 'Current', 'Previous'
}

interface BarGroup {
    groupLabel: string; // e.g., 'Income', 'Expenses'
    bars: Bar[];
}

interface BarChartProps {
    data: BarGroup[];
}

export const BarChart: React.FC<BarChartProps> = ({ data }) => {
    if (!data || data.length === 0) {
        return <div className="flex items-center justify-center h-64 text-slate-500">No data available</div>;
    }

    const maxValue = Math.max(...data.flatMap(d => d.bars.map(b => b.value)), 1);
    const chartHeight = 200;
    const groupWidth = 120;
    const groupMargin = 60;
    const barPadding = 8;
    const numBarsPerGroup = data[0].bars.length;
    const barWidth = (groupWidth - (barPadding * (numBarsPerGroup - 1))) / numBarsPerGroup;

    return (
        <div className="flex flex-col items-center">
            <svg
                width="100%"
                height={chartHeight + 50}
                aria-label="Bar chart showing comparisons"
                role="img"
                className="overflow-visible"
            >
                <g transform="translate(0, 20)">
                    {data.map((group, groupIndex) => {
                        const groupX = groupIndex * (groupWidth + groupMargin) + groupMargin / 2;
                        return (
                            <g key={group.groupLabel}>
                                {group.bars.map((bar, barIndex) => {
                                    const barHeight = Math.max(0, (bar.value / maxValue) * chartHeight);
                                    const x = groupX + barIndex * (barWidth + barPadding);
                                    return (
                                        <g key={`${group.groupLabel}-${bar.label}`}>
                                            <rect
                                                x={x}
                                                y={chartHeight - barHeight}
                                                width={barWidth}
                                                height={barHeight}
                                                fill={bar.color}
                                                rx="3"
                                                ry="3"
                                            >
                                            </rect>
                                            <text
                                                x={x + barWidth / 2}
                                                y={chartHeight - barHeight - 5}
                                                textAnchor="middle"
                                                className="text-[10px] font-bold fill-current text-slate-600 dark:text-slate-300"
                                            >
                                                {`$${bar.value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                                            </text>
                                        </g>
                                    );
                                })}
                                 <text
                                    x={groupX + groupWidth / 2}
                                    y={chartHeight + 20}
                                    textAnchor="middle"
                                    className="text-sm font-medium fill-current text-slate-600 dark:text-slate-300"
                                >
                                    {group.groupLabel}
                                </text>
                            </g>
                        );
                    })}
                </g>
            </svg>
            <div className="flex space-x-6 mt-4">
                {data[0]?.bars.map(bar => (
                    <div key={bar.label} className="flex items-center text-xs">
                        <span style={{ backgroundColor: bar.color }} className="w-3 h-3 rounded-sm mr-2"></span>
                        <span className="text-slate-600 dark:text-slate-400">{bar.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};
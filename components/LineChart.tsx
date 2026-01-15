
import React from 'react';

interface ChartDataPoint {
    label: string;
    value: number;
}

interface LineChartProps {
    data: ChartDataPoint[];
    forecastData: ChartDataPoint[];
    color?: string;
    forecastColor?: string;
    height?: number;
}

const LineChart: React.FC<LineChartProps> = ({
    data,
    forecastData,
    color = '#3b82f6',
    forecastColor = '#10b981',
    height = 200,
}) => {
    const allData = [...data, ...forecastData];
    if (allData.length === 0) {
        return <div style={{ height }} className="flex items-center justify-center text-slate-400 font-bold text-sm">لا توجد بيانات كافية للتحليل</div>;
    }

    const maxValue = Math.max(...allData.map(d => d.value), 100) * 1.1; // Add 10% headroom
    const chartWidth = 1000; // Virtual width
    const chartHeight = height;

    const getX = (index: number) => (index / (allData.length - 1)) * chartWidth;
    const getY = (val: number) => chartHeight - ((val / maxValue) * chartHeight);

    // Build paths
    const historyPoints = data.map((point, i) => `${getX(i)},${getY(point.value)}`).join(' L ');
    const forecastPoints = forecastData.map((point, i) => `${getX(data.length - 1 + i)},${getY(point.value)}`).join(' L ');

    return (
        <div className="relative w-full overflow-hidden" style={{ height: height + 50 }}>
            <svg
                width="100%"
                height={height}
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                preserveAspectRatio="none"
                className="overflow-visible"
            >
                {/* Horizontal Grid Lines */}
                {[0, 0.25, 0.5, 0.75, 1].map((t) => (
                    <line 
                        key={t} 
                        x1="0" 
                        y1={chartHeight * t} 
                        x2={chartWidth} 
                        y2={chartHeight * t} 
                        stroke="#e2e8f0" 
                        strokeWidth="1" 
                        strokeDasharray="4 4"
                    />
                ))}

                {/* History Line */}
                {historyPoints && (
                    <path
                        d={`M ${historyPoints}`}
                        fill="none"
                        stroke={color}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="drop-shadow-sm"
                    />
                )}
                
                {/* Forecast Line */}
                {forecastPoints && (
                    <path
                        d={`M ${forecastPoints}`}
                        fill="none"
                        stroke={forecastColor}
                        strokeWidth="3"
                        strokeDasharray="6 6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {/* Points */}
                {data.map((point, i) => (
                    <circle 
                        key={`h-${i}`}
                        cx={getX(i)} 
                        cy={getY(point.value)} 
                        r="3" 
                        fill={color} 
                        stroke="white"
                        strokeWidth="1.5"
                    />
                ))}
                 {forecastData.map((point, i) => (
                    <circle 
                        key={`f-${i}`}
                        cx={getX(data.length - 1 + i)} 
                        cy={getY(point.value)} 
                        r="3" 
                        fill={forecastColor} 
                        stroke="white"
                        strokeWidth="1.5"
                    />
                ))}
            </svg>
            
            {/* X-Axis Labels */}
            <div className="flex justify-between mt-2 text-[10px] text-slate-400 font-bold px-1">
                <span>{allData[0]?.label}</span>
                <span>{allData[Math.floor(allData.length / 2)]?.label}</span>
                <span>{allData[allData.length - 1]?.label}</span>
            </div>

            {/* Legend */}
            <div className="flex justify-center gap-6 mt-4">
                <div className="flex items-center gap-2">
                    <span className="w-3 h-1 rounded-full" style={{ backgroundColor: color }}></span>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">الفعلي</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="w-3 h-1 rounded-full border-t border-dashed" style={{ borderColor: forecastColor }}></span>
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">المتوقع</span>
                </div>
            </div>
        </div>
    );
};

export default LineChart;

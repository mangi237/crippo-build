import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { PriceHistoryPoint, PricePoint } from '../types/crippo';
import { formatXAF } from '../utils/format';

export const MiniSparkline: React.FC<{
  values: number[];
  isPositive: boolean;
  width?: number;
  height?: number;
}> = ({ values, isPositive, width = 96, height = 32 }) => {
  const data = useMemo(() => {
    const src = values && values.length >= 2 ? values : [values?.[0] ?? 500, values?.[0] ?? 500];
    return src.map((v, i) => ({ i, v }));
  }, [values]);

  const stroke = isPositive ? '#10B981' : '#EF4444';

  return (
    <div style={{ width, height }} className="shrink-0" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
          <YAxis domain={['dataMin', 'dataMax']} hide />
          <Line
            type="monotone"
            dataKey="v"
            stroke={stroke}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export const PriceChart: React.FC<{
  history: PricePoint[] | PriceHistoryPoint[];
  isPositive: boolean;
  heightClass?: string;
  onSelectCatalyst?: (catalystTitle: string, deltaPct?: number) => void;
}> = ({ history, isPositive, heightClass = 'h-56', onSelectCatalyst }) => {
  const [selectedMarker, setSelectedMarker] = useState<{
    title: string;
    deltaPct?: number;
    priceXAF: number;
  } | null>(null);

  const chartData = useMemo(() => {
    if (!history || history.length === 0) return [];
    return history.map((pt, idx) => {
      const rawLabel = 'label' in pt ? pt.label : pt.time;
      const shortLabel =
        rawLabel.includes('T') && rawLabel.length > 12
          ? new Date(rawLabel).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
          : rawLabel;
      return {
        idx,
        label: shortLabel,
        priceXAF: pt.priceXAF,
        catalystTitle: pt.catalystTitle,
        deltaPct: pt.deltaPct,
      };
    });
  }, [history]);

  if (chartData.length === 0) return null;

  const strokeColor = isPositive ? '#10B981' : '#EF4444';
  const fillColor = isPositive ? '#10B981' : '#EF4444';
  const catalystPoints = chartData.filter((d) => Boolean(d.catalystTitle));

  return (
    <div className="w-full space-y-2.5">
      {selectedMarker && (
        <div className="flex items-center justify-between gap-3 px-3.5 py-2 rounded-xl bg-violet-500/10 border border-violet-500/30 text-xs">
          <div className="min-w-0">
            <span className="font-semibold text-violet-400">Catalyst Event: </span>
            <span className="text-[#11081F] dark:text-[#F8F7FC]">{selectedMarker.title}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0 tabular-nums">
            {selectedMarker.deltaPct !== undefined && (
              <span
                className={`font-bold ${
                  selectedMarker.deltaPct >= 0 ? 'text-emerald-500' : 'text-red-500'
                }`}
              >
                {selectedMarker.deltaPct >= 0 ? '+' : ''}
                {selectedMarker.deltaPct}%
              </span>
            )}
            <span className="font-mono text-[#645582] dark:text-[#A99BC8]">
              {formatXAF(selectedMarker.priceXAF)}
            </span>
          </div>
        </div>
      )}

      <div className={`w-full ${heightClass}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 12, left: 0, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(139, 92, 246, 0.14)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#9486B5' }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 11, fill: '#9486B5' }}
              axisLine={false}
              tickLine={false}
              width={64}
              tickFormatter={(v: number) => `${Math.round(v).toLocaleString()}`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#180D2B',
                borderColor: '#2A174A',
                borderRadius: '12px',
                color: '#F8F7FC',
                fontSize: '12px',
              }}
              formatter={(value: unknown) => [formatXAF(Number(value || 0)), 'Share Price']}
            />
            <Area
              type="monotone"
              dataKey="priceXAF"
              stroke={strokeColor}
              strokeWidth={2.5}
              fill={fillColor}
              fillOpacity={0.14}
              isAnimationActive={false}
            />
            {catalystPoints.map((pt) => (
              <ReferenceDot
                key={pt.idx}
                x={pt.label}
                y={pt.priceXAF}
                r={5}
                fill={(pt.deltaPct ?? 0) >= 0 ? '#10B981' : '#EF4444'}
                stroke="#0B0514"
                strokeWidth={2}
                onClick={() => {
                  if (pt.catalystTitle) {
                    setSelectedMarker({
                      title: pt.catalystTitle,
                      deltaPct: pt.deltaPct,
                      priceXAF: pt.priceXAF,
                    });
                    onSelectCatalyst?.(pt.catalystTitle, pt.deltaPct);
                  }
                }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

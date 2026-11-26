"use client";

import { useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { chartRangeLabels, chartRanges, chartSeries, type ChartRange } from "@/lib/prices/chart";
import type { GameHistory } from "@/lib/prices/history";
import { formatPrice, shopNames } from "@/lib/prices/offers";
import { shopCodes } from "@/lib/prices/types";

type PriceChartProps = {
  history: GameHistory;
  now: Date;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const config = Object.fromEntries(
  shopCodes.map((shop) => [shop, { label: shopNames[shop], color: `var(--shop-${shop})` }]),
) satisfies ChartConfig;

const shortDate = (t: number) => new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "short", timeZone: "UTC" });
const fullDate = (t: number) => new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

/** Price over time, one stepped line per shop. Shown as is however little history there is. */
export function PriceChart({ history, now }: PriceChartProps) {
  const [range, setRange] = useState<ChartRange>("90d");
  const series = useMemo(() => chartSeries(history, range, now), [history, range, now]);

  // A lone point, or a flat line, still needs room around it to be drawn and read.
  const times = series.rows.map((row) => row.t);
  const first = times[0] ?? now.getTime();
  const last = times[times.length - 1] ?? now.getTime();
  const pad = Math.max(DAY_MS, (last - first) * 0.04);

  return (
    <div className="grid min-w-0 gap-2">
      <ToggleGroup
        type="single"
        size="sm"
        variant="outline"
        value={range}
        onValueChange={(next) => next && setRange(next as ChartRange)}
        aria-label="Период графика"
        className="justify-self-start"
      >
        {chartRanges.map((item) => (
          <ToggleGroupItem key={item} value={item} className="h-6 px-2 text-[11px] font-normal shadow-none">
            {chartRangeLabels[item]}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <ChartContainer config={config} className="aspect-auto h-52 w-full">
        <LineChart data={series.rows} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} accessibilityLayer>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={[first - pad, last + pad]}
            tickFormatter={shortDate}
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={48}
          />
          <YAxis
            width={64}
            tickFormatter={(value: number) => formatPrice(value)}
            tickLine={false}
            axisLine={false}
            domain={[(min: number) => Math.floor((min * 0.9) / 100) * 100, (max: number) => Math.ceil((max * 1.1) / 100) * 100]}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                labelFormatter={(_label, payload) => fullDate(Number(payload?.[0]?.payload?.t))}
                formatter={(value, name) => (
                  <span className="flex w-full items-center justify-between gap-4">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ backgroundColor: `var(--shop-${name})` }} />
                      {shopNames[name as keyof typeof shopNames]}
                    </span>
                    <span className="font-mono tabular-nums">{formatPrice(Number(value))}</span>
                  </span>
                )}
              />
            }
          />
          {series.shops.map((shop) => (
            <Line
              key={shop}
              dataKey={shop}
              type="stepAfter"
              stroke={`var(--color-${shop})`}
              strokeWidth={2}
              dot={{ r: 3, fill: `var(--color-${shop})` }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ChartContainer>
    </div>
  );
}

"use client";

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CountItem } from "@/types";

interface Props {
  data: CountItem[];
  /** Denominator for the percentage in the tooltip. */
  total: number;
  unit?: string;
}

/** Single-series horizontal bar chart: one hue, value at the bar tip, tooltip on hover. */
export function BarListChart({ data, total, unit = "conversations" }: Props) {
  const height = Math.max(120, data.length * 34 + 16);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, bottom: 4, left: 4 }} barCategoryGap={8}>
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis
            type="category"
            dataKey="label"
            width={170}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload as CountItem;
              const pct = total ? Math.round((item.count / total) * 100) : 0;
              return (
                <div className="rounded-md border bg-popover px-3 py-2 text-xs shadow-sm">
                  <div className="font-medium">{item.label}</div>
                  <div className="text-muted-foreground tabular-nums">
                    {item.count} {unit} · {pct}% of {total}
                  </div>
                </div>
              );
            }}
          />
          <Bar dataKey="count" fill="var(--viz-bar)" radius={[0, 4, 4, 0]} barSize={16} isAnimationActive={false}>
            <LabelList dataKey="count" position="right" className="tabular-nums" style={{ fontSize: 12, fill: "var(--foreground)" }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

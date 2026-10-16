'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { ArrowUpRight, ArrowDownRight, Loader2, Users } from 'lucide-react';
import { apiRequest } from '@/lib/api-client';

interface DailyHistory {
  date: string;
  followerCount: number;
  change: number;
}

interface FollowersResponse {
  currentFollowers: number;
  followersGrowth30d: number;
  followersGrowthPercent30d: number;
  dailyHistory: DailyHistory[];
}

export function FollowersChart() {
  const [data, setData] = React.useState<FollowersResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  React.useEffect(() => {
    setLoading(true);
    apiRequest<FollowersResponse>('/analytics/followers')
      .then((res) => setData(res))
      .catch((e) => console.error('Failed to load followers stats', e))
      .finally(() => setLoading(false));
  }, []);

  const width = 600;
  const height = 200;
  const paddingLeft = 45;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const chartData = data?.dailyHistory || [];

  // Find bounds to scale
  const counts = chartData.map((d) => d.followerCount);
  const minVal = counts.length ? Math.min(...counts) * 0.995 : 0;
  const maxVal = counts.length ? Math.max(...counts) * 1.005 : 100;
  const valRange = maxVal - minVal || 10;

  // Compute coordinates
  const points = chartData.map((d, i) => {
    const x =
      paddingLeft +
      (chartData.length > 1 ? (i / (chartData.length - 1)) * chartWidth : chartWidth / 2);
    const y = height - paddingBottom - ((d.followerCount - minVal) / valRange) * chartHeight;
    return { x, y, ...d };
  });

  if (loading || !data) {
    return (
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-5 rounded-2xl shadow-sm flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <div className="h-4 w-36 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-48 bg-slate-50 rounded animate-pulse" />
          </div>
          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
        </div>
        <div className="h-[200px] bg-slate-50 rounded-xl animate-pulse" />
      </div>
    );
  }

  const generatePath = () => {
    if (points.length === 0) return '';
    return points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
    }, '');
  };

  const generateAreaPath = () => {
    if (points.length === 0) return '';
    const linePath = generatePath();
    const startX = points[0].x;
    const endX = points[points.length - 1].x;
    const baseY = height - paddingBottom;
    return `${linePath} L ${endX} ${baseY} L ${startX} ${baseY} Z`;
  };

  const linePath = generatePath();
  const areaPath = generateAreaPath();

  const isGrowth = data.followersGrowth30d >= 0;

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-5 rounded-2xl shadow-sm flex flex-col space-y-4">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center space-x-1.5">
            <Users className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-slate-900">Instagram Followers Growth</h3>
          </div>
          <p className="text-[10px] text-slate-500">
            Growth and fluctuations over the past 30 days
          </p>
        </div>

        <div className="flex items-baseline space-x-3">
          <span className="text-2xl font-black text-slate-900 tracking-tight">
            {data.currentFollowers.toLocaleString()}
          </span>
          <span
            className={`text-xs font-semibold flex items-center space-x-0.5 ${
              isGrowth ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {isGrowth ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            <span>
              {isGrowth ? '+' : ''}
              {data.followersGrowth30d.toLocaleString()} ({isGrowth ? '+' : ''}
              {data.followersGrowthPercent30d}%)
            </span>
          </span>
        </div>
      </div>

      {/* SVG chart */}
      <div className="relative w-full h-[200px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="followersGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00BB88" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#00BB88" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.33, 0.66, 1].map((r, i) => {
            const y = paddingTop + r * chartHeight;
            const gridVal = Math.round(maxVal - r * valRange);
            return (
              <g key={i} className="opacity-100">
                <line
                  x1={paddingLeft}
                  y1={y}
                  x2={width - paddingRight}
                  y2={y}
                  stroke="rgba(0,0,0,0.06)"
                  strokeWidth="0.5"
                  strokeDasharray="4 4"
                />
                <text x={paddingLeft - 8} y={y + 3} fill="#94a3b8" fontSize="8" textAnchor="end">
                  {gridVal.toLocaleString()}
                </text>
              </g>
            );
          })}

          {/* Horizontal X Axis line */}
          <line
            x1={paddingLeft}
            y1={height - paddingBottom}
            x2={width - paddingRight}
            y2={height - paddingBottom}
            stroke="rgba(0,0,0,0.08)"
            strokeWidth="1"
          />

          {/* Area */}
          <motion.path
            d={areaPath}
            fill="url(#followersGlow)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />

          {/* Line */}
          <motion.path
            d={linePath}
            fill="none"
            stroke="#00BB88"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1 }}
          />

          {/* Hover interactive zones */}
          {points.map((p, i) => (
            <g key={i}>
              <rect
                x={p.x - chartWidth / (points.length - 1) / 2}
                y={paddingTop}
                width={chartWidth / (points.length - 1)}
                height={chartHeight}
                fill="transparent"
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                className="cursor-pointer"
              />

              {/* Highlight dot and vertical line */}
              {hoveredIndex === i && (
                <g>
                  <line
                    x1={p.x}
                    y1={paddingTop}
                    x2={p.x}
                    y2={height - paddingBottom}
                    stroke="rgba(0,0,0,0.15)"
                    strokeWidth="1"
                  />
                  <circle cx={p.x} cy={p.y} r="5" fill="#00BB88" stroke="#ffffff" strokeWidth="2" />
                </g>
              )}
            </g>
          ))}
        </svg>

        {/* Floating Tooltip */}
        {hoveredIndex !== null && points[hoveredIndex] && (
          <div
            className="absolute z-20 bg-white border border-slate-200 p-2.5 rounded-xl text-[10px] space-y-1 shadow-lg text-slate-900 pointer-events-none"
            style={{
              left: `${(points[hoveredIndex].x / width) * 100}%`,
              top: `15%`,
              transform: `translateX(-50%)`,
            }}
          >
            <div className="font-bold border-b border-slate-100 pb-0.5 text-center mb-1 text-slate-700">
              {new Date(points[hoveredIndex].date).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </div>
            <div className="flex justify-between space-x-4">
              <span className="text-slate-500">Followers:</span>
              <span className="font-bold text-slate-900">
                {points[hoveredIndex].followerCount.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between space-x-4">
              <span className="text-slate-500">Change:</span>
              <span
                className={`font-bold ${
                  points[hoveredIndex].change >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {points[hoveredIndex].change >= 0 ? '+' : ''}
                {points[hoveredIndex].change.toLocaleString()}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

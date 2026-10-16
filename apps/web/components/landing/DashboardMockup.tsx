'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Activity, CheckCircle2, Zap, Radio, Sparkles } from 'lucide-react';

export default function DashboardMockup() {
  const [hoveredIdx, setHoveredIdx] = React.useState<number | null>(null);

  const hourlyData = [
    { hour: '00:00', dms: 120, rate: 99.2 },
    { hour: '02:00', dms: 85, rate: 98.9 },
    { hour: '04:00', dms: 64, rate: 100 },
    { hour: '06:00', dms: 190, rate: 99.1 },
    { hour: '08:00', dms: 480, rate: 98.7 },
    { hour: '10:00', dms: 820, rate: 99.4 },
    { hour: '12:00', dms: 1150, rate: 99.6 },
    { hour: '14:00', dms: 980, rate: 98.8 },
    { hour: '16:00', dms: 1340, rate: 99.8 },
    { hour: '18:00', dms: 1560, rate: 99.5 },
    { hour: '20:00', dms: 1420, rate: 99.1 },
    { hour: '22:00', dms: 890, rate: 99.7 },
  ];

  const maxVal = Math.max(...hourlyData.map((d) => d.dms));
  const minVal = 0;

  // SVG dimensions
  const svgWidth = 800;
  const svgHeight = 220;
  const paddingX = 40;
  const paddingY = 30;
  const chartW = svgWidth - paddingX * 2;
  const chartH = svgHeight - paddingY * 2;

  const points = hourlyData.map((d, i) => {
    const x = paddingX + (i / (hourlyData.length - 1)) * chartW;
    const y = paddingY + chartH - ((d.dms - minVal) / (maxVal - minVal)) * chartH;
    return { x, y, ...d };
  });

  // Build smooth bezier curve
  const pathD = points.reduce((acc, pt, i, arr) => {
    if (i === 0) return `M ${pt.x} ${pt.y}`;
    const prev = arr[i - 1];
    const cp1x = prev.x + (pt.x - prev.x) / 2;
    const cp1y = prev.y;
    const cp2x = prev.x + (pt.x - prev.x) / 2;
    const cp2y = pt.y;
    return `${acc} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${pt.x} ${pt.y}`;
  }, '');

  const areaD = `${pathD} L ${points[points.length - 1].x} ${svgHeight - paddingY} L ${points[0].x} ${svgHeight - paddingY} Z`;

  return (
    <section className="py-20 px-6 overflow-hidden relative">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12 space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 shadow-sm text-xs font-bold text-emerald-800">
            <Radio className="w-3.5 h-3.5 text-primary animate-pulse" />
            <span>Real-Time Engine Telemetry</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            A dashboard that feels{' '}
            <span className="bg-gradient-to-r from-primary via-emerald-600 to-accent-cyan bg-clip-text text-transparent">
              alive
            </span>
          </h2>
          <p className="text-slate-600 text-sm sm:text-base max-w-xl mx-auto">
            Live webhook stream, conversion rates, and sub-second Meta Graph API delivery
            statistics.
          </p>
        </div>

        {/* Large Mockup Container */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xl relative overflow-hidden backdrop-blur-sm">
          {/* Top telemetry status bar */}
          <div className="flex flex-wrap items-center justify-between pb-6 mb-6 border-b border-slate-100 gap-4">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
              </span>
              <div>
                <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  Live Instagram Webhook Socket
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] font-mono text-emerald-700">
                    ONLINE
                  </span>
                </p>
                <p className="text-[11px] text-slate-500 font-medium">
                  Average round-trip response time:{' '}
                  <span className="font-bold text-primary">284ms</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-xl">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span>Surge queue protection: Active</span>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {[
              {
                label: 'Total DMs Delivered',
                value: '24,891',
                trend: '+28% today',
                icon: Zap,
                glow: 'from-primary/20 to-transparent',
              },
              {
                label: 'API Delivery Rate',
                value: '99.4%',
                trend: 'Zero dropouts',
                icon: CheckCircle2,
                glow: 'from-accent-cyan/20 to-transparent',
              },
              {
                label: 'Active Automation Funnels',
                value: '12 Active',
                trend: '3 Reels • 9 Posts',
                icon: TrendingUp,
                glow: 'from-emerald-400/20 to-transparent',
              },
              {
                label: 'Comments Converted',
                value: '31,240',
                trend: '84.2% CTR in DM',
                icon: Activity,
                glow: 'from-teal-400/20 to-transparent',
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-gradient-to-b from-slate-50/80 to-slate-100/40 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between relative overflow-hidden group hover:border-emerald-300 transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wider">
                    {stat.label}
                  </p>
                  <stat.icon className="w-4 h-4 text-primary opacity-80" />
                </div>
                <div>
                  <p className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                    {stat.value}
                  </p>
                  <p className="text-[11px] font-bold text-emerald-600 mt-1 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    {stat.trend}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Vibrant SVG Wave Chart Area */}
          <div className="bg-gradient-to-b from-slate-900 via-[#0B101D] to-[#080C14] border border-slate-800 rounded-2xl p-5 sm:p-6 text-white shadow-inner relative overflow-hidden">
            <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-sm font-extrabold text-white block">
                    Hourly Direct Message Inbound & Outbound Velocity
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    24-hour rolling window with sub-second execution
                  </span>
                </div>
              </div>

              {hoveredIdx !== null ? (
                <div className="px-3 py-1 rounded-lg bg-primary/20 border border-primary/30 text-xs font-mono font-bold text-primary animate-fadeIn">
                  {hourlyData[hoveredIdx].hour} — {hourlyData[hoveredIdx].dms.toLocaleString()} DMs
                  ({hourlyData[hoveredIdx].rate}% success)
                </div>
              ) : (
                <div className="text-xs font-mono text-slate-400">
                  Peak: <span className="text-white font-bold">1,560 DMs/hr</span>
                </div>
              )}
            </div>

            {/* SVG Visual */}
            <div className="relative w-full aspect-[800/240] sm:h-56">
              <svg
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-full overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  {/* Vibrant emerald-to-cyan gradient fill */}
                  <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00BB88" stopOpacity="0.45" />
                    <stop offset="60%" stopColor="#00E5FF" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#00E5FF" stopOpacity="0.0" />
                  </linearGradient>

                  <linearGradient id="lineStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#00BB88" />
                    <stop offset="50%" stopColor="#00E5FF" />
                    <stop offset="100%" stopColor="#10B981" />
                  </linearGradient>

                  {/* Glow filter */}
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow
                      dx="0"
                      dy="0"
                      stdDeviation="4"
                      floodColor="#00BB88"
                      floodOpacity="0.6"
                    />
                  </filter>
                </defs>

                {/* Subtle Grid horizontal reference lines */}
                {[0.25, 0.5, 0.75].map((factor) => {
                  const y = paddingY + chartH * factor;
                  return (
                    <line
                      key={factor}
                      x1={paddingX}
                      y1={y}
                      x2={svgWidth - paddingX}
                      y2={y}
                      stroke="rgba(255,255,255,0.06)"
                      strokeDasharray="4 4"
                    />
                  );
                })}

                {/* Area under curve */}
                <path d={areaD} fill="url(#areaFill)" />

                {/* Main Curve */}
                <path
                  d={pathD}
                  fill="none"
                  stroke="url(#lineStroke)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  filter="url(#glow)"
                />

                {/* Interactive Data points */}
                {points.map((pt, idx) => {
                  const isHovered = hoveredIdx === idx;
                  const isLast = idx === points.length - 2; // Peak point

                  return (
                    <g
                      key={idx}
                      className="cursor-pointer transition-transform"
                      onMouseEnter={() => setHoveredIdx(idx)}
                      onMouseLeave={() => setHoveredIdx(null)}
                    >
                      {/* Invisible hover target */}
                      <circle cx={pt.x} cy={pt.y} r="18" fill="transparent" />

                      {/* Visible circle */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 6 : isLast ? 5 : 3.5}
                        fill={isHovered ? '#FFFFFF' : '#00BB88'}
                        stroke="#090D16"
                        strokeWidth="2"
                        className="transition-all duration-200"
                      />

                      {/* Pulsing ring on active peak */}
                      {isLast && hoveredIdx === null && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="10"
                          fill="none"
                          stroke="#00E5FF"
                          strokeWidth="1.5"
                          className="animate-ping origin-center opacity-75"
                        />
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* X-axis time labels */}
            <div className="flex justify-between pt-2 px-6 border-t border-white/5 text-[10px] font-mono text-slate-400">
              {hourlyData.map((d) => (
                <span key={d.hour} className="hover:text-primary transition-colors">
                  {d.hour}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

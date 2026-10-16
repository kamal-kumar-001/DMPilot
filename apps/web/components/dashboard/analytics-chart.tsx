'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { useAnalyticsChart } from '@/lib/use-analytics';

export function AnalyticsChart() {
  const { data: chartData, loading } = useAnalyticsChart();
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);

  const width = 600;
  const height = 220;
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 30;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Find max value in dataset to scale chart
  const maxVal = chartData.length
    ? Math.max(...chartData.map((d) => Math.max(d.comments, d.messages))) * 1.1 || 10
    : 100;

  // Compute coordinate points
  const points = chartData.map((d, i) => {
    const x =
      paddingLeft +
      (chartData.length > 1 ? (i / (chartData.length - 1)) * chartWidth : chartWidth / 2);
    const yComments = height - paddingBottom - (d.comments / maxVal) * chartHeight;
    const yMessages = height - paddingBottom - (d.messages / maxVal) * chartHeight;
    return { x, yComments, yMessages, ...d };
  });

  if (loading) {
    return (
      <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-5 rounded-2xl shadow-sm flex flex-col space-y-4">
        <div className="flex justify-between items-center">
          <div className="space-y-1">
            <div className="h-4 w-32 bg-slate-100 rounded animate-pulse" />
            <div className="h-3 w-48 bg-slate-50 rounded animate-pulse" />
          </div>
        </div>
        <div className="h-[220px] bg-slate-50 rounded-xl animate-pulse" />
      </div>
    );
  }

  // Generate SVG Path definitions
  const generatePath = (valKey: 'yComments' | 'yMessages') => {
    if (points.length === 0) return '';
    return points.reduce((acc, p, i) => {
      return i === 0 ? `M ${p.x} ${p[valKey]}` : `${acc} L ${p.x} ${p[valKey]}`;
    }, '');
  };

  const generateAreaPath = (valKey: 'yComments' | 'yMessages') => {
    if (points.length === 0) return '';
    const linePath = generatePath(valKey);
    const startX = points[0].x;
    const endX = points[points.length - 1].x;
    const baseY = height - paddingBottom;
    return `${linePath} L ${endX} ${baseY} L ${startX} ${baseY} Z`;
  };

  const commentPath = generatePath('yComments');
  const commentArea = generateAreaPath('yComments');

  const messagePath = generatePath('yMessages');
  const messageArea = generateAreaPath('yMessages');

  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/80 p-5 rounded-2xl shadow-sm flex flex-col space-y-4">
      {/* Chart Title & Legend */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Automation Traffic</h3>
          <p className="text-[10px] text-slate-500">Hourly activity stats over the past week</p>
        </div>
        <div className="flex space-x-4 text-xs">
          <div className="flex items-center space-x-1.5">
            <div className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-slate-600 font-medium">Comments</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <div className="h-2 w-2 rounded-full bg-accent-cyan" />
            <span className="text-slate-600 font-medium">DMs sent</span>
          </div>
        </div>
      </div>

      {/* SVG Canvas */}
      <div className="relative w-full h-[220px]">
        <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="commentsGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#00BB88" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#00BB88" stopOpacity="0.0" />
            </linearGradient>
            <linearGradient id="messagesGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
            const y = paddingTop + r * chartHeight;
            const gridVal = Math.round(maxVal * (1 - r));
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
                <text x={paddingLeft - 8} y={y + 4} fill="#94a3b8" fontSize="8" textAnchor="end">
                  {gridVal}
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

          {/* Areas */}
          <motion.path
            d={commentArea}
            fill="url(#commentsGlow)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
          />
          <motion.path
            d={messageArea}
            fill="url(#messagesGlow)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          />

          {/* Lines */}
          <motion.path
            d={commentPath}
            fill="none"
            stroke="#00BB88"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1 }}
          />
          <motion.path
            d={messagePath}
            fill="none"
            stroke="#06b6d4"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1, delay: 0.1 }}
          />

          {/* X Axis Labels */}
          {points.map((p, i) => (
            <text
              key={i}
              x={p.x}
              y={height - paddingBottom + 16}
              fill="#64748b"
              fontSize="9"
              textAnchor="middle"
              className="font-medium"
            >
              {p.date}
            </text>
          ))}

          {/* Hover interactive overlay zones */}
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

              {/* Highlight guidelines & points */}
              {hoveredIndex === i && (
                <g>
                  {/* Guideline */}
                  <line
                    x1={p.x}
                    y1={paddingTop}
                    x2={p.x}
                    y2={height - paddingBottom}
                    stroke="rgba(0,0,0,0.15)"
                    strokeWidth="1"
                  />
                  {/* Comments node dot */}
                  <circle
                    cx={p.x}
                    cy={p.yComments}
                    r="5"
                    fill="#00BB88"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  {/* Messages node dot */}
                  <circle
                    cx={p.x}
                    cy={p.yMessages}
                    r="5"
                    fill="#06b6d4"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                </g>
              )}
            </g>
          ))}
        </svg>

        {/* Dynamic HTML Tooltip */}
        {hoveredIndex !== null && (
          <div
            className="absolute z-20 bg-white border border-slate-200 p-2.5 rounded-xl text-[10px] space-y-1 shadow-lg text-slate-900 pointer-events-none"
            style={{
              left: `${(points[hoveredIndex].x / width) * 100}%`,
              top: `10%`,
              transform: `translateX(-50%)`,
            }}
          >
            <div className="font-bold border-b border-slate-100 pb-0.5 text-center mb-1 text-slate-700">
              {points[hoveredIndex].date}
            </div>
            <div className="flex justify-between space-x-4">
              <span className="text-slate-500">Comments:</span>
              <span className="font-bold text-emerald-600">{points[hoveredIndex].comments}</span>
            </div>
            <div className="flex justify-between space-x-4">
              <span className="text-slate-500">DMs sent:</span>
              <span className="font-bold text-cyan-600">{points[hoveredIndex].messages}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

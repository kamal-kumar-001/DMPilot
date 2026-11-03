import * as React from 'react';

export interface StatCard {
  title: string;
  value: string | number;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  description: string;
  icon?: React.ReactNode;
}

export interface MockCampaign {
  id: string;
  name: string;
  type: 'COMMENT_TO_DM' | 'KEYWORD_TO_DM' | 'WELCOME_DM';
  status: 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
  triggersCount: number;
  repliesSent: number;
  conversionRate: string;
  createdAt: string;
}

export interface ConnectedAccount {
  id: string;
  instagramId: string;
  username: string;
  displayName: string;
  profilePicture: string;
  followersCount: number;
  isConnected: boolean;
  healthStatus: 'healthy' | 'expired' | 'error';
}

export interface ActivityEvent {
  id: string;
  username: string;
  action: string;
  target: string;
  timestamp: string;
  type: 'comment' | 'message' | 'system';
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  isRead: boolean;
  createdAt: string;
}

export interface ChartDataPoint {
  date: string;
  comments: number;
  messages: number;
}

export const mockStats: StatCard[] = [
  {
    title: 'Total Automated Replies',
    value: '12,482',
    change: '+14.3%',
    trend: 'up',
    description: 'Sent via comments & DMs',
  },
  {
    title: 'Response Conversion Rate',
    value: '84.2%',
    change: '+2.1%',
    trend: 'up',
    description: 'Comment triggers turned into DMs',
  },
  {
    title: 'Active Campaigns',
    value: '4',
    change: '0',
    trend: 'neutral',
    description: 'Running automations',
  },
  {
    title: 'Linked Creator Accounts',
    value: '2',
    change: '+1',
    trend: 'up',
    description: 'Connected IG Channels',
  },
];

export const mockCampaigns: MockCampaign[] = [
  {
    id: 'c1',
    name: "Ebook Funnel 'GROW'",
    type: 'COMMENT_TO_DM',
    status: 'ACTIVE',
    triggersCount: 489,
    repliesSent: 412,
    conversionRate: '84.2%',
    createdAt: '2026-07-01',
  },
  {
    id: 'c2',
    name: "Webinar Access 'START'",
    type: 'KEYWORD_TO_DM',
    status: 'ACTIVE',
    triggersCount: 235,
    repliesSent: 201,
    conversionRate: '85.5%',
    createdAt: '2026-07-05',
  },
  {
    id: 'c3',
    name: 'Welcome Automation',
    type: 'WELCOME_DM',
    status: 'ACTIVE',
    triggersCount: 154,
    repliesSent: 154,
    conversionRate: '100%',
    createdAt: '2026-07-10',
  },
  {
    id: 'c4',
    name: "Flash Sale Code 'SAVE'",
    type: 'COMMENT_TO_DM',
    status: 'PAUSED',
    triggersCount: 1245,
    repliesSent: 980,
    conversionRate: '78.7%',
    createdAt: '2026-06-15',
  },
];

export const mockAccounts: ConnectedAccount[] = [
  {
    id: 'a1',
    instagramId: 'ig_alex_tech',
    username: 'alex.tech.creator',
    displayName: 'Alex | Tech & Coding',
    profilePicture: 'A',
    followersCount: 42300,
    isConnected: true,
    healthStatus: 'healthy',
  },
  {
    id: 'a2',
    instagramId: 'ig_alex_vlog',
    username: 'alex.vlogs',
    displayName: 'Alex | Behind the Scenes',
    profilePicture: 'V',
    followersCount: 12100,
    isConnected: true,
    healthStatus: 'healthy',
  },
];

export const mockActivities: ActivityEvent[] = [
  {
    id: 'e1',
    username: 'sarah_k',
    action: "commented 'GROW' on post",
    target: 'How to Build a SaaS in 24h',
    timestamp: '2 mins ago',
    type: 'comment',
  },
  {
    id: 'e2',
    username: 'dev_johnny',
    action: "sent direct message 'START'",
    target: 'Direct Inbox Chat',
    timestamp: '8 mins ago',
    type: 'message',
  },
  {
    id: 'e3',
    username: 'system',
    action: 'refreshed Instagram Graph API token for',
    target: 'alex.tech.creator',
    timestamp: '12 mins ago',
    type: 'system',
  },
  {
    id: 'e4',
    username: 'mike_v',
    action: "commented 'SAVE' on post",
    target: 'DMPilot Framework Release Promo',
    timestamp: '24 mins ago',
    type: 'comment',
  },
  {
    id: 'e5',
    username: 'olivia.web',
    action: 'started thread via comment reply on',
    target: 'Modern Web Design Guide',
    timestamp: '1 hour ago',
    type: 'comment',
  },
];

export const mockNotifications: NotificationItem[] = [
  {
    id: 'n1',
    title: 'Instagram Connection Healthy',
    message: 'Meta Graph API credentials successfully refreshed for alex.tech.creator.',
    type: 'success',
    isRead: false,
    createdAt: '10 mins ago',
  },
  {
    id: 'n2',
    title: 'Campaign Limit Reached Warning',
    message: "Ebook Funnel 'GROW' is nearing its daily limit on automated comments.",
    type: 'warning',
    isRead: false,
    createdAt: '2 hours ago',
  },
  {
    id: 'n3',
    title: 'New Account Connected',
    message: 'Instagram account alex.vlogs was connected successfully.',
    type: 'success',
    isRead: true,
    createdAt: '1 day ago',
  },
];

export const mockChartData: ChartDataPoint[] = [
  { date: 'Jul 09', comments: 140, messages: 120 },
  { date: 'Jul 10', comments: 180, messages: 154 },
  { date: 'Jul 11', comments: 160, messages: 142 },
  { date: 'Jul 12', comments: 220, messages: 198 },
  { date: 'Jul 13', comments: 340, messages: 290 },
  { date: 'Jul 14', comments: 489, messages: 412 },
  { date: 'Jul 15', comments: 520, messages: 450 },
];

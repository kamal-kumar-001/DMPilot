import {
  Zap,
  MessageSquare,
  Languages,
  ShieldCheck,
  Flame,
  BellRing,
  Mic,
  Smartphone,
  Sparkles,
  Users,
  Building2,
  ShoppingBag,
  Briefcase,
  Instagram,
  Mail,
  Github,
  Linkedin,
} from 'lucide-react';

export const LANDING_NAV = {
  logo: 'DMPilot',
  links: [
    { label: 'Features', href: '#features' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'About', href: '/about' },
    { label: 'Contact', href: '/contact' },
  ],
};

export const HERO_CONTENT = {
  badge: '⚡ Autonomous Meta-Certified Instagram Growth Engine for Indian Creators',
  title: 'Turn Reels Engagement Into High-Intent Sales, Instantly',
  titleGradient: 'Instantly',
  description:
    'DMPilot monitors your Instagram account 24/7, filters out spam comments to highlight real buyers, and sends safe, multi-variant DMs in Hinglish, Tamil, & 10+ languages — engineered specifically for creator monetization and digital brand scale.',
  ctaPrimary: 'Start Automation Free',
  ctaSecondary: 'How It Works',
};

export const TRUSTED_LOGOS = [
  'Kavya Fashion House',
  'FitCraft India',
  'Aarav Vlogs Studio',
  'Elevate Growth Media',
  'Bharat D2C Labs',
  'Artisan Craft Collective',
  'NextGen Creator Academy',
  'Pulse Commerce Tech',
];

export const INNOVATIONS_CONTENT = {
  badge: 'Proprietary Technology',
  title: 'Six Engineering Breakthroughs Built for Social Commerce',
  description:
    'Legacy DM bots rely on rigid keyword matching. DMPilot delivers a modern social commerce operating system built from the ground up for creators, D2C brands, and agencies.',
  items: [
    {
      id: 'reply-desk',
      number: '01',
      icon: MessageSquare,
      title: 'Smart Reply Desk',
      subtitle: 'Isolate high-value buyer queries from comment noise.',
      desc: 'When a Reel trends, thousands of repetitive single-word comments like "PRICE" or "LINK" bury authentic leads. Smart Reply Desk automatically isolates genuine buyer questions and surfaces them for immediate action.',
      example: {
        noise: ['price?', 'link plz', 'PRICE', 'send link 🙏'],
        real: 'Do you ship to Bangalore within 2 business days for a size M dress?',
      },
    },
    {
      id: 'multilingual',
      number: '02',
      icon: Languages,
      title: 'Hinglish & Regional Engine',
      subtitle: 'Native support for 10+ Indian scripts & conversational slang.',
      desc: 'Connect with your audience in the exact way India types online. DMPilot handles Hindi, Tamil, Marathi, Bengali, Telugu, Hinglish ("bhai exact price kitna hai"), and Tanglish using ultra-fast low-token classification.',
      languages: [
        'हिन्दी (Hindi)',
        'தமிழ் (Tamil)',
        'मराठी (Marathi)',
        'বাংলা (Bengali)',
        'తెలుగు (Telugu)',
        'Hinglish',
        'Tanglish',
      ],
    },
    {
      id: 'anti-spam',
      number: '03',
      icon: ShieldCheck,
      title: 'Dynamic Copy Variations',
      subtitle: 'Eliminate bot signatures with automated copy rotation.',
      desc: 'Sending identical DM copy repeatedly triggers Meta rate limits. DMPilot dynamically rotates approved text phrasing every 50 sends while keeping your destination links and offers 100% consistent.',
      variantDemo: [
        'Hey @username! Here is your requested access link → dmpilot.org',
        'Hi there! Grab your requested resource right here → dmpilot.org',
        'Hey friend! Tap here to access your link instantly → dmpilot.org',
      ],
    },
    {
      id: 'surge-pacing',
      number: '04',
      icon: Flame,
      title: 'Surge-Paced Viral Queue',
      subtitle: 'Automated queue adaptive rate-limiting during comment spikes.',
      desc: 'When content goes viral and 10,000 comments arrive in minutes, DMPilot auto-detects volume spikes and paces message dispatch to safe, human-like intervals using Redis-backed BullMQ queues.',
      badgeText: 'Surge Detected • Pacing Queue to Human-Safe Intervals',
    },
    {
      id: 'realtime-alerts',
      number: '05',
      icon: BellRing,
      title: 'Real-Time Surge Alerts',
      subtitle: 'Instant mobile PWA push notifications during high volume.',
      desc: 'Receive immediate push alerts on your phone and dashboard when a campaign surges (e.g., 2,500 DMs/hr). Inspect status or adjust pacing with a single tap.',
      alertDemo: '⚡ Viral Spike: 2,500 DMs enqueued in the last 60m. Queue auto-paced safely.',
    },
    {
      id: 'voice-funnel',
      number: '06',
      icon: Mic,
      title: 'Voice Funnel Builder',
      subtitle: 'Generate complete automation funnels using natural speech.',
      desc: 'Build complex trigger-and-reply sequences in seconds. Simply state "When users comment GUIDE on my latest post, DM them my e-book link" and DMPilot configures the funnel automatically.',
      voiceDemo: 'Listening… -> Funnel Created: Trigger "GUIDE" + Button DM Ready to Publish.',
    },
  ],
};

export const PWA_MOBILE_CONTENT = {
  badge: 'Mobile PWA OS',
  title: 'Manage Your Entire DM Engine Anywhere',
  description:
    'No App Store download required. DMPilot installs directly as a lightweight Progressive Web App on iOS & Android with lock-screen quick replies and real-time push alerts.',
  features: [
    {
      icon: BellRing,
      title: 'Lock-Screen Push Notifications',
      desc: 'Get instant notifications when high-intent buyers ask questions in Smart Reply Desk or when a Reel experiences a traffic spike.',
    },
    {
      icon: Smartphone,
      title: 'On-The-Go Campaign Controls',
      desc: 'Activate, pause, or adjust keywords and DM templates from your smartphone with zero latency.',
    },
    {
      icon: MessageSquare,
      title: 'Mobile Reply Desk',
      desc: 'Review and answer genuine customer inquiries right from your phone screen in your audience’s native language.',
    },
  ],
};

export const PERSONAS_CONTENT = {
  badge: 'Engineered For Scale',
  title: 'Tailored Operating Modes for Every Creator & Business Model',
  items: [
    {
      type: 'Digital Creators',
      icon: Sparkles,
      tag: '🎬 Digital Creators',
      desc: 'Automate digital product links, course access, and community invites while focusing on content creation.',
      stat: '28,400+ DMs Automated / Month',
      creatorHandle: '@aarav_vlogs',
    },
    {
      type: 'Local Retailers',
      icon: Building2,
      tag: '💼 Local Retailers',
      desc: 'Sell apparel, jewelry, handcrafted goods, and custom cakes directly through instant Instagram DM conversations.',
      stat: '5.2x Conversion Increase',
      creatorHandle: '@kavya_fashion_house',
    },
    {
      type: 'D2C Brands',
      icon: ShoppingBag,
      tag: '🛍️ D2C Brands',
      desc: 'Deliver discount vouchers, product catalog cards, and Razorpay checkout links the second users ask.',
      stat: '₹18.6L Revenue via Automated DMs',
      creatorHandle: '@fitcraft_india',
    },
    {
      type: 'Creator Agencies',
      icon: Briefcase,
      tag: '👥 Creator Agencies',
      desc: 'Manage multiple client rosters with multi-seat workspaces, permission roles, and white-label options.',
      stat: '35 Client Accounts Managed',
      creatorHandle: 'Elevate Growth Media',
    },
  ],
};

export const FAQS_CONTENT = {
  badge: 'Clear Answers',
  title: 'Frequently Asked Questions',
  items: [
    {
      q: 'How does DMPilot ensure full compliance with Meta Graph API policies?',
      a: 'DMPilot is engineered exclusively on official Meta Graph API v20.0 endpoints. It utilizes dynamic copy rotation every 50 sends and Redis surge queue pacing to ensure your Instagram account remains 100% compliant and safe.',
    },
    {
      q: 'Is DMPilot branding removed from sent messages?',
      a: 'Yes! Every plan on DMPilot (Free, Pro, and Agency) includes 100% Whitelabel DMs with ZERO DMPilot branding.',
    },
    {
      q: 'How does the Hinglish and Multilingual Engine work?',
      a: 'Our hybrid architecture combines fast local regex/ML pattern classifiers with low-token LLM prompt compression. It parses Hinglish ("bhai price kya hai"), Tanglish, and 10+ regional scripts instantly without expensive token overhead.',
    },
    {
      q: 'What makes the Smart Reply Desk different from standard comment bots?',
      a: 'Smart Reply Desk evaluates incoming comments using intent classification to filter out generic single-word spam ("PRICE", "LINK") and surface high-value buyer questions requiring direct attention.',
    },
    {
      q: 'Can agencies manage multiple client Instagram channels?',
      a: 'Yes. The Agency Plan supports 5 to 20 team seats, multi-client workspace separation, role permissions, and dedicated relationship manager support.',
    },
  ],
};

export const FOOTER_CONTENT = {
  brand: 'DMPilot',
  tagline: 'Instagram Business OS & Autonomous DM Growth Engine.',
  copyright: '© 2026 DMPilot Technologies Inc. All rights reserved.',
  socials: [
    { name: 'Instagram', href: 'https://instagram.com', icon: Instagram },
    { name: 'Mail', href: 'mailto:support@dmpilot.org', icon: Mail },
    { name: 'GitHub', href: 'https://github.com', icon: Github },
    { name: 'LinkedIn', href: 'https://linkedin.com', icon: Linkedin },
  ],
  columns: [
    {
      title: 'Product',
      links: [
        { label: 'Features', href: '#features' },
        { label: 'Pricing', href: '/pricing' },
        { label: 'How It Works', href: '#how-it-works' },
        { label: 'Mobile PWA', href: '#mobile' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'About Us', href: '/about' },
        { label: 'Contact Support', href: '/contact' },
        { label: 'Launch Offer', href: '/pricing' },
      ],
    },
    {
      title: 'Legal & Safety',
      links: [
        { label: 'Privacy Policy', href: '/privacy' },
        { label: 'Terms of Service', href: '/terms' },
        { label: 'Meta Compliance', href: '/privacy' },
      ],
    },
  ],
};

export const ABOUT_CONTENT = {
  badge: 'About DMPilot',
  title: 'Built for High-Converting Social Commerce in India',
  description:
    'DMPilot is the next-generation Instagram Business OS engineered specifically for creators, D2C brands, and agencies.',
  contactEmail: 'support@dmpilot.org',
  companyAddress: 'Bengaluru, Karnataka, India',
  developer: {
    name: 'Kamal Kumar',
    role: 'Lead Architect & Founder',
    bio: 'Building autonomous social commerce infrastructure and AI automation for Indian creators.',
    github: 'https://github.com',
    linkedin: 'https://linkedin.com',
    twitter: 'https://twitter.com',
    portfolio: 'https://dmpilot.org',
    email: 'support@dmpilot.org',
  },
};

export const PRIVACY_CONTENT = {
  title: 'Privacy Policy & Data Security',
  lastUpdated: 'August 2026',
  commitment:
    'We strictly adhere to Meta Graph API guidelines and encrypt all OAuth tokens with AES-256 at rest.',
  sections: [
    {
      id: '1',
      title: 'Information We Collect',
      desc: 'We process essential Instagram account information required for automation functionality.',
      bullets: [
        'Account Data: Email address, username, and encrypted Meta access tokens.',
        'Campaign Data: Trigger keywords, DM templates, and message delivery status.',
      ],
    },
    {
      id: '2',
      title: 'Meta Graph API Security & Compliance',
      desc: 'All message automation is executed through official Meta Graph API endpoints.',
      bullets: [
        'Token Protection: OAuth tokens are encrypted at rest with AES-256.',
        'Data Privacy: We never sell or share user conversation logs with third parties.',
      ],
    },
    {
      id: '3',
      title: 'User Data Deletion Instructions (Meta Platform Terms Compliance)',
      desc: 'DMPilot provides users and Meta platform visitors full control over their data.',
      bullets: [
        'Account Deletion via App: Log in to your DMPilot dashboard, navigate to Settings > Account, and select "Request Account Deletion". All connected Instagram profiles, campaigns, and logs will be permanently erased.',
        'Facebook/Instagram App Settings: If you remove DMPilot from your Instagram or Facebook Settings > Apps and Websites, a data deletion callback is triggered automatically.',
        'Manual Requests: You may contact support@dmpilot.org at any time to request complete erasure of your stored identifiers and data.',
      ],
    },
  ],
};

export const TERMS_CONTENT = {
  title: 'Terms of Service',
  lastUpdated: 'August 2026',
  sections: [
    {
      id: '1',
      title: 'Service Terms & Account Eligibility',
      desc: 'Guidelines for operating Instagram automation campaigns.',
      bullets: [
        'Compliance: You must comply with Meta Platform Terms and Community Guidelines.',
        'Account Type: Automation requires an Instagram Business or Creator account.',
      ],
    },
  ],
};

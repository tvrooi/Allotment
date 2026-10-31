import type { SidebarsConfig } from '@docusaurus/plugin-content-docs';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

const sidebars: SidebarsConfig = {
  tutorialSidebar: [
    'intro',
    'start-here',
    'installing',
    'getting-started',
    {
      type: 'category',
      label: 'Using FlyBudget',
      collapsed: false,
      items: [
        'dashboard',
        'accounts',
        'transactions',
        'importing',
        'bank-sync',
        'budgeting',
        'recurring',
        'pay-later',
        'rules',
        'reports',
        'goals',
        'investments',
        'tax',
        'payees',
        'currencies',
        'settings',
      ],
    },
    {
      type: 'category',
      label: 'Other devices',
      collapsed: false,
      items: ['phone', 'offline'],
    },
    'backups',
    'privacy',
    'faq',
  ],
};

export default sidebars;

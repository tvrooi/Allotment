import type { Guide } from './types';

export const budgetGuide: Guide = {
  id: 'budget',
  version: 1,
  title: 'Your budget',
  summary: 'Ready to assign, envelopes, moving money and what carries into next month.',
  page: '/budget',
  steps: [
    {
      title: 'Start with Ready to assign',
      body: 'Money you have that isn’t in a category yet. Only income you’ve received counts; income you expect is a plan, not money.',
      route: '/budget',
      target: 'budget.ready',
    },
    {
      title: 'Give it a job',
      body: 'Click an amount to assign money to a category. Assigned is this month’s amount, Activity is what you spent, and Available is what’s left to spend.',
      phoneBody:
        'Tap an amount to assign money to a category. What’s left to spend shows beside each one.',
      route: '/budget',
      target: ['budget.columns', 'budget.categories'],
    },
    {
      title: 'Move money',
      body: 'Plans change. Move money between categories here, or use it to cover a category that went over.',
      route: '/budget',
      target: 'budget.move',
    },
    {
      title: 'Next month',
      body: 'What’s left in a category carries into next month, so saving for a bigger bill just means assigning a little each month.',
      route: '/budget',
    },
  ],
};

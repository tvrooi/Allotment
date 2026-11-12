import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { EmptyState } from './EmptyState';
import { OnboardingContext } from '../dashboard/onboarding';

describe('EmptyState example', () => {
  it('labels illustrative content and provides one text alternative while keeping the action', () => {
    const html = renderToStaticMarkup(
      createElement(
        OnboardingContext.Provider,
        { value: true },
        createElement(EmptyState, {
          title: 'Keep your files together',
          keepActions: true,
          example: {
            content: createElement('span', null, 'Decorative warranty'),
            description: 'A warranty linked to Home.',
          },
          actions: createElement('button', null, 'Add a file'),
        }),
      ),
    );
    expect(html).toContain('Example');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('A warranty linked to Home.');
    expect(html).toContain('Add a file');
    expect(html).toContain('<h2');
  });
  it('omits the example box when none is supplied', () => {
    expect(renderToStaticMarkup(createElement(EmptyState, { title: 'Empty' }))).not.toContain(
      'Example',
    );
  });
});

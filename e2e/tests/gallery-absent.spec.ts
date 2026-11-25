import { test, expect } from '@playwright/test';
import { SERVER_PORT } from '../ports';

// The development-only controls gallery is only in the gallery build. The default build (the
// one Docker and Home Assistant ship) answers any page URL in server mode, so /dev/controls
// opens the app there: its sign-in, never the gallery. A fresh browser, without the desktop
// suite's fixtures, is a signed-out visitor.

test('the built app has no controls gallery at /dev/controls', async ({ page }) => {
  await page.goto(`http://localhost:${SERVER_PORT}/dev/controls`);
  // Set up on a new server, sign in once the server-mode suite has set it up
  await expect(
    page
      .getByText('Set up your Allotment server')
      .or(page.getByRole('button', { name: 'Sign in' }))
      .first(),
  ).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Controls gallery' })).toHaveCount(0);
});

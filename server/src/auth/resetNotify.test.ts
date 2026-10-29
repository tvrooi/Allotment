import { afterEach, describe, expect, it, vi } from 'vitest';
import { dismissResetNotification, notifyResetCode } from './resetNotify.js';

afterEach(() => {
  delete process.env.SUPERVISOR_TOKEN;
});

describe('Home Assistant reset notification', () => {
  it('creates one persistent notification (replaced on repeat) through the Supervisor', async () => {
    process.env.SUPERVISOR_TOKEN = 'token';
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 200 }));
    await notifyResetCode('AAAA-BBBB-CCCC-DDDD', fetchImpl as unknown as typeof fetch);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://supervisor/core/api/services/persistent_notification/create');
    expect(init.redirect).toBe('error');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer token');
    const body = JSON.parse(init.body as string);
    expect(body.notification_id).toBe('flybudget_password_reset');
    expect(body.message).toContain('AAAA-BBBB-CCCC-DDDD');
    await dismissResetNotification(fetchImpl as unknown as typeof fetch);
    expect((fetchImpl.mock.calls[1] as unknown as [string])[0]).toMatch(
      /persistent_notification\/dismiss$/,
    );
  });

  it('reports a Home Assistant refusal and does nothing without a Supervisor token', async () => {
    const fetchImpl = vi.fn(async () => new Response('no', { status: 401 }));
    await notifyResetCode('X', fetchImpl as unknown as typeof fetch);
    expect(fetchImpl).not.toHaveBeenCalled();
    process.env.SUPERVISOR_TOKEN = 'token';
    await expect(notifyResetCode('X', fetchImpl as unknown as typeof fetch)).rejects.toThrow(
      /error 401/,
    );
  });
});

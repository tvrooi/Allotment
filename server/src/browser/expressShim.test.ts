import { describe, expect, it } from 'vitest';
import { createResponse, Router, type ShimRequest } from './expressShim';

describe('demo response locals', () => {
  it('shares request context between middleware and the route', async () => {
    const router = Router();
    router.use((_req, res, next) => {
      res.locals.context = 'demo owner';
      next();
    });
    router.get('/context', (_req, res) => res.json({ context: res.locals.context }));
    const request: ShimRequest = {
      method: 'GET',
      path: '/context',
      url: '/context',
      params: {},
      query: {},
      body: {},
      headers: {},
      get: () => undefined,
    };
    const response = createResponse();
    await router.handle(request, response, () => {
      throw new Error('Route did not answer');
    });
    expect(JSON.parse(response.body!)).toEqual({ context: 'demo owner' });
  });

  it('starts each response with its own empty context', () => {
    const first = createResponse();
    first.locals.context = 'first request';
    const second = createResponse();
    expect(second.locals).toEqual({});
    expect(second.locals).not.toBe(first.locals);
  });
});

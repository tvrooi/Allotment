import { z } from 'zod';

/**
 * A payee key as schedule discovery makes it (payeeKeyOf): `id:<payee id>` or
 * `name:<lower-case name>`, never empty after the prefix. One check for every place that stores
 * one (the household bill dismiss route) and every place that reads one back (backup restore), so
 * whatever is accepted can be exported and restored.
 */
export const PAYEE_KEY = /^(id|name):.{1,500}$/s;
export const payeeKeySchema = z.string().regex(PAYEE_KEY);

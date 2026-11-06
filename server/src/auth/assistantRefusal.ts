// Kept apart from assistantPolicy.ts so the error handler (middleware/security.ts) can recognise
// a refusal without importing the policy table and the services it reads.

/**
 * A policy row's check, run again inside the write (assistantGuard), refused the write: the
 * budget changed after requireSession checked it. Answered as 403 with its message.
 */
export class AssistantRefusal extends Error {
  readonly status = 403;
}

/** Prefix of that refusal's message, before the check's own reason */
export const CHANGED_BEFORE_SAVING = 'This changed before it could be saved: ';

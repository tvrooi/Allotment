// Schedules keep up with the calendar while the server stays up (FINX-01).
//
// Occurrences (90 days ahead) and automatic transactions used to be made only when the server
// started. An always-on Home Assistant app can run for weeks: a bill set to post itself was
// posted at the next restart, and the stored occurrences that bank rows are matched against ran
// out at their 90-day horizon. This ticks hourly and does the same two steps, in the same order:
//
//   1. top up every active schedule's occurrences to 90 days ahead;
//   2. create the automatic transactions that are due.
//
// Both are idempotent (an occurrence has one `schedule:<id>:<occurrence>` imported id, and the
// horizon only moves forward), so a tick that finds nothing due changes nothing and a tick that
// overlaps the startup run is harmless. A failing tick is logged and the timer keeps going.
import { addDaysIso, todayIso } from '../utils/date.js';
import { autoCreateDueScheduled, ensureOccurrencesForAll } from './scheduleService.js';

/** How often the timer looks. A bill due at midnight posts within the hour. */
export const SCHEDULE_TICK_MS = 60 * 60 * 1000;
/** How far ahead occurrences are kept */
export const OCCURRENCE_HORIZON_DAYS = 90;

export interface ScheduleTickResult {
  ensured: number;
  created: number;
}

/** One pass: occurrences first, then the automatic transactions due on or before `today` */
export function runScheduleTick(today = todayIso()): ScheduleTickResult {
  const ensured = ensureOccurrencesForAll(addDaysIso(today, OCCURRENCE_HORIZON_DAYS));
  const created = autoCreateDueScheduled(today);
  return { ensured, created };
}

export interface ScheduleTimerOptions {
  /**
   * Resolves when the startup bank syncs are done. Nothing is created before then, so a real
   * transaction from the bank is matched to its occurrence before an automatic one is made.
   */
  ready?: Promise<unknown>;
  /** True while a bank sync is running: the tick waits for the next hour instead */
  busy?: () => boolean;
  intervalMs?: number;
  /**
   * Runs after each tick, for work that waits on the network (bill reminders, FINX-02). Its
   * failure is reported like a tick's, and a run still in progress is not started twice.
   */
  afterTick?: () => Promise<unknown>;
  onResult?: (result: ScheduleTickResult) => void;
  onError?: (error: unknown) => void;
}

/** Starts the hourly timer; the returned function stops it. It never keeps the process alive. */
export function startScheduleTimer(options: ScheduleTimerOptions = {}): () => void {
  const {
    ready,
    busy = () => false,
    intervalMs = SCHEDULE_TICK_MS,
    afterTick,
    onResult = (r) => {
      if (r.ensured > 0) console.log(`Ensured ${r.ensured} new occurrence(s)`);
      if (r.created > 0) console.log(`Auto-created ${r.created} scheduled transaction(s)`);
    },
    onError = (err) => console.error('Scheduled transactions failed:', err),
  } = options;
  let started = !ready;
  let stopped = false;
  void ready?.then(
    () => {
      started = true;
    },
    () => {
      started = true; // a failed bank sync must not stop schedules for good
    },
  );
  let following = false;
  const timer = setInterval(() => {
    if (stopped || !started || busy()) return;
    try {
      onResult(runScheduleTick());
    } catch (err) {
      onError(err);
    }
    if (!afterTick || following) return;
    following = true;
    afterTick()
      .catch(onError)
      .finally(() => {
        following = false;
      });
  }, intervalMs);
  timer.unref();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}

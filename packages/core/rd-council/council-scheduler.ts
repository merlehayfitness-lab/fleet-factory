/**
 * R&D Council scheduler.
 *
 * Manages cron scheduling for council sessions at 9AM/5PM with jitter.
 * Determines when the next session should run and which agent proposes.
 */

import {
  COUNCIL_AGENTS,
  DEFAULT_SCHEDULE,
  type CouncilAgent,
  type ScheduleConfig,
} from "./council-types";

/**
 * Get the next scheduled session time with jitter.
 */
export function getNextSessionTime(
  now: Date = new Date(),
  config: ScheduleConfig = DEFAULT_SCHEDULE,
): Date {
  const today = new Date(now);
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find next scheduled time
  for (const timeStr of config.times) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const candidate = new Date(today);
    candidate.setHours(hours, minutes, 0, 0);

    // Add jitter
    const jitterMs = Math.floor(Math.random() * config.jitterMinutes * 60 * 1000);
    candidate.setTime(candidate.getTime() + jitterMs);

    if (candidate > now) {
      return candidate;
    }
  }

  // All times today have passed, schedule for first time tomorrow
  const [hours, minutes] = config.times[0].split(":").map(Number);
  const nextDay = new Date(tomorrow);
  nextDay.setHours(hours, minutes, 0, 0);
  const jitterMs = Math.floor(Math.random() * config.jitterMinutes * 60 * 1000);
  nextDay.setTime(nextDay.getTime() + jitterMs);
  return nextDay;
}

/**
 * Get the proposer for the next session (round-robin).
 * Uses session count to determine which agent proposes.
 */
export function getProposer(sessionCount: number): CouncilAgent {
  const index = sessionCount % COUNCIL_AGENTS.length;
  return COUNCIL_AGENTS[index];
}

/**
 * Check if a session should run now based on schedule.
 */
export function shouldRunSession(
  now: Date = new Date(),
  lastSessionTime: Date | null = null,
  config: ScheduleConfig = DEFAULT_SCHEDULE,
): boolean {
  if (!config.enabled) return false;

  // Don't run more than once per hour
  if (lastSessionTime) {
    const hoursSinceLast = (now.getTime() - lastSessionTime.getTime()) / (1000 * 60 * 60);
    if (hoursSinceLast < 1) return false;
  }

  // Check if current time is within a scheduled window (±30 min)
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  for (const timeStr of config.times) {
    const [hours, minutes] = timeStr.split(":").map(Number);
    const scheduleMinutes = hours * 60 + minutes;
    const diff = Math.abs(currentMinutes - scheduleMinutes);

    if (diff <= 30 + config.jitterMinutes) {
      return true;
    }
  }

  return false;
}

/**
 * Get remaining participants (everyone except the proposer).
 */
export function getParticipants(proposer: CouncilAgent): CouncilAgent[] {
  return COUNCIL_AGENTS.filter((a) => a.name !== proposer.name);
}

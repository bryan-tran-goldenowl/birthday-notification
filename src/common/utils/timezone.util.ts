import { DateTime } from 'luxon';

export class TimezoneUtil {
  /**
   * Get timezones currently at target hour
   */
  static getTimezonesAtHourFromUsers(
    targetHour: number,
    userTimezones: string[],
  ): string[] {
    const now = DateTime.now();

    return userTimezones.filter((tz) => {
      try {
        
        const localTime = now.setZone(tz);
        
        return localTime.hour === targetHour;
      } catch (error) {
        return false;
      }
    });
  }

  /**
   * Check if birthday is today in timezone
   */
  static isBirthdayToday(birthday: Date | string, timezone: string): boolean {
    const birthDate =
      typeof birthday === 'string'
        ? DateTime.fromISO(birthday)
        : DateTime.fromJSDate(birthday);

    if (!birthDate.isValid) return false;

    const userNow = DateTime.now().setZone(timezone);
    return userNow.month === birthDate.month && userNow.day === birthDate.day;
  }

  /**
   * Get current year in timezone
   */
  static getCurrentYear(timezone: string): number {
    return DateTime.now().setZone(timezone).year;
  }

  /**
   * Get today's month and day in timezone (for DB queries)
   */
  static getTodayMonthDay(timezone: string): { month: number; day: number } {
    const now = DateTime.now().setZone(timezone);
    return { month: now.month, day: now.day };
  }

  /**
   * Check if current time in timezone has passed the target hour (>= targetHour)
   */
  static isPastCheckHour(timezone: string, targetHour: number): boolean {
    try {
      const now = DateTime.now().setZone(timezone);
      return now.hour >= targetHour;
    } catch (error) {
      return false;
    }
  }
}

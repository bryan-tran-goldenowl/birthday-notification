import { DateTime } from 'luxon';

export class TimezoneUtil {
  static getCurrentYear(timezone: string): number {
    return DateTime.now().setZone(timezone).year;
  }

  static getTodayMonthDay(timezone: string): { month: number; day: number } {
    const now = DateTime.now().setZone(timezone);
    return { month: now.month, day: now.day };
  }


  static calculateScheduledAt(
    eventDate: Date,
    checkHour: number,
    timezone: string,
    targetYear?: number,
  ): Date {
    const month = eventDate.getMonth() + 1;
    const day = eventDate.getDate();

    if (!targetYear) {
      targetYear = this.getNextEventYear(month, day, timezone);
    }

    const adjustedDate = this.adjustForLeapYear(targetYear, month, day);

    const scheduledAtLocal = DateTime.fromObject(
      {
        year: targetYear,
        month: adjustedDate.month,
        day: adjustedDate.day,
        hour: checkHour,
        minute: 0,
        second: 0,
        millisecond: 0,
      },
      { zone: timezone },
    );

    if (!scheduledAtLocal.isValid) {
      throw new Error(
        `Invalid scheduledAt for ${timezone}: ${scheduledAtLocal.invalidReason}`,
      );
    }

    return scheduledAtLocal.toUTC().toJSDate();
  }

 
  static getNextEventYear(
    month: number,
    day: number,
    timezone: string,
  ): number {
    const now = DateTime.now().setZone(timezone);
    const thisYearEvent = DateTime.fromObject(
      {
        year: now.year,
        month,
        day,
        hour: 9,
        minute: 0,
      },
      { zone: timezone },
    );

    
    return now > thisYearEvent ? now.year + 1 : now.year;
  }


  static adjustForLeapYear(
    year: number,
    month: number,
    day: number,
  ): { month: number; day: number } {
    if (month !== 2 || day !== 29) {
      return { month, day };
    }

    const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;

    if (isLeapYear) {
      return { month: 2, day: 29 };
    }


    return { month: 2, day: 28 };
  }
}

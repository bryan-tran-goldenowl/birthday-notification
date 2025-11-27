import { TimezoneUtil } from './timezone.util';
import { Settings } from 'luxon';

describe('TimezoneUtil', () => {
  afterEach(() => {
    Settings.now = () => Date.now();
  });

  describe('isPastCheckHour', () => {
    it('should return true if current hour > target hour', () => {
      
      Settings.now = () => new Date('2025-01-01T10:00:00Z').valueOf();
      expect(TimezoneUtil.isPastCheckHour('UTC', 9)).toBe(true);
    });

    it('should return true if current hour == target hour', () => {
      
      Settings.now = () => new Date('2025-01-01T09:30:00Z').valueOf();
      expect(TimezoneUtil.isPastCheckHour('UTC', 9)).toBe(true);
    });

    it('should return false if current hour < target hour', () => {
     
      Settings.now = () => new Date('2025-01-01T08:59:00Z').valueOf();
      expect(TimezoneUtil.isPastCheckHour('UTC', 9)).toBe(false);
    });

    it('should handle timezone difference correctly', () => {
   
      Settings.now = () => new Date('2025-01-01T22:00:00Z').valueOf();
      
      Settings.now = () => new Date('2025-01-01T20:00:00Z').valueOf();
      
      expect(TimezoneUtil.isPastCheckHour('UTC', 9)).toBe(true);
      
      expect(TimezoneUtil.isPastCheckHour('Australia/Sydney', 9)).toBe(false);
    });
  });
});

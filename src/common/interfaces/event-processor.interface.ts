import { EventType } from '../enums/event-type.enum';

export interface IEventProcessor {
  getEventType(): EventType;
  getCheckHour(): number;
  getUsersToProcess(timezone: string): Promise<any[]>;
  generateMessage(user: any): string;
}

export const EVENT_PROCESSORS = 'EVENT_PROCESSORS';

export interface INotificationChannel {
  send(message: string, metadata?: Record<string, any>): Promise<boolean>;
  getChannelName(): string;
}

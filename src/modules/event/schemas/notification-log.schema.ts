import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { EventType } from '../../../common/enums/event-type.enum';
import { NotificationStatus } from '../../../common/enums/notification-status.enum';

export type NotificationLogDocument = NotificationLog & Document;

@Schema({
  timestamps: true,
  collection: 'notification_logs',
})
export class NotificationLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({
    required: true,
    enum: EventType,
    type: String,
  })
  eventType: EventType;

  @Prop({ required: true })
  eventYear: number;

  @Prop({
    required: true,
    enum: NotificationStatus,
    default: NotificationStatus.PENDING,
    type: String,
  })
  status: NotificationStatus;

  @Prop({ type: Date })
  sentAt?: Date;

  @Prop({ default: 0 })
  retryCount: number;

  @Prop()
  errorMessage?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  createdAt?: Date;
  updatedAt?: Date;
}

export const NotificationLogSchema =
  SchemaFactory.createForClass(NotificationLog);


NotificationLogSchema.index(
  { userId: 1, eventType: 1, eventYear: 1 },
  { unique: true, name: 'idx_unique_notification' },
);


NotificationLogSchema.index({ status: 1, createdAt: 1 });

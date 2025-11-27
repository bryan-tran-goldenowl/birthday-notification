import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { Factory } from 'nestjs-seeder';

export type UserDocument = User & Document;

@Schema({
  timestamps: true,
  collection: 'users',
})
export class User {
  @Factory((faker) => faker?.person.firstName() || 'John')
  @Prop({ required: true, maxlength: 100 })
  firstName: string;

  @Factory((faker) => faker?.person.lastName() || 'Doe')
  @Prop({ required: true, maxlength: 100 })
  lastName: string;

  @Factory((faker) => {
    // ALL birthdays set to today (with random birth year)
    const today = new Date();
    const year = faker?.number.int({ min: 1924, max: 2005 }) || 1990;
    return new Date(year, today.getMonth(), today.getDate());
  })
  @Prop({ required: true, type: Date })
  birthday: Date;

  @Factory((faker) => faker?.location.timeZone() || 'America/New_York')
  @Prop({ required: true, maxlength: 50 })
  timezone: string;

  @Prop({ type: Date })
  anniversaryDate?: Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Performance indexes
// Optimize for: find({ timezone: '...' }) and distinct('timezone')
UserSchema.index({ timezone: 1, birthday: 1 });
UserSchema.index({ timezone: 1, anniversaryDate: 1 });

// Virtual for full name
UserSchema.virtual('fullName').get(function () {
  return `${this.firstName} ${this.lastName}`;
});

UserSchema.set('toJSON', { virtuals: true });
UserSchema.set('toObject', { virtuals: true });

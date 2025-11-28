import * as mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import * as dotenv from 'dotenv';

dotenv.config();


const UserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true, maxlength: 100 },
    lastName: { type: String, required: true, maxlength: 100 },
    birthday: { type: Date, required: true },
    timezone: { type: String, required: true, maxlength: 50 },
    anniversaryDate: { type: Date },
  },
  {
    timestamps: true,
    collection: 'users',
  }
);

UserSchema.index({ birthday: 1, timezone: 1 });

const User = mongoose.model('User', UserSchema);

async function generateUsers(count: number) {
  const users: Array<{
    firstName: string;
    lastName: string;
    birthday: Date;
    timezone: string;
    anniversaryDate?: Date;
  }> = [];
  const today = new Date();

  
  const month = faker.number.int({ min: 0, max: 11 });
  const day = faker.number.int({ min: 1, max: 28 });

  for (let i = 0; i < count; i++) {
    const year = faker.number.int({ min: 1924, max: 2005 });

  
    const birthday = new Date(Date.UTC(year, month, day));

    const user = {
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      birthday: birthday,
      timezone: faker.location.timeZone(),
    };

    if (faker.datatype.boolean(0.2)) {
      const annivYear = faker.number.int({ min: 1995, max: 2020 });
      const annivMonth = faker.number.int({ min: 0, max: 11 });
      const annivDay = faker.number.int({ min: 1, max: 28 });
      user['anniversaryDate'] = new Date(Date.UTC(annivYear, annivMonth, annivDay));
    }

    users.push(user);
  }

  return users;
}

async function seed() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27018/birthday_notification';

    console.log('🌱 Starting user seeding...');
    console.log(`📡 Connecting to: ${MONGODB_URI}`);

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const TOTAL_USERS = 1000;
    const BATCH_SIZE = 100;
    const batches = Math.ceil(TOTAL_USERS / BATCH_SIZE);

    let totalInserted = 0;
    const startTime = Date.now();

    console.log('⏳ Seeding 100k users with birthdays TODAY...\n');

    for (let i = 0; i < batches; i++) {
      const batchStartTime = Date.now();

      
      const users = await generateUsers(BATCH_SIZE);

      
      await User.insertMany(users, { ordered: false });

      totalInserted += BATCH_SIZE;
      const batchTime = ((Date.now() - batchStartTime) / 1000).toFixed(2);
      const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
      const progress = ((totalInserted / TOTAL_USERS) * 100).toFixed(1);

      console.log(
        `📊 Progress: ${progress}% | Batch ${i + 1}/${batches} | ` +
        `${totalInserted.toLocaleString()}/${TOTAL_USERS.toLocaleString()} users | ` +
        `Batch time: ${batchTime}s | Total time: ${totalTime}s`
      );
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Seeding completed! ${TOTAL_USERS.toLocaleString()} users created in ${totalTime}s`);

    
    const total = await User.countDocuments();
    const today = new Date();
    const birthdaysToday = await User.countDocuments({
      $expr: {
        $and: [
          { $eq: [{ $month: '$birthday' }, today.getMonth() + 1] },
          { $eq: [{ $dayOfMonth: '$birthday' }, today.getDate()] }
        ]
      }
    });
    const uniqueTimezones = (await User.distinct('timezone')).length;

    console.log('\n📈 Database Statistics:');
    console.log(`   Total users: ${total.toLocaleString()}`);
    console.log(`   Birthdays today: ${birthdaysToday.toLocaleString()}`);
    console.log(`   Unique timezones: ${uniqueTimezones}`);

    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

async function drop() {
  try {
    const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27018/birthday_notification';

    console.log('🗑️  Dropping all users...');
    console.log(`📡 Connecting to: ${MONGODB_URI}`);

    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const result = await User.deleteMany({});
    console.log(`✅ Deleted ${result.deletedCount.toLocaleString()} users`);

    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error dropping users:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}


const args = process.argv.slice(2);
if (args.includes('--drop')) {
  drop();
} else {
  seed();
}

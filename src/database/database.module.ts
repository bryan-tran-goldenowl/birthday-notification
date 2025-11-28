import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        uri: configService.get<string>('mongodb.uri'),
        maxPoolSize: configService.get<number>('mongodb.maxPoolSize'),
        minPoolSize: configService.get<number>('mongodb.minPoolSize'),
        maxIdleTimeMS: configService.get<number>('mongodb.maxIdleTimeMS'),
        retryWrites: true,
        w: 'majority',
      }),
    }),
  ],
})
export class DatabaseModule {}

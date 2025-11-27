import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { createBullBoard } from '@bull-board/api';
import { BullAdapter } from '@bull-board/api/bullAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Birthday Notification API')
    .setDescription('Birthday notification system with timezone support')
    .setVersion('1.0')
    .addTag('users', 'User management endpoints')
    .addTag('scheduler', 'Scheduler management')
    .addTag('health', 'Health check')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  // Bull Queue Dashboard
  try {
    const serverAdapter = new ExpressAdapter();
    serverAdapter.setBasePath('/admin/queues');

    createBullBoard({
      queues: [new BullAdapter(app.get('BullQueue_notification'))],
      serverAdapter,
    });

    app.use('/admin/queues', serverAdapter.getRouter());
    logger.log('Bull Dashboard enabled at /admin/queues');
  } catch (error) {
    logger.warn(`Bull Dashboard setup failed: ${error.message}`);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);

  
}

bootstrap();

import 'dotenv/config'
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ExpressAdapter } from '@bull-board/express';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { Queue } from 'bullmq';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/queue');

  createBullBoard({
    queues: [
      new BullMQAdapter(
        new Queue('Rail-Booking-Engine', {
          connection: {
            host: process.env.REDIS_HOST ?? 'localhost',
            port: parseInt(process.env.REDIS_PORT ?? '6379'),
          },
        }),
      ),
    ],
    serverAdapter,
  });

  app.use('/queue', serverAdapter.getRouter());
  
  const config = new DocumentBuilder()
    .setTitle('Rail-Booking-Engine')
    .setDescription('Distributed traffic on big day skenario')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api', app, document)

    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }))
    await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

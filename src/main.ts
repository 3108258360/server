import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(AppConfig.cors);
  const port = AppConfig.server.port;
  await app.listen(port, '0.0.0.0');
  console.log(`🚀 Server is running on http://0.0.0.0:${port}`);
}
void bootstrap();

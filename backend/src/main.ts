import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const port = process.env.BACKEND_PORT ? Number(process.env.BACKEND_PORT) : 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Wave Burger API rodando em http://localhost:${port}`);
}

bootstrap();

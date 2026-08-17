import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health/health.controller';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditModule } from './audit/audit.module';
import { IngredientsModule } from './ingredients/ingredients.module';
import { ProductsModule } from './products/products.module';
import { FichaTecnicaModule } from './ficha-tecnica/ficha-tecnica.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    IngredientsModule,
    ProductsModule,
    FichaTecnicaModule,
  ],
  controllers: [HealthController],
  providers: [],
})
export class AppModule {}

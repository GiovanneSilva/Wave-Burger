import { Module } from '@nestjs/common';
import { IfoodAuthService } from './ifood-auth.service';
import { IfoodCatalogSyncService } from './ifood-catalog-sync.service';
import { IfoodCatalogController } from './ifood-catalog.controller';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [AuthModule],
  controllers: [IfoodCatalogController],
  providers: [IfoodAuthService, IfoodCatalogSyncService],
  exports: [IfoodAuthService, IfoodCatalogSyncService],
})
export class IfoodModule {}

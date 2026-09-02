import { Module } from '@nestjs/common';
import { IfoodAuthService } from './ifood-auth.service';
import { IfoodCatalogSyncService } from './ifood-catalog-sync.service';
import { IfoodCatalogController } from './ifood-catalog.controller';
import { IfoodOrderPollingService } from './ifood-order-polling.service';
import { IfoodSettingsController } from './ifood-settings.controller';
import { AuthModule } from '../auth/auth.module';
import { SalesModule } from '../sales/sales.module';

@Module({
  imports: [AuthModule, SalesModule],
  controllers: [IfoodCatalogController, IfoodSettingsController],
  providers: [IfoodAuthService, IfoodCatalogSyncService, IfoodOrderPollingService],
  exports: [IfoodAuthService, IfoodCatalogSyncService],
})
export class IfoodModule {}

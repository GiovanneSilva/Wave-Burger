import { Module } from '@nestjs/common';
import { IfoodAuthService } from './ifood-auth.service';
import { IfoodCatalogSyncService } from './ifood-catalog-sync.service';
import { IfoodCatalogController } from './ifood-catalog.controller';
import { IfoodOrderPollingService } from './ifood-order-polling.service';
import { IfoodSettingsController } from './ifood-settings.controller';
import { IfoodInventorySyncService } from './ifood-inventory-sync.service';
import { IfoodInventoryController } from './ifood-inventory.controller';
import { AuthModule } from '../auth/auth.module';
import { SalesModule } from '../sales/sales.module';
import { AnalyticsModule } from '../analytics/analytics.module';

@Module({
  imports: [AuthModule, SalesModule, AnalyticsModule],
  controllers: [IfoodCatalogController, IfoodSettingsController, IfoodInventoryController],
  providers: [
    IfoodAuthService,
    IfoodCatalogSyncService,
    IfoodOrderPollingService,
    IfoodInventorySyncService,
  ],
  exports: [IfoodAuthService, IfoodCatalogSyncService],
})
export class IfoodModule {}

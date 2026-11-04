import { Module } from '@nestjs/common';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncKeyGuard } from './sync-key.guard';
import { EdgeSyncService } from './edge-sync.service';

@Module({
  controllers: [SyncController],
  providers: [SyncService, SyncKeyGuard, EdgeSyncService],
})
export class SyncModule {}

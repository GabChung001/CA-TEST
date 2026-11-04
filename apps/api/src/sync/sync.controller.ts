import { Body, Controller, Get, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { SyncKeyGuard } from './sync-key.guard';
import { SyncService } from './sync.service';
import { IngestarMovimientosDto } from './dto/ingestar-movimientos.dto';

/** Endpoints que consume el nodo edge (autenticados por x-sync-key). */
@Controller('sync')
@Public()
@UseGuards(SyncKeyGuard)
export class SyncController {
  constructor(private readonly svc: SyncService) {}

  @Get('catalogo')
  catalogo() {
    return this.svc.snapshot();
  }

  @Post('movimientos')
  @HttpCode(200)
  movimientos(@Body() dto: IngestarMovimientosDto) {
    return this.svc.ingestarMovimientos(dto.movimientos);
  }
}

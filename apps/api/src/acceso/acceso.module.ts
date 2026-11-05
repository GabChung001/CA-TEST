import { Module } from '@nestjs/common';
import { PuntosModule } from '../puntos/puntos.module';
import { SyncModule } from '../sync/sync.module';
import { AccesoService } from './acceso.service';
import { AccesoController } from './acceso.controller';
import { AccesoDispositivoController } from './acceso-dispositivo.controller';
import { ResetPresenciaService } from './reset.service';
import { DeviceGuard } from '../common/guards/device.guard';

@Module({
  imports: [PuntosModule, SyncModule],
  controllers: [AccesoController, AccesoDispositivoController],
  providers: [AccesoService, ResetPresenciaService, DeviceGuard],
})
export class AccesoModule {}

import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { DeviceGuard } from '../common/guards/device.guard';
import { AccesoService } from './acceso.service';
import { ValidarDispositivoDto } from './dto/acceso.dto';

/** Validación desde un lector/tótem autenticado por API key (x-api-key). */
@Controller('acceso/dispositivo')
@Public()
@UseGuards(DeviceGuard)
export class AccesoDispositivoController {
  constructor(private readonly svc: AccesoService) {}

  @Post('validar')
  @HttpCode(200)
  validar(@Req() req: Request, @Body() dto: ValidarDispositivoDto) {
    const dispositivo = (req as Request & {
      dispositivo: { id: string; puntoAccesoId: string };
    }).dispositivo;
    return this.svc.validar({
      qr: dto.qr,
      puntoAccesoId: dispositivo.puntoAccesoId,
      dispositivoId: dispositivo.id,
    });
  }
}

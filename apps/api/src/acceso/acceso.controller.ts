import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types';
import { AccesoService } from './acceso.service';
import { AperturaManualDto, ValidarDto } from './dto/acceso.dto';

/** Validación operada desde caseta (panel / simulador de lector). */
@Controller('acceso')
@Roles('SUPER_ADMIN', 'ADMIN_PARQUE', 'VIGILANCIA')
export class AccesoController {
  constructor(private readonly svc: AccesoService) {}

  @Post('validar')
  @HttpCode(200)
  validar(@CurrentUser() u: AuthUser, @Body() dto: ValidarDto) {
    return this.svc.validar({
      qr: dto.qr,
      puntoAccesoId: dto.puntoAccesoId,
      operadorId: u.sub,
    });
  }

  @Post('apertura-manual')
  @HttpCode(200)
  aperturaManual(@CurrentUser() u: AuthUser, @Body() dto: AperturaManualDto) {
    return this.svc.aperturaManual(u.sub, dto.puntoAccesoId, dto.motivo);
  }
}

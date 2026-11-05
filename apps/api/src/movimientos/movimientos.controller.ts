import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types';
import { MovimientosService } from './movimientos.service';

@Controller('movimientos')
@Roles('SUPER_ADMIN', 'ADMIN_PARQUE', 'VIGILANCIA', 'ADMIN_BODEGA')
export class MovimientosController {
  constructor(private readonly svc: MovimientosService) {}

  @Get('resumen')
  resumen(@CurrentUser() u: AuthUser) {
    return this.svc.resumen(u);
  }

  @Get('presentes')
  presentes(@CurrentUser() u: AuthUser) {
    return this.svc.presentes(u);
  }

  @Get('serie')
  serie(@CurrentUser() u: AuthUser, @Query('dias') dias?: string) {
    return this.svc.serie(u, dias ? Number(dias) : 7);
  }

  @Get()
  listar(@CurrentUser() u: AuthUser, @Query('limit') limit?: string) {
    return this.svc.listar(u, limit ? Number(limit) : 50);
  }
}

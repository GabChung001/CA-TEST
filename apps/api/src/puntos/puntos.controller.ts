import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types';
import { PuntosService } from './puntos.service';
import {
  CambiarEstadoDispositivoDto,
  CreateDispositivoDto,
  CreatePuntoDto,
  UpdatePuntoDto,
} from './dto/punto.dto';

@Controller('puntos')
@Roles('SUPER_ADMIN', 'ADMIN_PARQUE', 'VIGILANCIA')
export class PuntosController {
  constructor(private readonly svc: PuntosService) {}

  @Get()
  listar(@CurrentUser() u: AuthUser) {
    return this.svc.listar(u);
  }

  @Post()
  @Roles('SUPER_ADMIN', 'ADMIN_PARQUE')
  crear(@CurrentUser() u: AuthUser, @Body() dto: CreatePuntoDto) {
    return this.svc.crear(u, dto);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN_PARQUE')
  actualizar(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePuntoDto,
  ) {
    return this.svc.actualizar(u, id, dto);
  }

  @Post(':id/dispositivos')
  @Roles('SUPER_ADMIN', 'ADMIN_PARQUE')
  crearDispositivo(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: CreateDispositivoDto,
  ) {
    return this.svc.crearDispositivo(u, id, dto);
  }

  @Post('dispositivos/:devId/regenerar')
  @Roles('SUPER_ADMIN', 'ADMIN_PARQUE')
  regenerarLlave(@CurrentUser() u: AuthUser, @Param('devId') devId: string) {
    return this.svc.regenerarLlave(u, devId);
  }

  @Patch('dispositivos/:devId/estado')
  @Roles('SUPER_ADMIN', 'ADMIN_PARQUE')
  cambiarEstado(
    @CurrentUser() u: AuthUser,
    @Param('devId') devId: string,
    @Body() dto: CambiarEstadoDispositivoDto,
  ) {
    return this.svc.cambiarEstado(u, devId, dto.estado);
  }
}

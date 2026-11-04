import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types';
import { BodegasService } from './bodegas.service';
import { CreateBodegaDto, UpdateBodegaDto } from './dto/bodega.dto';

@Controller('bodegas')
@Roles('SUPER_ADMIN', 'ADMIN_PARQUE')
export class BodegasController {
  constructor(private readonly svc: BodegasService) {}

  @Post()
  crear(@CurrentUser() u: AuthUser, @Body() dto: CreateBodegaDto) {
    return this.svc.crear(u, dto);
  }

  @Get()
  listar(@CurrentUser() u: AuthUser, @Query('parqueId') parqueId?: string) {
    return this.svc.listar(u, parqueId);
  }

  @Get(':id')
  obtener(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.obtener(u, id);
  }

  @Patch(':id')
  actualizar(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateBodegaDto,
  ) {
    return this.svc.actualizar(u, id, dto);
  }
}

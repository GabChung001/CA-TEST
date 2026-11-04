import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types';
import { VehiculosService } from './vehiculos.service';
import { CreateVehiculoDto, UpdateVehiculoDto } from './dto/vehiculo.dto';

@Controller('vehiculos')
@Roles('SUPER_ADMIN', 'ADMIN_PARQUE', 'ADMIN_BODEGA')
export class VehiculosController {
  constructor(private readonly svc: VehiculosService) {}

  @Post()
  crear(@CurrentUser() u: AuthUser, @Body() dto: CreateVehiculoDto) {
    return this.svc.crear(u, dto);
  }

  @Get()
  listar(@CurrentUser() u: AuthUser, @Query('personaId') personaId: string) {
    return this.svc.listar(u, personaId);
  }

  @Patch(':id')
  actualizar(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateVehiculoDto,
  ) {
    return this.svc.actualizar(u, id, dto);
  }

  @Post(':id/baja')
  baja(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.baja(u, id);
  }
}

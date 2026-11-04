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
import { PersonasService } from './personas.service';
import { CreatePersonaDto, UpdatePersonaDto } from './dto/persona.dto';

@Controller('personas')
@Roles('SUPER_ADMIN', 'ADMIN_PARQUE', 'ADMIN_BODEGA')
export class PersonasController {
  constructor(private readonly svc: PersonasService) {}

  @Post()
  crear(@CurrentUser() u: AuthUser, @Body() dto: CreatePersonaDto) {
    return this.svc.crear(u, dto);
  }

  @Get()
  listar(@CurrentUser() u: AuthUser, @Query('bodegaId') bodegaId?: string) {
    return this.svc.listar(u, bodegaId);
  }

  @Get(':id')
  obtener(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.obtener(u, id);
  }

  @Patch(':id')
  actualizar(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePersonaDto,
  ) {
    return this.svc.actualizar(u, id, dto);
  }

  @Post(':id/baja')
  baja(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.baja(u, id);
  }
}

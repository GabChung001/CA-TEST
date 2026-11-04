import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types';
import { UsuariosService } from './usuarios.service';
import {
  CreateUsuarioDto,
  ResetPasswordDto,
  UpdateUsuarioDto,
} from './dto/usuario.dto';

@Controller('usuarios')
@Roles('SUPER_ADMIN', 'ADMIN_PARQUE')
export class UsuariosController {
  constructor(private readonly svc: UsuariosService) {}

  @Post()
  crear(@CurrentUser() u: AuthUser, @Body() dto: CreateUsuarioDto) {
    return this.svc.crear(u, dto);
  }

  @Get()
  listar(@CurrentUser() u: AuthUser) {
    return this.svc.listar(u);
  }

  @Get(':id')
  obtener(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.obtener(u, id);
  }

  @Patch(':id')
  actualizar(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateUsuarioDto,
  ) {
    return this.svc.actualizar(u, id, dto);
  }

  @Post(':id/bloquear')
  bloquear(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.bloquear(u, id, true);
  }

  @Post(':id/desbloquear')
  desbloquear(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.bloquear(u, id, false);
  }

  @Post(':id/reset-password')
  resetPassword(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    return this.svc.resetPassword(u, id, dto);
  }
}

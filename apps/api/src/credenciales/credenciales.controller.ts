import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types';
import { CredencialesService } from './credenciales.service';
import { EmitirCredencialDto } from './dto/credencial.dto';

class BloquearDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motivo?: string;
}

@Controller('credenciales')
@Roles('SUPER_ADMIN', 'ADMIN_PARQUE', 'ADMIN_BODEGA')
export class CredencialesController {
  constructor(private readonly svc: CredencialesService) {}

  @Post()
  emitir(@CurrentUser() u: AuthUser, @Body() dto: EmitirCredencialDto) {
    return this.svc.emitir(u, dto);
  }

  @Get()
  listar(@CurrentUser() u: AuthUser, @Query('personaId') personaId: string) {
    return this.svc.listar(u, personaId);
  }

  @Get(':id/qr')
  qr(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.qrDe(u, id);
  }

  @Post(':id/bloquear')
  bloquear(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: BloquearDto,
  ) {
    return this.svc.cambiarEstado(u, id, 'BLOQUEADA', dto.motivo);
  }

  @Post(':id/revocar')
  revocar(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.cambiarEstado(u, id, 'REVOCADA');
  }

  @Post(':id/reactivar')
  reactivar(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.cambiarEstado(u, id, 'ACTIVA');
  }
}

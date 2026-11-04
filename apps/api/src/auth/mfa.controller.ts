import { Body, Controller, Post } from '@nestjs/common';
import { IsString, Length } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from './types';
import { MfaService } from './mfa.service';

class CodeDto {
  @IsString()
  @Length(6, 6)
  code!: string;
}

/** Cada usuario gestiona su propio MFA (requiere sesión). */
@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly svc: MfaService) {}

  @Post('setup')
  setup(@CurrentUser() u: AuthUser) {
    return this.svc.setup(u.sub);
  }

  @Post('activar')
  activar(@CurrentUser() u: AuthUser, @Body() dto: CodeDto) {
    return this.svc.activar(u.sub, dto.code);
  }

  @Post('desactivar')
  desactivar(@CurrentUser() u: AuthUser, @Body() dto: CodeDto) {
    return this.svc.desactivar(u.sub, dto.code);
  }
}

import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { AuthUser } from '../auth/types';
import { ParquesService } from './parques.service';
import { CreateParqueDto, UpdateParqueDto } from './dto/parque.dto';

@Controller('parques')
@Roles('SUPER_ADMIN')
export class ParquesController {
  constructor(private readonly svc: ParquesService) {}

  @Post()
  crear(@CurrentUser() u: AuthUser, @Body() dto: CreateParqueDto) {
    return this.svc.crear(u.sub, dto);
  }

  @Get()
  listar() {
    return this.svc.listar();
  }

  @Get(':id')
  obtener(@Param('id') id: string) {
    return this.svc.obtener(id);
  }

  @Patch(':id')
  actualizar(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateParqueDto,
  ) {
    return this.svc.actualizar(u.sub, id, dto);
  }
}

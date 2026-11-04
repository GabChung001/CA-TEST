import { Module } from '@nestjs/common';
import { PuntosController } from './puntos.controller';
import { PuntosService } from './puntos.service';

@Module({
  controllers: [PuntosController],
  providers: [PuntosService],
  exports: [PuntosService],
})
export class PuntosModule {}

import { Module } from '@nestjs/common';
import { BarreraService } from './barrera.service';

@Module({
  providers: [BarreraService],
  exports: [BarreraService],
})
export class BarreraModule {}

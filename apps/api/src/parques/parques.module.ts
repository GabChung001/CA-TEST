import { Module } from '@nestjs/common';
import { ParquesController } from './parques.controller';
import { ParquesService } from './parques.service';

@Module({
  controllers: [ParquesController],
  providers: [ParquesService],
})
export class ParquesModule {}

import { Module } from '@nestjs/common';
import { PersonasModule } from '../personas/personas.module';
import { CredencialesController } from './credenciales.controller';
import { CredencialesService } from './credenciales.service';

@Module({
  imports: [PersonasModule],
  controllers: [CredencialesController],
  providers: [CredencialesService],
})
export class CredencialesModule {}

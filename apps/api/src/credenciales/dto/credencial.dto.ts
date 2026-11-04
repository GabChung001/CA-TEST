import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { TipoCredencial } from '@prisma/client';

export class EmitirCredencialDto {
  @IsString()
  personaId!: string;

  @IsEnum(TipoCredencial)
  tipo!: TipoCredencial;

  /** Requerido si tipo = VEHICULAR. */
  @IsOptional()
  @IsString()
  vehiculoId?: string;

  /** ISO; vacío = sin vencimiento (empleado permanente). */
  @IsOptional()
  @IsDateString()
  vigenciaHasta?: string;
}

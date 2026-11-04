import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TipoPuntoAcceso } from '@prisma/client';

export class CreatePuntoDto {
  @IsEnum(TipoPuntoAcceso)
  tipo!: TipoPuntoAcceso;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre!: string;

  /** Requerido para SUPER_ADMIN; ADMIN_PARQUE usa su parque. */
  @IsOptional()
  @IsString()
  parqueId?: string;
}

export class UpdatePuntoDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(80) nombre?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

export class CreateDispositivoDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre!: string;
}

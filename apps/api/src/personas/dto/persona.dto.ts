import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TipoPersona } from '@prisma/client';

export class CreatePersonaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  apellidos?: string;

  @IsEnum(TipoPersona)
  tipo!: TipoPersona;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  documento?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  telefono?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  /** Requerido para SUPER_ADMIN/ADMIN_PARQUE; ADMIN_BODEGA usa su bodega. */
  @IsOptional()
  @IsString()
  bodegaId?: string;
}

export class UpdatePersonaDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) nombre?: string;
  @IsOptional() @IsString() @MaxLength(120) apellidos?: string;
  @IsOptional() @IsEnum(TipoPersona) tipo?: TipoPersona;
  @IsOptional() @IsString() @MaxLength(60) documento?: string;
  @IsOptional() @IsString() @MaxLength(30) telefono?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Rol } from '@prisma/client';

export class CreateUsuarioDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre!: string;

  @IsEnum(Rol)
  rol!: Rol;

  @IsOptional()
  @IsString()
  parqueId?: string;

  @IsOptional()
  @IsString()
  bodegaId?: string;
}

export class UpdateUsuarioDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class ResetPasswordDto {
  @IsString()
  @MinLength(10)
  @MaxLength(128)
  password!: string;
}

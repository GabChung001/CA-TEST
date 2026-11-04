import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBodegaDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nombre!: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  nave?: string;

  /** Requerido para SUPER_ADMIN; se ignora para ADMIN_PARQUE (usa su parque). */
  @IsOptional()
  @IsString()
  parqueId?: string;
}

export class UpdateBodegaDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  nave?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

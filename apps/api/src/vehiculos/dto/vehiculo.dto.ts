import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateVehiculoDto {
  @IsString()
  personaId!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(15)
  placas!: string;

  @IsOptional() @IsString() @MaxLength(40) marca?: string;
  @IsOptional() @IsString() @MaxLength(40) modelo?: string;
  @IsOptional() @IsString() @MaxLength(30) color?: string;
}

export class UpdateVehiculoDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(15) placas?: string;
  @IsOptional() @IsString() @MaxLength(40) marca?: string;
  @IsOptional() @IsString() @MaxLength(40) modelo?: string;
  @IsOptional() @IsString() @MaxLength(30) color?: string;
  @IsOptional() @IsBoolean() activo?: boolean;
}

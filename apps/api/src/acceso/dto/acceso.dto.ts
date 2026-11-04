import { IsString, MaxLength, MinLength } from 'class-validator';

export class ValidarDto {
  @IsString()
  @MaxLength(400)
  qr!: string;

  @IsString()
  puntoAccesoId!: string;
}

export class ValidarDispositivoDto {
  @IsString()
  @MaxLength(400)
  qr!: string;
}

export class AperturaManualDto {
  @IsString()
  puntoAccesoId!: string;

  @IsString()
  @MinLength(3)
  @MaxLength(200)
  motivo!: string;
}

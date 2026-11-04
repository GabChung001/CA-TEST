import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  /** Código TOTP de 6 dígitos (requerido si el usuario tiene MFA habilitado). */
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(6)
  totpCode?: string;
}

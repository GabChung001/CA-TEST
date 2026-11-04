import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokensService } from './tokens.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { MfaController } from './mfa.controller';
import { MfaService } from './mfa.service';

@Module({
  imports: [PassportModule, JwtModule.register({})],
  controllers: [AuthController, MfaController],
  providers: [AuthService, TokensService, JwtStrategy, MfaService],
})
export class AuthModule {}

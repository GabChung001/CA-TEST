import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { ParquesModule } from './parques/parques.module';
import { BodegasModule } from './bodegas/bodegas.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { PersonasModule } from './personas/personas.module';
import { VehiculosModule } from './vehiculos/vehiculos.module';
import { QrModule } from './qr/qr.module';
import { CredencialesModule } from './credenciales/credenciales.module';
import { PuntosModule } from './puntos/puntos.module';
import { AccesoModule } from './acceso/acceso.module';
import { MovimientosModule } from './movimientos/movimientos.module';
import { SyncModule } from './sync/sync.module';
import { HealthController } from './health/health.controller';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    QrModule,
    ParquesModule,
    BodegasModule,
    UsuariosModule,
    PersonasModule,
    VehiculosModule,
    CredencialesModule,
    PuntosModule,
    AccesoModule,
    MovimientosModule,
    SyncModule,
  ],
  controllers: [HealthController],
  providers: [
    // Orden: límite de tasa → autenticación → autorización por rol.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}

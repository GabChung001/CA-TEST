-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('SUPER_ADMIN', 'ADMIN_PARQUE', 'ADMIN_BODEGA', 'VIGILANCIA');

-- CreateEnum
CREATE TYPE "TipoPersona" AS ENUM ('EMPLEADO', 'VISITANTE', 'PROVEEDOR', 'TRANSPORTISTA', 'EVENTUAL');

-- CreateEnum
CREATE TYPE "TipoCredencial" AS ENUM ('PEATONAL', 'VEHICULAR');

-- CreateEnum
CREATE TYPE "EstadoCredencial" AS ENUM ('ACTIVA', 'BLOQUEADA', 'REVOCADA', 'VENCIDA');

-- CreateEnum
CREATE TYPE "EstadoPresencia" AS ENUM ('AFUERA', 'ADENTRO');

-- CreateEnum
CREATE TYPE "SentidoAcceso" AS ENUM ('ENTRADA', 'SALIDA');

-- CreateEnum
CREATE TYPE "TipoPuntoAcceso" AS ENUM ('ENTRADA_VEHICULAR', 'SALIDA_VEHICULAR', 'ENTRADA_PEATONAL', 'SALIDA_PEATONAL');

-- CreateEnum
CREATE TYPE "ResultadoAcceso" AS ENUM ('AUTORIZADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "MotivoRechazo" AS ENUM ('QR_NO_RECONOCIDO', 'FIRMA_INVALIDA', 'CREDENCIAL_BLOQUEADA', 'CREDENCIAL_REVOCADA', 'FUERA_DE_VIGENCIA', 'TIPO_INCORRECTO', 'NO_AUTORIZADO_PUNTO', 'REINGRESO_NO_PERMITIDO', 'DISPOSITIVO_NO_AUTORIZADO');

-- CreateEnum
CREATE TYPE "TipoApertura" AS ENUM ('AUTOMATICA', 'MANUAL');

-- CreateEnum
CREATE TYPE "EstadoDispositivo" AS ENUM ('OPERATIVO', 'DESCONECTADO', 'FUERA_DE_SERVICIO');

-- CreateTable
CREATE TABLE "Parque" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/Mexico_City',
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Parque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bodega" (
    "id" TEXT NOT NULL,
    "parqueId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "nave" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bodega_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "parqueId" TEXT,
    "bodegaId" TEXT,
    "mfaHabilitado" BOOLEAN NOT NULL DEFAULT false,
    "mfaSecret" TEXT,
    "intentosFallidos" INTEGER NOT NULL DEFAULT 0,
    "bloqueadoHasta" TIMESTAMP(3),
    "ultimoAcceso" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sesion" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "refreshHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiraEn" TIMESTAMP(3) NOT NULL,
    "revocadaEn" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sesion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Persona" (
    "id" TEXT NOT NULL,
    "bodegaId" TEXT NOT NULL,
    "tipo" "TipoPersona" NOT NULL DEFAULT 'EMPLEADO',
    "nombre" TEXT NOT NULL,
    "apellidos" TEXT,
    "documento" TEXT,
    "telefono" TEXT,
    "email" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Persona_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehiculo" (
    "id" TEXT NOT NULL,
    "personaId" TEXT,
    "placas" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "color" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehiculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credencial" (
    "id" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "tipo" "TipoCredencial" NOT NULL,
    "estado" "EstadoCredencial" NOT NULL DEFAULT 'ACTIVA',
    "estadoPresencia" "EstadoPresencia" NOT NULL DEFAULT 'AFUERA',
    "vigenciaDesde" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vigenciaHasta" TIMESTAMP(3),
    "personaId" TEXT NOT NULL,
    "vehiculoId" TEXT,
    "emisorId" TEXT NOT NULL,
    "ultimaEntradaEn" TIMESTAMP(3),
    "bloqueoMotivo" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Credencial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PuntoAcceso" (
    "id" TEXT NOT NULL,
    "parqueId" TEXT NOT NULL,
    "tipo" "TipoPuntoAcceso" NOT NULL,
    "nombre" TEXT NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PuntoAcceso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispositivo" (
    "id" TEXT NOT NULL,
    "puntoAccesoId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "estado" "EstadoDispositivo" NOT NULL DEFAULT 'OPERATIVO',
    "ultimoLatido" TIMESTAMP(3),
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editadoEn" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispositivo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Movimiento" (
    "id" TEXT NOT NULL,
    "puntoAccesoId" TEXT NOT NULL,
    "dispositivoId" TEXT,
    "credencialId" TEXT,
    "sentido" "SentidoAcceso" NOT NULL,
    "resultado" "ResultadoAcceso" NOT NULL,
    "motivoRechazo" "MotivoRechazo",
    "tipoApertura" "TipoApertura" NOT NULL DEFAULT 'AUTOMATICA',
    "operadorId" TEXT,
    "motivoManual" TEXT,
    "qrLeido" TEXT,
    "snapshot" JSONB,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT,
    "entidadId" TEXT,
    "detalle" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "creadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Bodega_parqueId_idx" ON "Bodega"("parqueId");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email");

-- CreateIndex
CREATE INDEX "Usuario_parqueId_idx" ON "Usuario"("parqueId");

-- CreateIndex
CREATE INDEX "Usuario_bodegaId_idx" ON "Usuario"("bodegaId");

-- CreateIndex
CREATE INDEX "Sesion_usuarioId_idx" ON "Sesion"("usuarioId");

-- CreateIndex
CREATE INDEX "Persona_bodegaId_idx" ON "Persona"("bodegaId");

-- CreateIndex
CREATE INDEX "Vehiculo_personaId_idx" ON "Vehiculo"("personaId");

-- CreateIndex
CREATE INDEX "Vehiculo_placas_idx" ON "Vehiculo"("placas");

-- CreateIndex
CREATE UNIQUE INDEX "Credencial_codigo_key" ON "Credencial"("codigo");

-- CreateIndex
CREATE INDEX "Credencial_personaId_idx" ON "Credencial"("personaId");

-- CreateIndex
CREATE INDEX "Credencial_estado_idx" ON "Credencial"("estado");

-- CreateIndex
CREATE INDEX "Credencial_estadoPresencia_idx" ON "Credencial"("estadoPresencia");

-- CreateIndex
CREATE INDEX "PuntoAcceso_parqueId_idx" ON "PuntoAcceso"("parqueId");

-- CreateIndex
CREATE INDEX "Dispositivo_puntoAccesoId_idx" ON "Dispositivo"("puntoAccesoId");

-- CreateIndex
CREATE INDEX "Movimiento_credencialId_idx" ON "Movimiento"("credencialId");

-- CreateIndex
CREATE INDEX "Movimiento_puntoAccesoId_idx" ON "Movimiento"("puntoAccesoId");

-- CreateIndex
CREATE INDEX "Movimiento_resultado_idx" ON "Movimiento"("resultado");

-- CreateIndex
CREATE INDEX "Movimiento_creadoEn_idx" ON "Movimiento"("creadoEn");

-- CreateIndex
CREATE INDEX "AuditLog_usuarioId_idx" ON "AuditLog"("usuarioId");

-- CreateIndex
CREATE INDEX "AuditLog_creadoEn_idx" ON "AuditLog"("creadoEn");

-- AddForeignKey
ALTER TABLE "Bodega" ADD CONSTRAINT "Bodega_parqueId_fkey" FOREIGN KEY ("parqueId") REFERENCES "Parque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_parqueId_fkey" FOREIGN KEY ("parqueId") REFERENCES "Parque"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_bodegaId_fkey" FOREIGN KEY ("bodegaId") REFERENCES "Bodega"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sesion" ADD CONSTRAINT "Sesion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Persona" ADD CONSTRAINT "Persona_bodegaId_fkey" FOREIGN KEY ("bodegaId") REFERENCES "Bodega"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehiculo" ADD CONSTRAINT "Vehiculo_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credencial" ADD CONSTRAINT "Credencial_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "Persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credencial" ADD CONSTRAINT "Credencial_vehiculoId_fkey" FOREIGN KEY ("vehiculoId") REFERENCES "Vehiculo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credencial" ADD CONSTRAINT "Credencial_emisorId_fkey" FOREIGN KEY ("emisorId") REFERENCES "Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PuntoAcceso" ADD CONSTRAINT "PuntoAcceso_parqueId_fkey" FOREIGN KEY ("parqueId") REFERENCES "Parque"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispositivo" ADD CONSTRAINT "Dispositivo_puntoAccesoId_fkey" FOREIGN KEY ("puntoAccesoId") REFERENCES "PuntoAcceso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_puntoAccesoId_fkey" FOREIGN KEY ("puntoAccesoId") REFERENCES "PuntoAcceso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_dispositivoId_fkey" FOREIGN KEY ("dispositivoId") REFERENCES "Dispositivo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_credencialId_fkey" FOREIGN KEY ("credencialId") REFERENCES "Credencial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Movimiento" ADD CONSTRAINT "Movimiento_operadorId_fkey" FOREIGN KEY ("operadorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

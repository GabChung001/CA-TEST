-- AlterTable
ALTER TABLE "Movimiento" ADD COLUMN     "sincronizado" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Movimiento_sincronizado_idx" ON "Movimiento"("sincronizado");

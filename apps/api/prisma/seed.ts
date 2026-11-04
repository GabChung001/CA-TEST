import 'dotenv/config';
import { PrismaClient, Rol } from '@prisma/client';
import { hash as argonHash } from '@node-rs/argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const email = (process.env.SEED_ADMIN_EMAIL ?? 'felipe@thinktech.mx').toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'CambiaEsta#2026';

  const passwordHash = await argonHash(password);

  const admin = await prisma.usuario.upsert({
    where: { email },
    update: {},
    create: {
      email,
      passwordHash,
      nombre: 'Super Admin',
      rol: Rol.SUPER_ADMIN,
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Super admin listo: ${admin.email}`);
  if (!process.env.SEED_ADMIN_PASSWORD) {
    // eslint-disable-next-line no-console
    console.log(
      `Password inicial (SÓLO DEV — cámbiala al primer ingreso): ${password}`,
    );
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Wave Burger LTDA',
    },
  });

  await prisma.businessUnit.upsert({
    where: {
      organizationId_name: {
        organizationId: organization.id,
        name: 'Unidade Principal',
      },
    },
    update: {},
    create: {
      organizationId: organization.id,
      name: 'Unidade Principal',
    },
  });

  // eslint-disable-next-line no-console
  console.log('Seed concluído: Organization + BusinessUnit padrão criadas.');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

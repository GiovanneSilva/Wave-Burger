import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000001';

const PERMISSIONS = [
  { key: 'users:manage', description: 'Criar, editar e inativar usuários' },
  { key: 'roles:manage', description: 'Gerenciar perfis e permissões' },
  { key: 'ingredients:read', description: 'Consultar ingredientes' },
  { key: 'ingredients:manage', description: 'Criar, editar, ativar e inativar ingredientes' },
  { key: 'products:read', description: 'Consultar produtos' },
  { key: 'products:manage', description: 'Criar, editar, ativar e inativar produtos' },
  { key: 'ficha_tecnica:read', description: 'Consultar fichas técnicas' },
  { key: 'ficha_tecnica:manage', description: 'Criar novas versões de ficha técnica' },
  { key: 'suppliers:read', description: 'Consultar fornecedores' },
  { key: 'suppliers:manage', description: 'Criar, editar, ativar e inativar fornecedores' },
  { key: 'purchases:read', description: 'Consultar compras' },
  { key: 'purchases:manage', description: 'Registrar, confirmar e cancelar compras' },
];

/// Perfis iniciais do roteiro (Etapa 6). Mapeamento de permissões por perfil
/// é mínimo nesta etapa — módulos de negócio ainda não existem, então só o
/// perfil ADMIN recebe as permissões fundacionais já implementadas.
const ROLES = [
  { name: 'ADMIN', description: 'Acesso completo ao sistema (RF-029)', permissions: PERMISSIONS.map((p) => p.key) },
  { name: 'STOCK_OPERATOR', description: 'Operador de estoque (RF-030)', permissions: [] as string[] },
  { name: 'FINANCE', description: 'Perfil financeiro (RF-031)', permissions: [] as string[] },
  { name: 'VIEW_ONLY', description: 'Consulta / somente leitura', permissions: [] as string[] },
];

async function main() {
  const organization = await prisma.organization.upsert({
    where: { id: DEFAULT_ORG_ID },
    update: {},
    create: {
      id: DEFAULT_ORG_ID,
      name: 'Wave Burger LTDA',
    },
  });

  const businessUnit = await prisma.businessUnit.upsert({
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

  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const roleDef of ROLES) {
    const role = await prisma.role.upsert({
      where: { name: roleDef.name },
      update: { description: roleDef.description },
      create: { name: roleDef.name, description: roleDef.description },
    });

    for (const permissionKey of roleDef.permissions) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { key: permissionKey },
      });
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } },
        update: {},
        create: { roleId: role.id, permissionId: permission.id },
      });
    }
  }

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'ADMIN' } });
  const adminPasswordHash = await bcrypt.hash('WaveBurger#2026', 10);

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@waveburger.dev' },
    update: {},
    create: {
      organizationId: organization.id,
      businessUnitId: businessUnit.id,
      name: 'Administrador Wave Burger',
      email: 'admin@waveburger.dev',
      passwordHash: adminPasswordHash,
    },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: adminUser.id, roleId: adminRole.id } },
    update: {},
    create: { userId: adminUser.id, roleId: adminRole.id },
  });

  // eslint-disable-next-line no-console
  console.log('Seed concluído: Organization, BusinessUnit, perfis, permissões e usuário admin de dev.');
  // eslint-disable-next-line no-console
  console.log('Login de dev: admin@waveburger.dev / WaveBurger#2026 (TROCAR antes de qualquer uso real)');
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

import bcrypt from "bcrypt";
import prisma from "../src/services/prisma";

async function main() {
  const companySlug = "qi-support-ai";
  const companyName = "QI Support AI";
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@qi.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "Admin@123";

  let company = await prisma.company.findUnique({ where: { slug: companySlug } });
  if (!company) {
    company = await prisma.company.create({
      data: {
        name: companyName,
        slug: companySlug,
        aiEnabled: false,
      },
    });
  }

  const adminUser = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!adminUser) {
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await prisma.user.create({
      data: {
        companyId: company.id,
        name: "Administrador QI",
        email: adminEmail,
        password: hashedPassword,
        role: "ADMIN",
        whatsappAccess: true,
      },
    });
  }

  const categories = [
    "Fiscal",
    "NF-e",
    "NFC-e",
    "MDF-e",
    "Financeiro",
    "Estoque",
    "Produção",
    "Cadastro",
    "Certificado Digital",
    "Impressoras",
    "Integrações",
    "Relatórios",
    "Sintegra",
    "Tributação",
    "SEFAZ",
  ];

  for (const name of categories) {
    await prisma.category.upsert({
      where: { companyId_name: { companyId: company.id, name } },
      create: { companyId: company.id, name },
      update: {},
    });
  }

  console.log("Seed finalizado com empresa e administrador padrão.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

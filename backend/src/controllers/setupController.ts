import { RequestHandler } from "express";
import { setupCompany } from "../storage/fileStore";

export const initialSetup: RequestHandler = async (req, res) => {
  const { companyName, slug, adminName, adminEmail, adminPassword, adminLogin } = req.body;
  const login = adminLogin || adminEmail;

  if (!companyName || !slug || !adminName || !login || !adminPassword) {
    return res.status(400).json({ error: "Dados obrigatorios ausentes" });
  }

  try {
    const { company, admin } = await setupCompany({
      companyName,
      slug,
      adminName,
      adminEmail: login,
      adminPassword,
    });
    res.json({
      company: { id: company.id, name: company.name, slug: company.slug },
      admin: { id: admin.id, name: admin.name, email: admin.email },
      message: "Configuracao concluida.",
    });
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : "Erro no setup" });
  }
};

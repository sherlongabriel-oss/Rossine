import { exec } from "child_process";
import { loadSecrets } from "./config/loadSecrets";
import { getLocalIPv4 } from "./config/network";
import { initializeStore, getCompany } from "./storage/fileStore";
import { ensureOpenAiKeyOnCompany } from "./services/openai";
import { ensureWhatsappOnBoot } from "./services/whatsappService";
import app from "./app";

loadSecrets();

const port = Number(process.env.PORT) || 4000;
const host = process.env.HOST || "0.0.0.0";

async function start() {
  await initializeStore();
  ensureOpenAiKeyOnCompany();

  const company = getCompany();
  if (company) {
    console.log(`Iniciando WhatsApp para empresa: ${company.name}`);
    void ensureWhatsappOnBoot(company.id);
  }

  app.listen(port, host, () => {
    const ips = getLocalIPv4();
    console.log("========================================");
    console.log("  QI Support AI - pronto para uso");
    console.log("  Painel:   http://localhost:" + port);
    ips.forEach((ip) => console.log("  Rede:     http://" + ip + ":" + port));
    console.log("  Login:    admin  |  Senha: admin");
    console.log("  WhatsApp: QR na barra superior (admin)");
    console.log("========================================");

    if (process.env.OPEN_BROWSER === "true") {
      exec("start \"\" \"http://localhost:" + port + "\"");
    }
  });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});

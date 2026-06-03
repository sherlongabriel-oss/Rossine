import fs from "fs";
import path from "path";
import pngToIco from "png-to-ico";

const root = path.resolve(process.cwd());
const src = path.join(root, "LOGO", "logo-big.png");
const out = path.join(root, "LOGO", "logo.ico");

if (!fs.existsSync(src)) {
  console.error("PNG de origem nao encontrado:", src);
  process.exit(1);
}

const buffer = await pngToIco(src);
fs.writeFileSync(out, buffer);

console.log("Icone gerado:", out);

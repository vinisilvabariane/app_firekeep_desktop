import { access, copyFile, mkdir, readdir } from "node:fs/promises";
import path from "node:path";

// Dados de fabrica: na primeira execucao do app instalado, os catalogos que
// vem no pacote (pasta seed/ — musicas, fundos e preferencias) sao copiados
// para a pasta de dados do usuario. Cada arquivo so e copiado se ainda nao
// existir — dados de quem ja usa o app nunca sao sobrescritos.
export async function seedInitialData({ root, storageRoot }) {
  const seedDir = path.join(root, "seed");
  const seedFiles = await readdir(seedDir).catch(() => []);
  if (!seedFiles.length) return;

  const logsDir = path.join(storageRoot, "logs");
  await mkdir(logsDir, { recursive: true });

  for (const file of seedFiles) {
    const target = path.join(logsDir, file);
    const alreadyExists = await access(target).then(() => true, () => false);
    if (alreadyExists) continue;
    await copyFile(path.join(seedDir, file), target).catch((error) => {
      console.error(`[firekeep] falha ao semear ${file}:`, error);
    });
  }
}

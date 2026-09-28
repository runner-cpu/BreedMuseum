import { createServer } from 'vite';
import { resolve } from 'node:path';
export async function withBreedData(callback) {
  const server = await createServer({ configFile: false, envDir: false, server: { middlewareMode: true }, appType: 'custom', resolve: { alias: { '@': resolve('src') } } });
  try {
    const { breeds } = await server.ssrLoadModule('/src/data/breeds.ts');
    const { getBreedMetadata } = await server.ssrLoadModule('/src/data/breedMetadata.ts');
    const { NATIONAL_PROTECTED_BREED_NAMES } = await server.ssrLoadModule('/src/data/nationalProtectionList.ts');
    const { auditBreedDataset } = await server.ssrLoadModule('/src/data/breedAudit.ts');
    return await callback({ breeds, getBreedMetadata, protectedNames: NATIONAL_PROTECTED_BREED_NAMES, auditBreedDataset });
  } finally { await server.close(); }
}

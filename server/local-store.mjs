import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
export function fileStore(directory) {
  let queue = Promise.resolve();
  const locked = (fn) => {
      const p = queue.then(fn);
      queue = p.catch(() => {});
      return p;
    },
    file = (k) =>
      path.join(directory, createHash('sha256').update(k).digest('hex')),
    read = async (k) => {
      try {
        return JSON.parse(await readFile(file(k), 'utf8'));
      } catch (e) {
        if (e.code === 'ENOENT') return null;
        throw e;
      }
    };
  return {
    read,
    write: (k, data, etag) =>
      locked(async () => {
        await mkdir(directory, { recursive: true });
        const old = await read(k);
        if (etag ? old?.etag !== etag : old !== null) return false;
        const tmp = file(k) + '.' + randomUUID();
        await writeFile(tmp, JSON.stringify({ etag: randomUUID(), data }));
        await rename(tmp, file(k));
        return true;
      }),
    putBytes: async (k, b) => {
      await mkdir(directory, { recursive: true });
      const tmp = file(k) + '.' + randomUUID();
      await writeFile(tmp, Buffer.from(b));
      await rename(tmp, file(k));
    },
    bytes: async (k) => {
      try {
        return await readFile(file(k));
      } catch (e) {
        if (e.code === 'ENOENT') return null;
        throw e;
      }
    },
    remove: async (k) => {
      await unlink(file(k)).catch((e) => {
        if (e.code !== 'ENOENT') throw e;
      });
    },
  };
}

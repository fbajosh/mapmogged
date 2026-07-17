import { cp, mkdir, readdir, rm, unlink } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const dist = new URL("../dist/", import.meta.url);
const deployEntries = ["index.html", "styles.css", "src", "public", "gadm", "THIRD_PARTY_NOTICES.md"];

await rm(dist, { force: true, recursive: true });
await mkdir(dist, { recursive: true });

for (const entry of deployEntries) {
  await cp(new URL(entry, root), new URL(entry, dist), { recursive: true });
}

await removeIgnoredFiles(dist);

async function removeIgnoredFiles(directoryUrl) {
  const entries = await readdir(directoryUrl, { withFileTypes: true });

  for (const entry of entries) {
    const entryUrl = new URL(entry.name, directoryUrl);

    if (entry.name === ".DS_Store") {
      await unlink(entryUrl);
      continue;
    }

    if (entry.isDirectory()) {
      await removeIgnoredFiles(new URL(`${entry.name}/`, directoryUrl));
    }
  }
}

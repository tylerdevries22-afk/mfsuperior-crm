import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const outputDirectory = process.argv[2] ?? "dist-demo-verify";
const outputRoot = resolve(projectRoot, outputDirectory);
const failures = [];

const assert = (condition, message) => {
  if (!condition) failures.push(message);
};

const metadataPath = resolve(outputRoot, "metadata.json");
assert(existsSync(metadataPath), `Expo export metadata is missing: ${outputDirectory}`);

if (failures.length === 0) {
  const metadata = JSON.parse(readFileSync(metadataPath, "utf8"));
  for (const platform of ["ios", "android"]) {
    const platformMetadata = metadata.fileMetadata?.[platform];
    const bundlePath = resolve(outputRoot, platformMetadata?.bundle ?? "");
    assert(Boolean(platformMetadata?.bundle), `The ${platform} bundle is missing from Expo export metadata.`);
    const bundleExists = existsSync(bundlePath) && statSync(bundlePath).isFile() && statSync(bundlePath).size > 0;
    assert(bundleExists, `The generated ${platform} bundle is missing or empty.`);
    if (bundleExists) {
      const bundle = readFileSync(bundlePath);
      for (const marker of ["Quick demo login", "Autofill"]) {
        assert(bundle.includes(Buffer.from(marker)), `Generated ${platform} bundle is missing: ${marker}`);
      }
    }
    const exportedAssets = new Set((platformMetadata?.assets ?? []).map(({ path }) => path));
    for (const asset of ["apple-cash", "cash-app", "venmo", "zelle"]) {
      const sourcePath = resolve(projectRoot, `assets/payouts/${asset}.png`);
      const hash = createHash("md5").update(readFileSync(sourcePath)).digest("hex");
      const exportedPath = resolve(outputRoot, "assets", hash);
      assert(exportedAssets.has(`assets/${hash}`), `${platform} metadata is missing payout asset: ${asset}`);
      assert(existsSync(exportedPath) && statSync(exportedPath).size > 0, `Missing payout asset: ${asset}`);
    }
  }
  assert(existsSync(resolve(outputRoot, "index.html")), "The browser entry page is missing.");

}

if (failures.length > 0) {
  process.stderr.write(`Demo bundle verification failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Demo bundle verification passed: ${outputDirectory}.\n`);
}

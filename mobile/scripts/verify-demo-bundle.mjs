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
  const iosMetadata = metadata.fileMetadata?.ios;
  const bundlePath = resolve(outputRoot, iosMetadata?.bundle ?? "");

  assert(Boolean(iosMetadata?.bundle), "The iOS bundle is missing from Expo export metadata.");
  assert(existsSync(bundlePath) && statSync(bundlePath).size > 0, "The generated iOS bundle is missing or empty.");

  if (existsSync(bundlePath)) {
    const bundle = readFileSync(bundlePath);
    for (const marker of ["Quick demo login", "Autofill"]) {
      assert(bundle.includes(Buffer.from(marker)), `Generated iOS bundle is missing: ${marker}`);
    }
  }

  const exportedAssets = new Set((iosMetadata?.assets ?? []).map(({ path }) => path));
  for (const asset of [
    "assets/payouts/apple-cash.png",
    "assets/payouts/cash-app.png",
    "assets/payouts/venmo.png",
    "assets/payouts/zelle.png",
  ]) {
    const sourcePath = resolve(projectRoot, asset);
    const hash = createHash("md5").update(readFileSync(sourcePath)).digest("hex");
    const exportedPath = resolve(outputRoot, "assets", hash);
    assert(exportedAssets.has(`assets/${hash}`), `Expo export metadata is missing payout asset: ${asset}`);
    assert(existsSync(exportedPath) && statSync(exportedPath).size > 0, `Expo export is missing payout asset: ${asset}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`Demo bundle verification failed:\n${failures.map((failure) => `- ${failure}`).join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Demo bundle verification passed: ${outputDirectory}.\n`);
}

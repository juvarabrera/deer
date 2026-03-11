#!/usr/bin/env node

import { writeFile, chmod, mkdir } from "fs/promises";
import { join, dirname } from "path";
import { homedir, platform, arch } from "os";
import { createRequire } from "module";
import { fileURLToPath } from "url";
import { execFileSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const pkg = require("../package.json");

const REPO = "zdavison/deer";
const VERSION = pkg.version;
const SRT_PACKAGE = "@anthropic-ai/sandbox-runtime";
const SRT_VERSION = pkg.dependencies[SRT_PACKAGE] ?? "latest";

const PLATFORM_MAP = {
  linux: "linux",
  darwin: "darwin",
};

const ARCH_MAP = {
  x64: "x64",
  arm64: "arm64",
};

async function install() {
  const os = PLATFORM_MAP[platform()];
  const cpuArch = ARCH_MAP[arch()];

  if (!os) {
    throw new Error(
      `Unsupported platform: ${platform()}. Supported: linux, darwin.`
    );
  }
  if (!cpuArch) {
    throw new Error(
      `Unsupported architecture: ${arch()}. Supported: x64, arm64.`
    );
  }

  const binaryName = `deer-${os}-${cpuArch}`;
  const url = `https://github.com/${REPO}/releases/download/v${VERSION}/${binaryName}`;
  const installDir = join(homedir(), ".local", "bin");
  const installPath = join(installDir, "deer");

  console.log(`Downloading deer v${VERSION} for ${os}/${cpuArch}...`);
  console.log(`From: ${url}`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `Download failed: ${response.status} ${response.statusText}\nURL: ${url}`
    );
  }

  await mkdir(installDir, { recursive: true });

  const buffer = await response.arrayBuffer();
  await writeFile(installPath, Buffer.from(buffer));
  await chmod(installPath, 0o755);

  console.log(`\nInstalled to: ${installPath}`);

  // Install sandbox runtime to deer's data directory
  const deerDataDir = join(homedir(), ".local", "share", "deer");
  await mkdir(deerDataDir, { recursive: true });
  console.log(`\nInstalling ${SRT_PACKAGE}@${SRT_VERSION}...`);
  try {
    execFileSync("npm", ["install", "--prefix", deerDataDir, `${SRT_PACKAGE}@${SRT_VERSION}`], {
      stdio: "inherit",
    });
    console.log(`Installed ${SRT_PACKAGE} to: ${deerDataDir}`);
  } catch {
    console.error(
      `\nWarning: Failed to install ${SRT_PACKAGE}. You can install it manually:\n` +
      `  npm install --prefix ${deerDataDir} ${SRT_PACKAGE}`
    );
  }

  // Warn if installDir is not in PATH
  const pathDirs = (process.env.PATH ?? "").split(":");
  if (!pathDirs.includes(installDir)) {
    console.log(
      `\nNote: ${installDir} is not in your PATH. Add this to your shell profile:`
    );
    console.log(`  export PATH="$HOME/.local/bin:$PATH"`);
  }
}

install().catch((err) => {
  console.error(`Error: ${err.message}`);
  process.exit(1);
});

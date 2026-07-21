import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LAUNCH_AGENT_LABEL = 'br.adv.villareal.local-helper';

export function helperRootDir() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

export function launchAgentPlistPath() {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${LAUNCH_AGENT_LABEL}.plist`);
}

export function logDirPath() {
  return path.join(os.homedir(), 'Library', 'Logs', 'VillaReal');
}

export function buildLaunchAgentPlist({
  nodePath,
  serverPath,
  workingDirectory,
  stdoutPath,
  stderrPath,
  environment = {},
}) {
  const envEntries = Object.entries(environment).filter(([, value]) => value != null && String(value).trim() !== '');
  const envXml =
    envEntries.length === 0
      ? ''
      : `
    <key>EnvironmentVariables</key>
    <dict>${envEntries
      .map(
        ([key, value]) => `
      <key>${escapeXml(key)}</key>
      <string>${escapeXml(String(value))}</string>`,
      )
      .join('')}
    </dict>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
  <dict>
    <key>Label</key>
    <string>${escapeXml(LAUNCH_AGENT_LABEL)}</string>
    <key>ProgramArguments</key>
    <array>
      <string>${escapeXml(nodePath)}</string>
      <string>${escapeXml(serverPath)}</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${escapeXml(workingDirectory)}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>${escapeXml(stdoutPath)}</string>
    <key>StandardErrorPath</key>
    <string>${escapeXml(stderrPath)}</string>${envXml}
  </dict>
</plist>
`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function launchAgentGuiTarget() {
  return `gui/${process.getuid?.() ?? os.userInfo().uid}`;
}

export function plistExists() {
  return fs.existsSync(launchAgentPlistPath());
}

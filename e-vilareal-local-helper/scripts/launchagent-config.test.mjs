import assert from 'node:assert/strict';
import test from 'node:test';
import { buildLaunchAgentPlist, LAUNCH_AGENT_LABEL } from './launchagent-config.mjs';

test('buildLaunchAgentPlist inclui label e caminhos', () => {
  const xml = buildLaunchAgentPlist({
    nodePath: '/usr/local/bin/node',
    serverPath: '/repo/e-vilareal-local-helper/server.mjs',
    workingDirectory: '/repo/e-vilareal-local-helper',
    stdoutPath: '/tmp/out.log',
    stderrPath: '/tmp/err.log',
    environment: { VILAREAL_LOCAL_HELPER_PORT: '9876' },
  });
  assert.match(xml, new RegExp(`<string>${LAUNCH_AGENT_LABEL}</string>`));
  assert.match(xml, /<string>\/usr\/local\/bin\/node<\/string>/);
  assert.match(xml, /<key>VILAREAL_LOCAL_HELPER_PORT<\/key>/);
});

test('buildLaunchAgentPlist escapa caracteres XML', () => {
  const xml = buildLaunchAgentPlist({
    nodePath: '/bin/node',
    serverPath: '/tmp/a&b/server.mjs',
    workingDirectory: '/tmp',
    stdoutPath: '/tmp/out.log',
    stderrPath: '/tmp/err.log',
  });
  assert.match(xml, /a&amp;b/);
});

import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));
const platform = { darwin: 'darwin', linux: 'linux', win32: 'windows' }[process.platform];
const arch = { x64: 'amd64', arm64: 'arm64' }[process.arch];
const executable = resolve(root, 'bin', `vcs-hook_${platform}_${arch}${process.platform === 'win32' ? '.exe' : ''}`);

function keywordContext(prompt) {
  if (!platform || !arch) throw new Error('VCS: unsupported OpenCode platform');
  const output = execFileSync(executable, { input: JSON.stringify({ prompt }), encoding: 'utf8', timeout: 5000, maxBuffer: 65536 });
  if (!output.trim()) return '';
  const context = JSON.parse(output).hookSpecificOutput.additionalContext;
  return `${context}\nRead VCS skill at ${resolve(root, 'skills/vcs/SKILL.md')}. Bundled CLI: ${resolve(root, 'scripts/vcs')}.`;
}

export default async function VCSPlugin({ client } = {}) {
  const contexts = new Map();
  return {
    'chat.message': async (input, output) => {
      const text = output.parts.filter(part => part.type === 'text' && !part.synthetic).map(part => part.text).join('\n');
      const context = keywordContext(text);
      if (context) {
        contexts.set(input.sessionID, context);
        if (client) await client.app.log({ body: { service: "vcs", level: "debug", message: "VCS keyword hook activated" } });
      }
      else contexts.delete(input.sessionID);
    },
    'experimental.chat.system.transform': async (input, output) => {
      const context = contexts.get(input.sessionID);
      if (context && !output.system.includes(context)) {
        output.system.push(context);
        if (client) await client.app.log({ body: { service: "vcs", level: "debug", message: "VCS system context supplied" } });
      }
    },
    event: async ({ event }) => {
      if (event.type === 'session.deleted') contexts.delete(event.properties.info.id);
    },
  };
}

import fs from 'fs';

// Where this server is running, so the sign-in screens can say where its log is. Not sensitive:
// it names a kind of host, never an address or a version. FLYBUDGET_HOST_KIND is set by the
// Home Assistant launcher (homeassistant/ha-launch.cjs); the Supervisor token is the fallback.
export type HostKind = 'home-assistant' | 'docker' | 'other';

export function hostKind(
  env: NodeJS.ProcessEnv = process.env,
  inContainer: () => boolean = () => fs.existsSync('/.dockerenv'),
): HostKind {
  if (env.FLYBUDGET_HOST_KIND === 'home-assistant' || env.SUPERVISOR_TOKEN) return 'home-assistant';
  if (env.FLYBUDGET_HOST_KIND === 'docker') return 'docker';
  if (env.FLYBUDGET_HOST_KIND === 'other') return 'other';
  return inContainer() ? 'docker' : 'other';
}

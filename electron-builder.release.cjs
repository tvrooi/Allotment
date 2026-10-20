const config = structuredClone(require('./electron-builder.json'));

// CI validates ad-hoc packages on PRs. Configured Mac signing must complete signing and notarization.
if (process.env.FLYBUDGET_MAC_SIGNING === 'true') {
  for (const name of [
    'CSC_LINK',
    'CSC_KEY_PASSWORD',
    'APPLE_ID',
    'APPLE_APP_SPECIFIC_PASSWORD',
    'APPLE_TEAM_ID',
  ]) {
    if (!process.env[name])
      throw new Error(`Mac signing requires the ${name} GitHub Actions secret.`);
  }
  delete config.mac.identity;
  config.mac.hardenedRuntime = true;
  config.mac.notarize = true;
  config.forceCodeSigning = true;
} else {
  // electron-builder treats even an empty CSC_LINK as a certificate path.
  // GitHub supplies empty values when signing is not configured.
  delete process.env.CSC_LINK;
  delete process.env.CSC_KEY_PASSWORD;
}
module.exports = config;

const secretClient = new SecretManagerServiceClient();
const dashboardId = callDash; // replace with your dashboard identifier
const secretName = `projects/${process.env.GCLOUD_PROJECT}/secrets/token-${dashboardId}-netSuite/versions/latest`;

try {
  const [version] = await secretClient.accessSecretVersion({ name: secretName });
  const payload = JSON.parse(version.payload.data.toString('utf8'));
  context.refreshToken = payload.refreshToken;
  console.log('✅ Retrieved refresh token from secret manager');
} catch (err) {
  console.error('❌ Failed to retrieve refresh token:', err);
  context.error = 'Could not retrieve refresh token';
}
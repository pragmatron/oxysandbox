const axios = require('axios');
const qs = require('qs');
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');

const clientId = '6d120896d0bcf67cd2f3c268dc8e210f63b1e92e292a687b272cfbab3d8be9a4';
const clientSecret = '8fa079b87ab0794801542e477c065020283279a457fc106cacd5ddc5529f0a7e';
const dashboardId = callDash;
const refreshToken = context.refreshToken;

const payload = qs.stringify({
  grant_type: 'refresh_token',
  refresh_token: refreshToken,
  client_id: clientId,
});

const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
const headers = {
  'Content-Type': 'application/x-www-form-urlencoded',
  'Authorization': `Basic ${basicAuth}`,
};

try {
  const res = await axios.post(
    'https://3968308.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token',
    payload,
    { headers }
  );

  const newAccessToken = res.data.access_token;
  const newRefreshToken = res.data.refresh_token;

  context.accessToken = newAccessToken;
  context.data.tokenData = res.data;

  // Save new tokens
  if(newRefreshToken) {
    const secretClient = new SecretManagerServiceClient();
    const secretId = `token-${dashboardId}-netSuite`;
    const projectId = process.env.GCLOUD_PROJECT;
    const secretName = `projects/${projectId}/secrets/${secretId}`;

    const tokenPayload = JSON.stringify({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken ? newRefreshToken : refreshToken,
    });

    await secretClient.addSecretVersion({
      parent: secretName,
      payload: {
        data: Buffer.from(tokenPayload, 'utf8'),
      },
    });

    console.log('✅ Refreshed token and stored new secret version');
  }

} catch (err) {
  console.error('❌ Token refresh failed:', err.response?.data || err.message);
  context.error = 'Token refresh failed';
}
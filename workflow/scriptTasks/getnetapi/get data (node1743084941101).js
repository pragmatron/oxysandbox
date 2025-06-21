const crypto = require('crypto');
const { URLSearchParams } = require('url');
if(!context.payload.code) {
  // Generate a high-entropy code verifier string
  function generateCodeVerifier() {
    // Generate 32 random bytes and base64-url encode them.
    return crypto.randomBytes(32)
      .toString('base64')
      .replace(/\+/g, '-')  // Replace '+' with '-'
      .replace(/\//g, '_')  // Replace '/' with '_'
      .replace(/=+$/, '');  // Remove trailing '=' characters
  }

  const codeVerifier = generateCodeVerifier();
  console.log('Code Verifier:', codeVerifier);
  context.data.codeVerifier = codeVerifier;

  // Generate the code challenge from the code verifier using SHA-256
  function generateCodeChallenge(codeVerifier) {
    return crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  const codeChallenge = generateCodeChallenge(codeVerifier);
  console.log('Code Challenge:', codeChallenge);
  context.data.codeChallenge = codeChallenge;

  // Build the authorization URL using the parameters.
  // Note: The base URL uses the format:
  // https://<accountID>.app.netsuite.com/app/login/oauth2/authorize.nl
  function buildAuthUrl({
    accountId,
    clientId,
    redirectUri,
    scope,
    state,
    codeChallenge
  }) {
    const baseUrl = `https://${accountId}.app.netsuite.com/app/login/oauth2/authorize.nl`;
    // Build the query parameters
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: scope, // use space-separated scopes (URLSearchParams will encode the space as '+')
      state: state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });
    
    // Return the complete authorization URL
    return `${baseUrl}?${params.toString()}`;
  }

  // Example usage with values from your sample URL:
  const accountId = '3968308'; // Replace with your actual NetSuite account ID
  // const clientId = '3112129d3fbe3f63434f856b50fcf0db08c6b304a9cab79ca55f1973ff7f248e';
  const clientId = '6d120896d0bcf67cd2f3c268dc8e210f63b1e92e292a687b272cfbab3d8be9a4';
  const redirectUri = 'https://tangleconnect.com/dashboard/-OIq0nWGJhT6rySKhAl9';
  const scope = 'restlets rest_webservices';  // Using both scopes, separated by a space
  const state = crypto.randomBytes(32).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); // A random state string for CSRF protection

  const authUrl = buildAuthUrl({
    accountId,
    clientId,
    redirectUri,
    scope,
    state,
    codeChallenge
  });

  console.log('Authorization URL:', authUrl);
  context.data.url = authUrl;
} else {
    const axios = require('axios');
  const qs = require('qs');

  // Replace with your actual client secret.
  // const clientSecret = '2bce0f898e6f730ff15521b16f368641c4d6eef72baf7c9cbd5b9edfd2de0e0f';
  const clientSecret = '8fa079b87ab0794801542e477c065020283279a457fc106cacd5ddc5529f0a7e';
  // const clientId = '3112129d3fbe3f63434f856b50fcf0db08c6b304a9cab79ca55f1973ff7f248e';
  const clientId = '6d120896d0bcf67cd2f3c268dc8e210f63b1e92e292a687b272cfbab3d8be9a4';
  const redirectUri = 'https://tangleconnect.com/dashboard/-OIq0nWGJhT6rySKhAl9';
  const code = context.payload.code;
  const codeVerifier = context.payload.codeVerifier;

  // Build the token exchange payload.
  const payload = qs.stringify({
    grant_type: 'authorization_code',
    code: code,
    redirect_uri: redirectUri,
    code_verifier: codeVerifier,
    client_id: clientId
  });

  // Create a Basic auth header using clientId and clientSecret.
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

    console.log('✅ Access Token:', res.data.access_token);
    console.log('🔁 Refresh Token:', res.data.refresh_token);
    console.log('⏳ Expires In:', res.data.expires_in);
    context.data.token = res.data;

    // --- Save Tokens to Google Secret Manager ---
    const secretClient = new SecretManagerServiceClient();
    // Replace with your actual dashboard ID
    const secretId = `token-${callDash}-netSuite`;
    // You may have your project ID in an environment variable or replace it below
    const projectId = process.env.GCLOUD_PROJECT
    const secretName = `projects/${projectId}/secrets/${secretId}`;

    try {
      await secretClient.getSecret({ name: secretName });
      console.log(`Secret ${secretName} exists.`);
    } catch (error) {
      // Error code 5 indicates NOT_FOUND in Google Secret Manager.
      if (error.code === 5) {
        console.log(`Secret ${secretName} not found. Creating it.`);
        const [secret] = await secretClient.createSecret({
          parent: `projects/${projectId}`,
          secretId: secretId,
          secret: {
            replication: {
              automatic: {},
            },
          },
        });
        console.log(`Created secret: ${secret.name}`);
      } else {
        console.error('Error checking secret:', error);
        throw error;
      }
    }

    // Prepare the token payload to save (saving both access and refresh tokens)
    const tokenPayload = JSON.stringify({
      accessToken: res.data.access_token,
      refreshToken: res.data.refresh_token
    });

    const [version] = await secretClient.addSecretVersion({
      parent: secretName,
      payload: {
        data: Buffer.from(tokenPayload, 'utf8'),
      },
    });
    console.log(`Secret version added: ${version.name}`);
  } catch (err) {
    context.data.errMsg = err.message;
    context.data.err = err;
    console.error('❌ Token exchange failed:', err.response?.data || err.message);
    if (err.response) {
      console.error('Response Details:', err.response.data);
    }
  }
}
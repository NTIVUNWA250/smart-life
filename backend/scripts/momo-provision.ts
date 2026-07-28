/**
 * Provisions an MTN MoMo **sandbox** API user + API key.
 *
 *   1. Sign up at https://momodeveloper.mtn.com and subscribe to the *Collections*
 *      product. Copy the "Primary Key" — that is your Ocp-Apim-Subscription-Key.
 *   2. Put it in backend/.env as MOMO_SUBSCRIPTION_KEY.
 *   3. npm run momo:provision
 *   4. Paste the printed MOMO_API_USER / MOMO_API_KEY into .env, set
 *      PROVIDER_MODE=live, and restart.
 *
 * The apiuser/apikey endpoints exist only on the sandbox host; in production MTN
 * issues these to you as part of onboarding. The script refuses to run against a
 * non-sandbox target so it cannot be pointed at production by accident.
 *
 * Run with: npm run momo:provision
 */
import crypto from 'node:crypto';
import { env } from '../src/lib/env.js';

const { baseUrl, subscriptionKey, targetEnvironment, callbackHost, timeoutMs } = env.momo;

function die(message: string): never {
  console.error(`\n✗ ${message}\n`);
  process.exit(1);
}

async function call(path: string, init: RequestInit): Promise<Response> {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    die(`${init.method ?? 'GET'} ${path} → ${res.status} ${res.statusText}\n  ${await res.text().catch(() => '')}`);
  }
  return res;
}

async function main(): Promise<void> {
  if (!subscriptionKey) {
    die('MOMO_SUBSCRIPTION_KEY is not set. Get it from https://momodeveloper.mtn.com (Collections → Primary Key) and add it to backend/.env');
  }
  if (targetEnvironment !== 'sandbox') {
    die(`MOMO_TARGET_ENVIRONMENT is "${targetEnvironment}". This script only provisions sandbox credentials; production API users are issued by MTN during onboarding.`);
  }

  const apiUser = crypto.randomUUID();
  const keyHeader = { 'Ocp-Apim-Subscription-Key': subscriptionKey };

  console.log(`Provisioning against ${baseUrl}`);
  console.log(`  API user id (X-Reference-Id): ${apiUser}`);

  await call('/v1_0/apiuser', {
    method: 'POST',
    headers: { ...keyHeader, 'X-Reference-Id': apiUser, 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerCallbackHost: callbackHost }),
  });
  console.log('  ✓ API user created');

  const keyRes = await call(`/v1_0/apiuser/${apiUser}/apikey`, {
    method: 'POST',
    headers: keyHeader,
  });
  const { apiKey } = (await keyRes.json()) as { apiKey: string };
  console.log('  ✓ API key issued');

  // Prove the credentials actually work before printing them.
  const basic = Buffer.from(`${apiUser}:${apiKey}`).toString('base64');
  const tokenRes = await call('/collection/token/', {
    method: 'POST',
    headers: { ...keyHeader, Authorization: `Basic ${basic}` },
  });
  const token = (await tokenRes.json()) as { access_token: string; expires_in: number };
  console.log(`  ✓ Access token obtained (expires in ${token.expires_in}s)`);

  const balanceRes = await call('/collection/v1_0/account/balance', {
    headers: {
      ...keyHeader,
      Authorization: `Bearer ${token.access_token}`,
      'X-Target-Environment': targetEnvironment,
    },
  });
  const balance = (await balanceRes.json()) as { availableBalance: string; currency: string };
  console.log(`  ✓ Collections balance: ${balance.availableBalance} ${balance.currency}`);

  console.log('\nAdd these to backend/.env:\n');
  console.log(`MOMO_API_USER=${apiUser}`);
  console.log(`MOMO_API_KEY=${apiKey}`);
  console.log('PROVIDER_MODE=live\n');
}

main().catch((err) => die(String(err)));

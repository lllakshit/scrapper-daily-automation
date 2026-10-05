#!/usr/bin/env node

/**
 * Vercel Blob Storage Configuration Script
 * Configures your Vercel project with environment variables using the Vercel API
 * 
 * Usage:
 *   node scripts/setup-vercel-blob.mjs <projectId> <teamId> <vercelToken>
 */

import https from 'https';

function makeRequest(method, path, token, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.vercel.com',
      port: 443,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(JSON.parse(data));
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function setEnvironmentVariable(projectId, key, value, token) {
  const path = `/v9/projects/${projectId}/env`;
  const body = {
    key,
    value,
    target: ['production', 'preview', 'development'],
  };

  try {
    await makeRequest('POST', path, token, body);
    console.log(`✅ Set ${key}`);
  } catch (error) {
    console.error(`❌ Failed to set ${key}:`, error.message);
    throw error;
  }
}

async function main() {
  const [projectId, blobToken, blobStoreId] = process.argv.slice(2);

  if (!projectId || !blobToken) {
    console.error('Usage: node scripts/setup-vercel-blob.mjs <projectId> <blobToken> [blobStoreId]');
    console.error('');
    console.error('Example:');
    console.error('  node scripts/setup-vercel-blob.mjs abc123 vcp_xxx store_yyy');
    process.exit(1);
  }

  const vercelToken = process.env.VERCEL_TOKEN;
  if (!vercelToken) {
    console.error('❌ VERCEL_TOKEN environment variable not set');
    console.error('Set it with: export VERCEL_TOKEN=your_token_here');
    process.exit(1);
  }

  console.log('🔧 Configuring Vercel Blob Storage...');
  console.log('');

  try {
    await setEnvironmentVariable(projectId, 'BLOB_READ_WRITE_TOKEN', blobToken, vercelToken);
    
    if (blobStoreId) {
      await setEnvironmentVariable(projectId, 'BLOB_STORE_ID', blobStoreId, vercelToken);
    }

    console.log('');
    console.log('✅ Environment variables configured successfully!');
    console.log('');
    console.log('📝 Next steps:');
    console.log('1. Redeploy your project');
    console.log('2. Test the resume upload feature');
  } catch (error) {
    console.error('');
    console.error('❌ Configuration failed:', error.message);
    process.exit(1);
  }
}

main();

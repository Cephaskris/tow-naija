import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ConvexHttpClient } from 'convex/browser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const client = new ConvexHttpClient('https://charming-donkey-521.convex.cloud');

async function main() {
  const existingStorageId = process.argv[2];
  let storageId = existingStorageId;

  if (!storageId) {
    const apkPath = path.resolve(__dirname, '../../app/android/app/build/outputs/apk/release/app-release.apk');
    if (!fs.existsSync(apkPath)) {
      throw new Error('APK not found at ' + apkPath);
    }

    const stat = fs.statSync(apkPath);
    console.log(`Reading APK (${(stat.size / 1024 / 1024).toFixed(1)} MB)...`);
    const buffer = fs.readFileSync(apkPath);

    // Copy to root Townaija.apk as well
    const rootApkPath = path.resolve(__dirname, '../../Townaija.apk');
    fs.copyFileSync(apkPath, rootApkPath);
    console.log(`Copied APK to ${rootApkPath}`);

    console.log('Generating Convex upload URL...');
    const uploadUrl = await client.mutation('files:generateUploadUrl');
    console.log('Upload URL:', uploadUrl);

    console.log('Uploading APK to Convex Cloud Storage...');
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/vnd.android.package-archive' },
      body: buffer,
    });

    if (!res.ok) {
      throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    storageId = json.storageId;
  }

  const downloadUrl = await client.query('files:getFileUrl', { storage_id: storageId });
  console.log('Uploaded successfully! Download URL:', downloadUrl);

  const newVersion = '1.3.0';
  console.log(`Updating app release in settings to v${newVersion}...`);
  await client.mutation('seed:updateAppRelease', {
    apk_url: downloadUrl,
    latest_version: newVersion,
  });

  console.log('Done! All settings updated with the new APK release.');
}

main().catch(console.error);

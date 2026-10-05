import { objectStorageClient } from './objectStorage';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_BUCKET_PATH = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(',')[0] || '';
const bucketName = PUBLIC_BUCKET_PATH.split('/')[1];

async function uploadImage(localPath: string, storagePath: string): Promise<string> {
  const bucket = objectStorageClient.bucket(bucketName);
  const file = bucket.file(`public/grant-images/${storagePath}`);
  
  const fileBuffer = readFileSync(resolve(__dirname, '..', localPath));
  
  await file.save(fileBuffer, {
    metadata: {
      contentType: getContentType(localPath),
    },
  });
  
  return `grant-images/${storagePath}`;
}

function getContentType(filePath: string): string {
  if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) return 'image/jpeg';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.gif')) return 'image/gif';
  return 'application/octet-stream';
}

async function main() {
  const imagesToUpload = [
    { 
      local: 'attached_assets/stock_images/real_estate_property_046ef1f2.jpg',
      storage: 'ownership-grant.jpg',
      grantId: 86
    },
    { 
      local: 'attached_assets/stock_images/business_marketing_g_5008c3d0.jpg',
      storage: 'grow-your-reach-grant.jpg',
      grantId: 87
    },
    { 
      local: 'attached_assets/stock_images/business_coaching_me_d3f8637e.jpg',
      storage: 'coach-k-legacy-grant.jpg',
      grantId: 88
    },
    { 
      local: 'attached_assets/stock_images/nonprofit_community__1e3d11f7.jpg',
      storage: 'nonprofit-grant.jpg',
      grantId: 89
    },
  ];

  console.log('🚀 Starting image upload to object storage...\n');

  for (const img of imagesToUpload) {
    try {
      console.log(`Uploading ${img.local}...`);
      const path = await uploadImage(img.local, img.storage);
      console.log(`✅ Uploaded to: ${path}`);
      console.log(`   Grant ID: ${img.grantId}\n`);
    } catch (error) {
      console.error(`❌ Failed to upload ${img.local}:`, error);
    }
  }

  console.log('✨ Upload complete!');
}

main().catch(console.error);

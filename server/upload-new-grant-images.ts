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
  const newImages = [
    { 
      local: 'attached_assets/stock_images/modern_business_team_ee6e74dc.jpg',
      storage: 'coach-k-legacy-v2.jpg',
      grantId: 88,
      grantName: 'Coach K Legacy Grant'
    },
    { 
      local: 'attached_assets/stock_images/professional_busines_50246fdc.jpg',
      storage: 'nonprofit-v2.jpg',
      grantId: 89,
      grantName: 'Nonprofit Grant'
    },
    { 
      local: 'attached_assets/stock_images/business_people_work_cd40f64b.jpg',
      storage: 'grow-your-reach-v2.jpg',
      grantId: 87,
      grantName: 'Grow Your Reach Grant'
    },
  ];

  console.log('📸 Uploading new grant images with updated filenames...\n');

  for (const img of newImages) {
    try {
      console.log(`Uploading ${img.grantName}...`);
      const path = await uploadImage(img.local, img.storage);
      console.log(`✅ Uploaded: ${path}`);
      console.log(`   Grant ID: ${img.grantId}\n`);
    } catch (error) {
      console.error(`❌ Failed to upload ${img.local}:`, error);
    }
  }

  console.log('✨ Upload complete!');
}

main().catch(console.error);

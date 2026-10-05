import { objectStorageClient } from './objectStorage';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_BUCKET_PATH = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(',')[0] || '';
const bucketName = PUBLIC_BUCKET_PATH.split('/')[1];

async function uploadAIImpactImage() {
  console.log('📸 Uploading AI Impact Grant image...\n');

  const localPath = 'attached_assets/stock_images/artificial_intellige_07405d2e.jpg';
  const storagePath = 'ai-impact-grant.jpg';

  try {
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(`public/grant-images/${storagePath}`);
    
    const fileBuffer = readFileSync(resolve(__dirname, '..', localPath));
    
    await file.save(fileBuffer, {
      metadata: {
        contentType: 'image/jpeg',
      },
    });

    console.log(`✅ Uploaded: grant-images/${storagePath}`);
    console.log('   Grant ID: 90 (AI Impact Grant)\n');
  } catch (error) {
    console.error(`❌ Failed to upload:`, error);
  }

  console.log('✨ Upload complete!');
}

uploadAIImpactImage().catch(console.error);

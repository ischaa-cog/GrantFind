import { objectStorageClient } from './objectStorage';

const PUBLIC_BUCKET_PATH = process.env.PUBLIC_OBJECT_SEARCH_PATHS?.split(',')[0] || '';
const bucketName = PUBLIC_BUCKET_PATH.split('/')[1];

async function listFiles() {
  const bucket = objectStorageClient.bucket(bucketName);
  
  console.log(`\n📦 Checking bucket: ${bucketName}\n`);
  
  const filesToCheck = [
    'public/grant-images/ownership-grant.jpg',
    'public/grant-images/grow-your-reach-grant.jpg',
    'public/grant-images/coach-k-legacy-grant.jpg',
    'public/grant-images/nonprofit-grant.jpg',
  ];

  for (const filePath of filesToCheck) {
    const file = bucket.file(filePath);
    const [exists] = await file.exists();
    console.log(`${exists ? '✅' : '❌'} ${filePath}`);
  }
}

listFiles().catch(console.error);

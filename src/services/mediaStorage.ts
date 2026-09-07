import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { storage } from '../config/firebase';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

type ServiceImageKind = 'issue' | 'completion' | 'chat' | 'voucher';

export async function uploadServiceImage(
  requestId: string,
  uploaderId: string,
  base64: string,
  kind: ServiceImageKind,
  fileId = Date.now().toString()
) {
  // Spark demonstration: small images fit inside the service document.
  // Never silently discard evidence when a Storage bucket is unavailable.
  if (process.env.EXPO_PUBLIC_MEDIA_MODE === 'firestore-demo') {
    for (const width of [960, 720, 480]) {
      const result = await manipulateAsync(`data:image/jpeg;base64,${base64}`, [{ resize: { width } }], { compress: 0.45, format: SaveFormat.JPEG, base64: true });
      if (result.base64 && result.base64.length <= 300000) return `data:image/jpeg;base64,${result.base64}`;
    }
    throw new Error('La foto supera el tamaño permitido. Toma otra foto con menor detalle.');
  }
  const storageRef = ref(storage, `service_requests/${requestId}/${uploaderId}/${kind}/${fileId}.jpg`);
  await uploadString(storageRef, `data:image/jpeg;base64,${base64}`, 'data_url', {
    contentType: 'image/jpeg',
  });
  return getDownloadURL(storageRef);
}

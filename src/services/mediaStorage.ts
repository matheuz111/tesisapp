import { getDownloadURL, ref, uploadString } from 'firebase/storage';
import { storage } from '../config/firebase';

type ServiceImageKind = 'issue' | 'completion' | 'chat';

export async function uploadServiceImage(
  requestId: string,
  uploaderId: string,
  base64: string,
  kind: ServiceImageKind,
  fileId = Date.now().toString()
) {
  const storageRef = ref(storage, `service_requests/${requestId}/${uploaderId}/${kind}/${fileId}.jpg`);
  await uploadString(storageRef, `data:image/jpeg;base64,${base64}`, 'data_url', {
    contentType: 'image/jpeg',
  });
  return getDownloadURL(storageRef);
}

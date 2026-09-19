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
): Promise<string> {
  let normalizedBase64 = base64;
  let normalizedDataUrl = `data:image/jpeg;base64,${base64}`;

  // 1. Pre-comprimir la imagen a tamaño estándar móvil (máximo 1024px) para optimizar tiempo de subida y ancho de banda
  try {
    const resized = await manipulateAsync(
      normalizedDataUrl,
      [{ resize: { width: 1024 } }],
      { compress: 0.7, format: SaveFormat.JPEG, base64: true }
    );
    if (resized.base64) {
      normalizedBase64 = resized.base64;
      normalizedDataUrl = `data:image/jpeg;base64,${resized.base64}`;
    }
  } catch (resizeError) {
    console.warn('Pre-optimización de imagen no disponible:', resizeError);
  }

  // 2. Si no estamos en modo explícito firestore-demo, intentar subir a Firebase Storage
  if (process.env.EXPO_PUBLIC_MEDIA_MODE !== 'firestore-demo') {
    try {
      const storageRef = ref(storage, `service_requests/${requestId}/${uploaderId}/${kind}/${fileId}.jpg`);
      await uploadString(storageRef, normalizedDataUrl, 'data_url', {
        contentType: 'image/jpeg',
      });
      const downloadUrl = await getDownloadURL(storageRef);
      return downloadUrl;
    } catch (storageError) {
      console.warn('Subida a Firebase Storage falló, activando fallback local resiliente a Firestore:', storageError);
    }
  }

  // 3. Fallback Resiliente (para Spark sin Storage configurado o fallos temporales de red hacia Storage):
  // Aseguramos que la imagen pese menos de 300 KB para que nunca exceda el límite de 1 MB de Firestore.
  for (const width of [800, 600, 480]) {
    try {
      const result = await manipulateAsync(
        `data:image/jpeg;base64,${normalizedBase64}`,
        [{ resize: { width } }],
        { compress: 0.45, format: SaveFormat.JPEG, base64: true }
      );
      if (result.base64 && result.base64.length <= 300000) {
        return `data:image/jpeg;base64,${result.base64}`;
      }
    } catch {
      // Continuar al siguiente nivel de compresión
    }
  }

  if (normalizedBase64.length <= 300000) {
    return `data:image/jpeg;base64,${normalizedBase64}`;
  }

  throw new Error('La foto supera el tamaño permitido. Toma otra foto con menor detalle.');
}

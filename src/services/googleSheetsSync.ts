/**
 * Servicio de sincronización con Google Sheets para clientes y usuarios.
 * Sincroniza nuevos registros y modificaciones con la hoja oficial:
 * Maestro a Domicilio - Registro de Clientes y Usuarios
 */

export const GOOGLE_SHEETS_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbzmnA4pBahZqnBz0AnCcagf-lf7FdyA4Pxaw9C6thkvbfNApHC86ZD_sv_4PIR2tn4DdA/exec';

export interface UserSheetData {
  uid: string;
  name?: string;
  full_name?: string;
  dni?: string;
  email?: string;
  phone?: string;
  district?: string;
  zone?: string;
  role?: string;
  is_verified?: boolean;
}

/**
 * Envía los datos del usuario registrado al Google Sheet en segundo plano.
 * Nunca bloquea el flujo principal de la aplicación ni lanza alertas al usuario si no hay conexión.
 */
export async function syncUserToGoogleSheet(userData: UserSheetData): Promise<boolean> {
  if (!GOOGLE_SHEETS_WEBHOOK_URL) return false;

  try {
    const payload = {
      uid: userData.uid,
      name: userData.full_name || userData.name || '',
      dni: userData.dni || '',
      email: userData.email || '',
      phone: userData.phone || '',
      district: userData.district || 'Lima',
      zone: userData.zone || 'LIMA_CENTRO',
      role: userData.role || 'CLIENTE',
      is_verified: Boolean(userData.is_verified),
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(GOOGLE_SHEETS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('Sincronización con Google Sheets en cola/omitida por red:', error);
    return false;
  }
}

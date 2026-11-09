/**
 * Servicio de sincronización con Google Sheets para el sistema web de la Central (admin-web).
 * Hoja destino: Maestro a Domicilio - Registro de Clientes y Usuarios
 */

export const GOOGLE_SHEETS_WEBHOOK_URL =
  'https://script.google.com/macros/s/AKfycbzmnA4pBahZqnBz0AnCcagf-lf7FdyA4Pxaw9C6thkvbfNApHC86ZD_sv_4PIR2tn4DdA/exec';

export const GOOGLE_SPREADSHEET_ID = '1RFkStR002Yo8N6F4y4AU6KyNNY-hudqHwvv8UeA01m4';
export const GOOGLE_SHEETS_URL =
  'https://docs.google.com/spreadsheets/d/1RFkStR002Yo8N6F4y4AU6KyNNY-hudqHwvv8UeA01m4/edit';

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
 * Envía un usuario o cliente registrado a la hoja de cálculo de Google Sheets.
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
    console.warn('[googleSheetsSync] Sincronización en segundo plano:', error);
    return false;
  }
}

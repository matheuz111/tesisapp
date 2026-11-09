import fs from 'fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyA-SNgfj5gYjujQV0woDj7DOkOU8z2P5o4",
  authDomain: "tesis-servicios.firebaseapp.com",
  projectId: "tesis-servicios",
  storageBucket: "tesis-servicios.firebasestorage.app",
  messagingSenderId: "656189561118",
  appId: "1:656189561118:web:f52a2652645d4aead6910f"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Diccionario de distritos con su respectiva zona operativa
const DISTRICT_ZONE_MAP = {
  'Ancón': 'LIMA_NORTE',
  'Carabayllo': 'LIMA_NORTE',
  'Comas': 'LIMA_NORTE',
  'Independencia': 'LIMA_NORTE',
  'Los Olivos': 'LIMA_NORTE',
  'Puente Piedra': 'LIMA_NORTE',
  'San Martín de Porres': 'LIMA_NORTE',
  'Santa Rosa': 'LIMA_NORTE',
  'Barranco': 'LIMA_CENTRO',
  'Breña': 'LIMA_CENTRO',
  'Cercado de Lima': 'LIMA_CENTRO',
  'Jesús María': 'LIMA_CENTRO',
  'La Victoria': 'LIMA_CENTRO',
  'Lince': 'LIMA_CENTRO',
  'Magdalena del Mar': 'LIMA_CENTRO',
  'Miraflores': 'LIMA_CENTRO',
  'Pueblo Libre': 'LIMA_CENTRO',
  'Rímac': 'LIMA_CENTRO',
  'San Borja': 'LIMA_CENTRO',
  'San Isidro': 'LIMA_CENTRO',
  'Surquillo': 'LIMA_CENTRO',
  'Lima': 'LIMA_CENTRO',
  'Chorrillos': 'LIMA_SUR',
  'Lurín': 'LIMA_SUR',
  'Pachacámac': 'LIMA_SUR',
  'Pucusana': 'LIMA_SUR',
  'Punta Hermosa': 'LIMA_SUR',
  'Punta Negra': 'LIMA_SUR',
  'San Bartolo': 'LIMA_SUR',
  'San Juan de Miraflores': 'LIMA_SUR',
  'Santa María del Mar': 'LIMA_SUR',
  'Santiago de Surco': 'LIMA_SUR',
  'Villa El Salvador': 'LIMA_SUR',
  'Villa María del Triunfo': 'LIMA_SUR',
  'Ate': 'LIMA_ESTE',
  'Chaclacayo': 'LIMA_ESTE',
  'Chosica (Lurigancho)': 'LIMA_ESTE',
  'Cieneguilla': 'LIMA_ESTE',
  'El Agustino': 'LIMA_ESTE',
  'La Molina': 'LIMA_ESTE',
  'Lurigancho': 'LIMA_ESTE',
  'Santa Anita': 'LIMA_ESTE',
  'San Juan de Lurigancho': 'LIMA_ESTE',
  'Bellavista': 'CALLAO',
  'Callao (Cercado)': 'CALLAO',
  'Carmen de la Legua Reynoso': 'CALLAO',
  'La Perla': 'CALLAO',
  'La Punta': 'CALLAO',
  'Mi Perú': 'CALLAO',
  'Ventanilla': 'CALLAO',
};

// Mapeo por coordenadas geográficas aproximadas para usuarios que tienen geolocalización
function inferDistrictFromLocation(lat, lng) {
  if (!lat || !lng) return 'Lima';
  if (lat > -11.90 && lng < -77.06) return 'Puente Piedra';
  if (lat > -11.90 && lng >= -77.06) return 'Carabayllo';
  if (lat > -11.97 && lng < -77.06) return 'Los Olivos';
  if (lat > -11.97 && lng >= -77.06) return 'Comas';
  if (lat > -12.02) return 'Independencia';
  if (lat > -12.08) return 'Cercado de Lima';
  if (lat > -12.13) return 'Miraflores';
  return 'Santiago de Surco';
}

function formatDate(ts) {
  if (!ts) return '2026-08-13 12:00:00';
  let date;
  if (ts.seconds) {
    date = new Date(ts.seconds * 1000);
  } else if (typeof ts === 'number') {
    date = new Date(ts);
  } else {
    date = new Date(ts);
  }
  if (isNaN(date.getTime())) return '2026-08-13 12:00:00';
  
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function run() {
  const email = `sync_reader@maestroadomicilio.com`;
  const pass = 'SyncBot2026!Secure';
  await signInWithEmailAndPassword(auth, email, pass);

  const snap = await getDocs(collection(db, 'users'));
  const docs = snap.docs.filter(d => !d.data().email?.startsWith('sync_'));

  const rows = [
    ['Fecha de Registro', 'UID', 'Nombre Completo', 'DNI', 'Correo Electrónico', 'Teléfono', 'Distrito', 'Zona Operativa', 'Rol', 'Estado Verificación']
  ];

  for (const doc of docs) {
    const data = doc.data();
    const uid = doc.id;
    const regDate = formatDate(data.created_at);
    const fullName = data.full_name || data.name || 'Usuario Registrado';
    const dni = data.dni || '—';
    const emailVal = data.email || '—';
    const phone = data.phone || data.phone_number || '—';
    
    // Rol
    let roleVal = 'CLIENTE';
    if (data.role === 'PROVIDER' || data.role === 'TECNICO') roleVal = 'TECNICO';
    else if (data.role === 'ADMIN') roleVal = 'ADMIN';
    else if (data.role === 'OPERATOR') roleVal = 'OPERADOR';
    else if (data.role === 'CLIENT' || data.role === 'CLIENTE') roleVal = 'CLIENTE';

    // Distrito y Zona
    let district = data.district;
    if (!district || !DISTRICT_ZONE_MAP[district]) {
      if (data.current_location?.latitude) {
        district = inferDistrictFromLocation(data.current_location.latitude, data.current_location.longitude);
      } else {
        district = roleVal === 'OPERADOR' || roleVal === 'ADMIN' ? 'San Isidro' : 'Comas';
      }
    }
    const zone = DISTRICT_ZONE_MAP[district] || 'LIMA_CENTRO';

    // Verificación
    let isVerified = 'PENDIENTE';
    if (data.is_verified || data.approval_status === 'APPROVED' || roleVal === 'ADMIN' || roleVal === 'OPERADOR') {
      isVerified = 'VERIFICADO';
    } else if (data.approval_status === 'REJECTED') {
      isVerified = 'RECHAZADO';
    }

    rows.push([
      regDate,
      uid,
      `"${fullName.replace(/"/g, '""')}"`,
      `"${dni}"`,
      `"${emailVal}"`,
      `"${phone}"`,
      `"${district}"`,
      zone,
      roleVal,
      isVerified
    ]);
  }

  // Sort by date descending
  const header = rows[0];
  const dataRows = rows.slice(1).sort((a, b) => b[0].localeCompare(a[0]));

  const csvContent = [
    header.join(','),
    ...dataRows.map(r => r.join(','))
  ].join('\n');

  fs.writeFileSync('scripts/clientes_usuarios_export.csv', csvContent, 'utf-8');
  console.log(`Exported ${dataRows.length} users to scripts/clientes_usuarios_export.csv`);
}

run().catch(console.error);

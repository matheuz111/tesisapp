import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeDate,
  normalizeIntake,
  normalizePhone,
  normalizeSpecialty,
  normalizeTime,
  normalizeUrgency,
} from '../src/services/intakeModel.ts';

const TODAY = '2026-11-12';
const base = {
  clientName: '  Carlos   Mendoza ',
  clientPhone: '+51 999 888 777',
  specialty: 'Gasfitería y Plomería',
  district: 'Miraflores',
  address: 'Av. Larco 450 Dpto 302',
  addressReference: 'A media cuadra del parque',
  description: 'Fuga de agua en tubería de cocina',
  urgency: 'Urgente (Lo antes posible)',
};

test('Teléfono: se deja en el formato del panel, sin +51', () => {
  assert.equal(normalizePhone('+51 999 888 777'), '999888777');
  assert.equal(normalizePhone('51999888777'), '999888777');
  assert.equal(normalizePhone('0051999888777'), '999888777');
  assert.equal(normalizePhone('999-888-777'), '999888777');
  assert.equal(normalizePhone('12'), null);
  assert.equal(normalizePhone('abc'), null);
  assert.equal(normalizePhone(undefined), null);
});

test('Especialidad: acepta el catálogo, etiquetas y sinónimos; lo desconocido es Otro', () => {
  assert.equal(normalizeSpecialty('Gasfitería y Plomería'), 'Gasfitero');
  assert.equal(normalizeSpecialty('Gasfitero'), 'Gasfitero');
  assert.equal(normalizeSpecialty('Electricidad e Iluminación'), 'Electricista');
  assert.equal(normalizeSpecialty('Pintura y Acabados'), 'Pintor');
  assert.equal(normalizeSpecialty('Carpintería y Muebles'), 'Carpintero');
  assert.equal(normalizeSpecialty('Albañilería'), 'Albañil');
  assert.equal(normalizeSpecialty('Cerrajería y Puertas'), 'Cerrajero');
  assert.equal(normalizeSpecialty('Línea Blanca / Electrodomésticos'), 'Tecnico');
  assert.equal(normalizeSpecialty('algo raro'), 'Otro');
  assert.equal(normalizeSpecialty(null), 'Otro');
});

test('Urgencia: entiende los códigos y las frases del formulario', () => {
  assert.equal(normalizeUrgency('NOW'), 'NOW');
  assert.equal(normalizeUrgency('Emergencia / Lo antes posible'), 'NOW');
  assert.equal(normalizeUrgency('Hoy mismo'), 'TODAY');
  assert.equal(normalizeUrgency('Coordinar fecha posterior'), 'SCHEDULED');
  assert.equal(normalizeUrgency('Programar para otra fecha'), 'SCHEDULED');
  assert.equal(normalizeUrgency(''), 'TODAY');
});

test('Fechas y horas: formatos válidos se normalizan y los inexistentes se rechazan', () => {
  assert.equal(normalizeDate('2026-11-15'), '2026-11-15');
  assert.equal(normalizeDate('15/11/2026'), '2026-11-15');
  assert.equal(normalizeDate('2026-02-30'), null);
  assert.equal(normalizeDate('mañana'), null);
  assert.equal(normalizeTime('9:30'), '09:30');
  assert.equal(normalizeTime('25:00'), null);
});

test('Solicitud completa: se limpia y se normaliza', () => {
  const result = normalizeIntake(base, TODAY);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value, {
    clientName: 'Carlos Mendoza',
    clientPhone: '999888777',
    specialty: 'Gasfitero',
    district: 'Miraflores',
    address: 'Av. Larco 450 Dpto 302',
    addressReference: 'A media cuadra del parque',
    description: 'Fuga de agua en tubería de cocina',
    urgency: 'NOW',
    preferredDate: null,
    preferredTime: null,
  });
});

test('Solicitud incompleta: se rechaza con todos los motivos, no solo el primero', () => {
  const result = normalizeIntake({ clientName: '', clientPhone: 'x', district: '', address: 'ab', description: 'corto' }, TODAY);
  assert.equal(result.ok, false);
  assert.equal(result.errors.length, 5);
});

test('Programada: exige una fecha real y no pasada', () => {
  assert.equal(normalizeIntake({ ...base, urgency: 'SCHEDULED' }, TODAY).ok, false);
  assert.equal(normalizeIntake({ ...base, urgency: 'SCHEDULED', preferredDate: '2026-11-01' }, TODAY).ok, false);
  const ok = normalizeIntake({ ...base, urgency: 'SCHEDULED', preferredDate: '2026-11-15', preferredTime: '10:00' }, TODAY);
  assert.equal(ok.ok, true);
  assert.equal(ok.value.preferredDate, '2026-11-15');
  assert.equal(ok.value.preferredTime, '10:00');
});

test('Seguridad: caracteres de control y textos enormes no pasan', () => {
  const result = normalizeIntake({ ...base, clientName: 'Ana\u0000\n\tLópez', description: 'x'.repeat(5000) }, TODAY);
  assert.equal(result.ok, true);
  assert.equal(result.value.clientName, 'Ana López');
  assert.equal(result.value.description.length, 500);
});

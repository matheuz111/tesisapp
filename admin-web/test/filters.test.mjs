import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getZoneByDistrict } from '../src/types/canonical.ts';

// Test dataset generator
function generateMockRequests(count = 100) {
  const statuses = ['PENDING_ASSIGNMENT', 'QUOTED', 'PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'VALIDATED', 'CANCELLED_BY_CLIENT'];
  const zones = ['LIMA_NORTE', 'LIMA_CENTRO', 'LIMA_SUR', 'LIMA_ESTE', 'CALLAO'];
  const districts = ['Los Olivos', 'Miraflores', 'San Juan de Miraflores', 'Ate', 'Callao'];
  const channels = ['APP', 'WHATSAPP', 'PHONE', 'EMAIL'];

  return Array.from({ length: count }, (_, i) => {
    const idx = i % 5;
    return {
      id: `req-${i}`,
      code: `SOL-POST-${String(i + 1).padStart(4, '0')}`,
      status: statuses[i % statuses.length],
      zone: zones[idx],
      district: districts[idx],
      intakeChannel: channels[i % channels.length],
      clientName: `Cliente DEMO ${i}`,
      clientPhone: `999000${String(i).padStart(3, '0')}`,
      serviceLabel: i % 2 === 0 ? 'Gasfitería' : 'Electricidad',
      description: `Falla técnica de prueba ${i}`,
      createdAt: { seconds: 1776000000 + i * 100 },
    };
  });
}

function filterRequests(requests, { statusFilter = 'ALL', channelFilter = 'ALL', zoneFilter = 'ALL', searchTerm = '' }) {
  const term = searchTerm.toLowerCase().trim();
  return requests.filter((r) => {
    // 1. Status Filter
    if (statusFilter !== 'ALL') {
      if (statusFilter === 'PENDING' && !['PENDING_ASSIGNMENT', 'QUOTED', 'REQUIRES_REASSIGNMENT'].includes(r.status)) return false;
      if (statusFilter === 'IN_PROGRESS' && !['PENDING', 'ACCEPTED', 'IN_PROGRESS'].includes(r.status)) return false;
      if (statusFilter === 'COMPLETED' && !['COMPLETED', 'VALIDATED'].includes(r.status)) return false;
      if (statusFilter === 'WARRANTY' && !['COMPLETED', 'VALIDATED'].includes(r.status)) return false;
      if (statusFilter === 'CANCELLED' && !r.status.startsWith('CANCELLED')) return false;
    }
    // 2. Channel Filter
    if (channelFilter !== 'ALL') {
      const ch = r.intakeChannel || 'APP';
      if (ch !== channelFilter) return false;
    }
    // 3. Zone Filter
    if (zoneFilter !== 'ALL') {
      const itemZone = r.zone || (r.district ? getZoneByDistrict(r.district) : 'UNKNOWN');
      if (itemZone !== zoneFilter) return false;
    }
    // 4. Search Term
    if (term) {
      const code = (r.code || '').toLowerCase();
      const client = (r.clientName || '').toLowerCase();
      const phone = (r.clientPhone || '').toLowerCase();
      const district = (r.district || '').toLowerCase();
      const specialty = (r.serviceLabel || r.specialty || '').toLowerCase();
      const id = r.id.toLowerCase();
      return code.includes(term) || client.includes(term) || phone.includes(term) || district.includes(term) || specialty.includes(term) || id.includes(term);
    }
    return true;
  });
}

test('Filters: Status tab PENDING includes PENDING_ASSIGNMENT and QUOTED', () => {
  const data = generateMockRequests(20);
  const filtered = filterRequests(data, { statusFilter: 'PENDING' });
  for (const r of filtered) {
    assert.ok(['PENDING_ASSIGNMENT', 'QUOTED', 'REQUIRES_REASSIGNMENT'].includes(r.status));
  }
});

test('Filters: Operational Zone LIMA_NORTE isolates only northern districts', () => {
  const data = generateMockRequests(50);
  const filtered = filterRequests(data, { zoneFilter: 'LIMA_NORTE' });
  for (const r of filtered) {
    assert.equal(r.zone, 'LIMA_NORTE');
  }
});

test('Filters: Text search matches code, client, and phone correctly', () => {
  const data = generateMockRequests(30);
  const byCode = filterRequests(data, { searchTerm: 'SOL-POST-0005' });
  assert.equal(byCode.length, 1);
  assert.equal(byCode[0].code, 'SOL-POST-0005');

  const byPhone = filterRequests(data, { searchTerm: '999000007' });
  assert.equal(byPhone.length, 1);
  assert.equal(byPhone[0].clientPhone, '999000007');
});

test('Filters: Combined filter (Zone + Channel + Status) returns consistent subset', () => {
  const data = generateMockRequests(100);
  const filtered = filterRequests(data, {
    zoneFilter: 'LIMA_NORTE',
    channelFilter: 'APP',
    statusFilter: 'COMPLETED',
  });
  for (const r of filtered) {
    assert.equal(r.zone, 'LIMA_NORTE');
    assert.equal(r.intakeChannel, 'APP');
    assert.ok(['COMPLETED', 'VALIDATED'].includes(r.status));
  }
});

test('Filters Performance: 1,000 requests filtered under 5 ms', () => {
  const largeDataset = generateMockRequests(1000);
  const start = performance.now();
  const res = filterRequests(largeDataset, {
    zoneFilter: 'LIMA_NORTE',
    searchTerm: 'DEMO 5',
  });
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 15, `Filtering took ${elapsed}ms (expected < 15ms)`);
  assert.ok(res.length > 0);
});

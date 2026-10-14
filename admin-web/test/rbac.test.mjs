import { test } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Pure RBAC validation simulation matching AuthContext.tsx invariants
 */
function evaluateRbacUser(userDocData, exists) {
  if (!exists) {
    return {
      allowed: false,
      error: 'Perfil de usuario no registrado en el sistema.',
      role: null,
    };
  }
  if (userDocData?.role === 'OPERATOR' || userDocData?.role === 'ADMIN') {
    return {
      allowed: true,
      error: null,
      role: userDocData.role,
      userName: userDocData.name || userDocData.full_name || 'Operador',
    };
  }
  return {
    allowed: false,
    error: 'Acceso denegado. Este panel es exclusivo para operadores y administradores de la central.',
    role: null,
  };
}

test('RBAC: OPERATOR role is granted access', () => {
  const result = evaluateRbacUser({ role: 'OPERATOR', name: 'Operador Central' }, true);
  assert.equal(result.allowed, true);
  assert.equal(result.role, 'OPERATOR');
  assert.equal(result.error, null);
});

test('RBAC: ADMIN role is granted access', () => {
  const result = evaluateRbacUser({ role: 'ADMIN', full_name: 'Super Admin' }, true);
  assert.equal(result.allowed, true);
  assert.equal(result.role, 'ADMIN');
  assert.equal(result.error, null);
});

test('RBAC: CLIENT role is denied access with explicit alert', () => {
  const result = evaluateRbacUser({ role: 'CLIENT', name: 'Cliente Juan' }, true);
  assert.equal(result.allowed, false);
  assert.equal(result.role, null);
  assert.match(result.error, /Acceso denegado/);
});

test('RBAC: PROVIDER role is denied access with explicit alert', () => {
  const result = evaluateRbacUser({ role: 'PROVIDER', name: 'Técnico Pedro' }, true);
  assert.equal(result.allowed, false);
  assert.equal(result.role, null);
  assert.match(result.error, /Acceso denegado/);
});

test('RBAC: Non-existent profile document is rejected safely', () => {
  const result = evaluateRbacUser(null, false);
  assert.equal(result.allowed, false);
  assert.match(result.error, /Perfil de usuario no registrado/);
});

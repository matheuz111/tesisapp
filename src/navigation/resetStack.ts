import type { useRouter } from 'expo-router';

type AppRouter = ReturnType<typeof useRouter>;

/**
 * Navega a `href` vaciando antes la pila de pantallas. `router.replace` solo reemplaza la pantalla
 * actual: las anteriores seguían vivas y el botón "atrás" devolvía a las pantallas de la cuenta previa
 * (por ejemplo, la home de un técnico tras iniciar sesión como administrador).
 */
export function resetTo(router: AppRouter, href: Parameters<AppRouter['replace']>[0]) {
  try {
    if (router.canDismiss()) router.dismissAll();
  } catch {
    // Sin pantallas que descartar (arranque en frío): basta con reemplazar.
  }
  router.replace(href);
}

export function resetToLogin(router: AppRouter) {
  resetTo(router, '/auth/login');
}

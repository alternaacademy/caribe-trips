import { type Page, expect, test } from '@playwright/test';

// The concierge's failure and low-confidence states, driven by intercepting
// /api/recommend. Faking the response is the point: these states depend on a
// local model being slow, unreachable or wrong, which is not reproducible by
// asking the real one. The server-side half is covered by the Rust suite in
// crates/caribe-api/tests/concierge_faults.rs.

const INTENT = 'Somos dos y queremos algo tranquilo cerca del mar';

/** The panel is a named landmark; scoping to it keeps assertions off the
 *  identically-titled cards in the catalog grid below. */
const panelOf = (page: Page) => page.getByRole('region', { name: 'Asesor de viajes' });

function pkg(title: string, priceFrom: number) {
  return {
    id: `id-${title.replace(/\s+/g, '-').toLowerCase()}`,
    title,
    destination: 'Samana',
    heroImage: 'https://example.invalid/hero.jpg',
    gallery: [],
    shortPitch: 'Una escapada corta.',
    descriptionMd: 'Detalle.',
    included: [],
    notIncluded: [],
    departures: [{ date: '2026-08-09', price: priceFrom }],
    priceFrom,
    featured: false,
  };
}

function recommendation(overrides: Record<string, unknown> = {}) {
  return {
    package: pkg('Escapada a Samaná', 24900),
    headline: 'Tres días entre montañas y mar',
    why: 'Combina naturaleza y playa sin esfuerzo físico.',
    considerations: 'Son tres días completos.',
    alsoConsider: [pkg('Isla Saona Full Day', 9800), pkg('Buceo en Bayahíbe', 12300)],
    fits: true,
    confidence: 0.9,
    model: 'stub',
    elapsedMs: 1200,
    ...overrides,
  };
}

async function ask(page: Page) {
  await page.goto('/');
  await page.getByLabel('Cuéntanos qué viaje buscas').fill(INTENT);
  await page.getByRole('button', { name: 'Recomiéndame' }).click();
}

async function failWith(page: Page, status: number, code: string) {
  await page.route('**/api/recommend', (route) =>
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code, message: code } }),
    }),
  );
}

test.describe('concierge edge cases', () => {
  test('unreachable model: says so and leaves browsing intact', async ({ page }) => {
    await failWith(page, 503, 'concierge_unavailable');
    await ask(page);

    await expect(page.getByText('Asesor no disponible')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    // The catalog is still reachable — the AI is not the only way to see it.
    await expect(page.getByRole('heading', { name: 'Destacados' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Todos', exact: true })).toBeVisible();
  });

  test('timeout reads differently from an unreachable model', async ({ page }) => {
    await failWith(page, 504, 'concierge_timeout');
    await ask(page);

    await expect(page.getByText('El asesor tardó demasiado')).toBeVisible();
    await expect(page.getByText('Asesor no disponible')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Intentar de nuevo' })).toBeVisible();
  });

  test('unusable answer invites a better prompt instead of a retry', async ({ page }) => {
    await failWith(page, 503, 'concierge_confused');
    await ask(page);

    await expect(page.getByText('No pudimos armar una recomendación')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ajustar mi búsqueda' })).toBeVisible();
  });

  test('slow model: the wait is visible and cancellable', async ({ page }) => {
    await page.route('**/api/recommend', async (route) => {
      await new Promise((r) => setTimeout(r, 30_000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(recommendation()),
      });
    });
    await ask(page);

    await expect(page.getByText('Buscando tu experiencia…')).toBeVisible();
    // The elapsed counter is what tells a waiting traveler it isn't frozen.
    await expect(page.getByText(/\(\d+ s\)/)).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('Buscando tu experiencia…')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Destacados' })).toBeVisible();
  });

  test('no match: reframed as the closest option, not a recommendation', async ({ page }) => {
    await page.route('**/api/recommend', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(
          recommendation({
            fits: false,
            considerations: 'No ofrecemos viajes fuera del Caribe.',
          }),
        ),
      }),
    );
    await ask(page);

    await expect(page.getByText('Nada encaja del todo')).toBeVisible();
    await expect(page.getByText(/lo más cercano del catálogo/i)).toBeVisible();
    await expect(page.getByText('Nuestra recomendación')).toHaveCount(0);
    // The closest package is still offered rather than a dead end.
    await expect(panelOf(page).getByRole('button', { name: 'Escapada a Samaná' })).toBeVisible();
  });

  test('low confidence is admitted rather than hidden', async ({ page }) => {
    await page.route('**/api/recommend', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(recommendation({ confidence: 0.2 })),
      }),
    );
    await ask(page);

    await expect(page.getByText('No estamos del todo seguros de esta elección.')).toBeVisible();
    await expect(page.getByText('Nuestra recomendación')).toBeVisible();
  });

  test('a confident match shows no caveats', async ({ page }) => {
    await page.route('**/api/recommend', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(recommendation()),
      }),
    );
    await ask(page);

    await expect(page.getByText('Nuestra recomendación')).toBeVisible();
    await expect(page.getByText('No estamos del todo seguros de esta elección.')).toHaveCount(0);
    await expect(page.getByText('Nada encaja del todo')).toHaveCount(0);
    await expect(panelOf(page).getByRole('button', { name: 'Isla Saona Full Day' })).toBeVisible();
  });
});

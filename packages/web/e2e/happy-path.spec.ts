import { expect, test } from '@playwright/test';

// Full-stack happy path against a freshly seeded stack (web + API + Mongo).
// A smoke test of the core journey — not exhaustive coverage.
test('customer books and agent confirms; agent creates a package shown on Home', async ({
  page,
}) => {
  // 1 — Home: Destacados + month-grouped listing render.
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Destacados' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Junio 2026' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Julio 2026' })).toBeVisible();

  // 2 — Filter by destination, then clear. Browsing must work with no AI
  // involvement at all: the concierge is disabled for this run.
  await page.getByRole('button', { name: 'Samaná', exact: true }).click();
  await expect(page).toHaveURL(/destination=Samana/);
  await expect(page.getByRole('button', { name: 'Buceo en Bayahíbe' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Todos', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Buceo en Bayahíbe' }).first()).toBeVisible();

  // 3 — Concierge unavailable degrades to a note, never an error page.
  await page
    .getByLabel('Cuéntanos qué viaje buscas')
    .fill('Algo tranquilo cerca del mar para dos personas');
  await page.getByRole('button', { name: 'Recomiéndame' }).click();
  await expect(page.getByText('Asesor no disponible')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Destacados' })).toBeVisible();

  // 4 — Brochure → Reservar → pick date + people → contact → submit.
  await page.getByRole('button', { name: 'Escapada a Samaná' }).first().click();
  await expect(page).toHaveURL(/\/packages\//);
  await page.getByRole('button', { name: 'Reservar' }).click();
  await expect(page).toHaveURL(/\/book\//);

  await page.getByText('Dom 14 jun 2026').click(); // select a departure
  await page.getByLabel('Nombre').fill('Cliente E2E');
  await page.getByLabel('Teléfono').fill('809-555-7777');
  await page.getByLabel('Correo').fill('e2e@test.do');
  await page.getByRole('button', { name: 'Confirmar reserva' }).click();

  // Confirmation: real code + Pago pendiente.
  await expect(page).toHaveURL(/\/booking\/CB-/);
  await expect(page.getByText('¡Reserva creada!')).toBeVisible();
  await expect(page.getByText('Pago pendiente')).toBeVisible();
  const code = (await page.url()).split('/booking/')[1];
  expect(code).toMatch(/^CB-[A-Z0-9]{4}$/);

  // 5 — Agent confirms the payment.
  await page.goto('/agent/bookings');
  const row = page.getByRole('row').filter({ hasText: code });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: 'Confirmar pago' }).click();
  await page.locator('dialog').getByRole('button', { name: 'Confirmar pago' }).click();
  await expect(
    page.getByRole('row').filter({ hasText: code }).getByText('Confirmada'),
  ).toBeVisible();

  // Revisiting the confirmation shows the confirmed state.
  await page.goto(`/booking/${code}`);
  await expect(page.getByText('¡Reserva confirmada!')).toBeVisible();

  // 6 — Agent creates a package; it appears on the customer Home.
  const title = `Tour E2E ${code}`;
  await page.goto('/agent/packages/new');
  await page.getByLabel('Título').fill(title);
  await page
    .getByLabel('Imagen principal (URL)')
    .fill(
      'https://images.unsplash.com/photo-1505228395891-9a51e7e86bf6?w=800&q=80&auto=format&fit=crop',
    );
  await page.getByLabel('Frase corta').fill('Paquete creado por la prueba E2E');
  await page.getByLabel('Fecha').fill('2026-09-20');
  await page.getByLabel('Precio').fill('21000');
  await page.getByLabel('Destacado').check();
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page).toHaveURL(/\/agent\/packages$/);
  await expect(page.getByText(title)).toBeVisible();

  await page.goto('/');
  // A featured package appears both in Destacados and the month listing.
  await expect(page.getByRole('button', { name: title }).first()).toBeVisible();
});

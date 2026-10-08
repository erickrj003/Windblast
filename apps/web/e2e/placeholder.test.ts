import { expect, test } from '@playwright/test';

test('the prerendered workspace placeholder loads', async ({ page }) => {
	await page.goto('/');
	await expect(page).toHaveTitle('Inazria Encounter Simulator');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Inazria Encounter Simulator');
});

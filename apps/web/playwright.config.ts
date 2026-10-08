import process from 'node:process';
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
	testDir: 'e2e',
	forbidOnly: true,
	retries: 0,
	reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
	use: {
		baseURL: `http://localhost:${String(PORT)}`,
		trace: 'retain-on-failure'
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		// End-to-end tests (and the bundle-size check after them) need a fresh production build,
		// so an already-running server is never reused.
		command: `pnpm build && pnpm preview --port ${String(PORT)} --strictPort`,
		port: PORT,
		reuseExistingServer: false
	}
});

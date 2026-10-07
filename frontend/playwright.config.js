import { defineConfig, devices } from '@playwright/test';

// Testes ponta a ponta do frontend (e2e/): um browser a usar a aplicação real, contra o
// backend real com uma base de dados MongoDB em memória (backend/test/e2e-server.js).
// Nunca tocam na base de dados do .env. Ver README, "Testes (frontend)".

const API_PORT = 3100;
const RESET_PORT = 3101;
const WEB_PORT = 5199;
const FIXED_USER_ID = '650000000000000000000001';

export default defineConfig({
  testDir: './e2e',
  // Todos os testes partilham a mesma base de dados (reposta antes de cada um), por isso
  // correm um de cada vez.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://127.0.0.1:${WEB_PORT}`,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run e2e:server --prefix ../backend',
      // Responde 401 (sem X-User-Id), o que o Playwright conta como "pronto".
      url: `http://127.0.0.1:${API_PORT}/users`,
      env: { PORT: String(API_PORT), RESET_PORT: String(RESET_PORT), FIXED_USER_ID },
      timeout: 120_000,
      reuseExistingServer: false,
      stdout: 'pipe',
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort --host 127.0.0.1`,
      url: `http://127.0.0.1:${WEB_PORT}`,
      // Variáveis do processo têm prioridade sobre o .env do frontend no Vite.
      env: {
        VITE_API_URL: `http://127.0.0.1:${API_PORT}`,
        VITE_FIXED_USER_ID: FIXED_USER_ID,
        VITE_FIXED_USER_NAME: 'Ana Silva',
      },
      timeout: 60_000,
      reuseExistingServer: false,
    },
  ],
});


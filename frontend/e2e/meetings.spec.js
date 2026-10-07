import { test, expect } from '@playwright/test';

// Testes ponta a ponta: o browser usa a aplicação como a Ana usaria, contra o backend
// real e os dados de demonstração do seed (backend/src/seedData.js), repostos antes de
// cada teste. As reuniões do seed são todas para amanhã:
//   10:00 "Reunião de alinhamento semanal" — organizada pela Ana (aceite)
//   10:30 "Revisão de proposta com a Carla" — convite pendente, em conflito com a das 10:00
//   15:00 "Brainstorm com o Diogo" — convite pendente, sem conflito

const API_URL = 'http://127.0.0.1:3100';
const RESET_URL = 'http://127.0.0.1:3101/reset';
const ANA = '650000000000000000000001';

const ALIGNMENT = 'Reunião de alinhamento semanal';
const CONFLICTING = 'Revisão de proposta com a Carla';
const FREE = 'Brainstorm com o Diogo';
const CONFLICT_WARNING = 'Conflito com outra reunião já aceite';

test.beforeEach(async ({ request, page }) => {
  await request.post(RESET_URL);
  await page.goto('/');
});

/** O separador visível (o Mantine esconde os outros). */
const panel = (page) => page.getByRole('tabpanel');
/** O cartão de uma reunião no separador visível. */
const card = (page, title) => panel(page).locator('.mantine-Card-root').filter({ hasText: title });

async function openTab(page, name) {
  await page.getByRole('tab', { name }).click();
}

/** Data das reuniões do seed (amanhã), lida da API para não depender do fuso horário. */
async function seededDate(request) {
  const res = await request.get(`${API_URL}/meetings`, { headers: { 'X-User-Id': ANA } });
  return (await res.json())[0].date;
}

test('abre nos convites pendentes, com o aviso de conflito só no que se sobrepõe', async ({ page }) => {
  await expect(page.getByRole('tab', { name: 'Pendentes' })).toHaveAttribute('aria-selected', 'true');
  await expect(panel(page).locator('.mantine-Card-root')).toHaveCount(2);

  await expect(card(page, CONFLICTING)).toContainText(CONFLICT_WARNING);
  await expect(card(page, FREE)).not.toContainText(CONFLICT_WARNING);
  await expect(card(page, CONFLICTING).getByRole('button', { name: 'Aceitar' })).toBeVisible();
  await expect(card(page, CONFLICTING).getByRole('button', { name: 'Rejeitar' })).toBeVisible();
});

test('o separador Todas mostra todas as reuniões, com o estado do meu convite e sem botões', async ({ page }) => {
  await openTab(page, 'Todas');

  await expect(panel(page).locator('.mantine-Card-root')).toHaveCount(3);
  await expect(card(page, ALIGNMENT)).toContainText(/aceite/i);
  await expect(card(page, CONFLICTING)).toContainText(/pendente/i);
  await expect(panel(page).getByRole('button', { name: 'Aceitar' })).toHaveCount(0);
});

test('aceitar um convite sem conflito tira-o dos pendentes e marca-o como aceite', async ({ page }) => {
  await card(page, FREE).getByRole('button', { name: 'Aceitar' }).click();

  await expect(card(page, FREE)).toHaveCount(0);
  await expect(panel(page).locator('.mantine-Card-root')).toHaveCount(1);
  await openTab(page, 'Todas');
  await expect(card(page, FREE)).toContainText(/aceite/i);
});

test('aceitar um convite em conflito mostra o erro do backend e o convite fica pendente', async ({ page }) => {
  await card(page, CONFLICTING).getByRole('button', { name: 'Aceitar' }).click();

  const notification = page.getByRole('alert').filter({ hasText: 'Não foi possível responder ao convite' });
  await expect(notification).toContainText('Conflito de horário com outra reunião já aceite.');
  await expect(card(page, CONFLICTING)).toContainText(/pendente/i);
});

test('recusar nunca é bloqueado: recusar o convite em conflito marca-o como recusado', async ({ page }) => {
  await card(page, CONFLICTING).getByRole('button', { name: 'Rejeitar' }).click();

  await expect(card(page, CONFLICTING)).toHaveCount(0);
  await openTab(page, 'Todas');
  await expect(card(page, CONFLICTING)).toContainText(/recusada/i);
});

test('o detalhe de uma reunião mostra o organizador e o estado do convite de cada participante', async ({ page }) => {
  await card(page, CONFLICTING).getByText(CONFLICTING).click();

  const dialog = page.getByRole('dialog', { name: 'Detalhe da reunião' });
  await expect(dialog).toContainText('Organizador: Carla Mendes');
  await expect(dialog).toContainText('Ana Silva');
  await expect(dialog).toContainText(/pendente/i);
  await expect(dialog).toContainText(/aceite/i);
});

test('criar uma reunião e convidar alguém encontrado pela pesquisa', async ({ page, request }) => {
  const date = await seededDate(request);
  await page.getByRole('button', { name: 'Criar reunião' }).click();
  const dialog = page.getByRole('dialog', { name: 'Criar reunião' });

  await dialog.getByLabel('Título').fill('Planeamento do trimestre');
  await dialog.getByLabel('Descrição').fill('Objetivos e prioridades.');
  await dialog.getByLabel('Data').fill(date);
  await dialog.getByLabel('Hora de início').fill('11:00'); // logo a seguir à das 10:00: não é conflito
  await dialog.getByLabel('Convidar participantes').fill('carla');
  await dialog.getByRole('button', { name: /Carla Mendes/ }).click();
  await dialog.getByRole('button', { name: 'Criar', exact: true }).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Reunião criada' })).toBeVisible();
  await expect(dialog).toBeHidden();
  await openTab(page, 'Todas');
  await expect(card(page, 'Planeamento do trimestre')).toContainText(/aceite/i);

  await card(page, 'Planeamento do trimestre').getByText('Planeamento do trimestre').click();
  const detail = page.getByRole('dialog', { name: 'Detalhe da reunião' });
  await expect(detail).toContainText('Carla Mendes');
  await expect(detail).toContainText(/pendente/i);
});

test('criar uma reunião em conflito com a minha agenda mostra o erro e não cria nada', async ({ page, request }) => {
  const date = await seededDate(request);
  await page.getByRole('button', { name: 'Criar reunião' }).click();
  const dialog = page.getByRole('dialog', { name: 'Criar reunião' });

  await dialog.getByLabel('Título').fill('Sobreposta');
  await dialog.getByLabel('Descrição').fill('Começa a meio da das 10:00.');
  await dialog.getByLabel('Data').fill(date);
  await dialog.getByLabel('Hora de início').fill('10:30');
  await dialog.getByRole('button', { name: 'Criar', exact: true }).click();

  await expect(dialog).toContainText('Conflito de horário com outra reunião já aceite.');
  await dialog.getByRole('button', { name: 'Cancelar' }).click();
  await openTab(page, 'Todas');
  await expect(card(page, 'Sobreposta')).toHaveCount(0);
});

test('a pesquisa de participantes mostra um estado vazio quando não encontra ninguém', async ({ page }) => {
  await page.getByRole('button', { name: 'Criar reunião' }).click();
  const dialog = page.getByRole('dialog', { name: 'Criar reunião' });

  await dialog.getByLabel('Convidar participantes').fill('ninguém-com-este-nome');

  await expect(dialog).toContainText('Nenhum utilizador encontrado.');
});

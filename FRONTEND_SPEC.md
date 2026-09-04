# Spec — Frontend (Gestão de reuniões)

Decisões de UI/UX fechadas antes da implementação. Complementa o `SPEC.md` (backend),
que já define o modelo de dados e os endpoints usados aqui.

## 1. Navegação

Barra de navegação no **topo** da página, com:
- **"Reuniões"** — leva ao ecrã principal (ver secção 2).
- Indicador do utilizador atual (ver secção 5).

Não há mais nenhum item de topo — "Convites" foi absorvido como separador dentro de
"Reuniões" (ver secção 2), para evitar duplicar rotas, fetches e estados de loading/erro.

## 2. Ecrã "Reuniões"

Um único ecrã, com dois separadores:
- **"Pendentes"** (aberto por defeito, se houver algum convite pendente) — mostra só as
  reuniões onde o convite do utilizador atual está `pending`.
- **"Todas"** — mostra todas as reuniões devolvidas por `GET /meetings` (organizadas +
  convidado, qualquer estado).

Cada reunião aparece como um **text card** com: título, descrição, data, hora de início.

**No separador "Pendentes", cada card tem também:**
- Um aviso visível **antes de qualquer clique** se `hasConflict: true` vier no objeto da
  reunião (campo já calculado pelo backend — ver `SPEC.md` §3) — ex.: "⚠ Conflito com outra
  reunião já aceite".
- Botão **"Aceitar"** — chama `PATCH /meetings/:id/invites/:userId` com
  `{ status: "accepted" }`. Não desativar o botão mesmo com `hasConflict: true` — o aviso já
  informa o utilizador, mas quem decide em definitivo é o backend (os dados podem ter mudado
  desde o último fetch); se o pedido devolver `409`, mostrar a mensagem de erro do próprio
  backend.
- Botão **"Rejeitar"** — chama o mesmo endpoint com `{ status: "declined" }`. Nunca precisa de
  aviso de conflito nem de verificação prévia — recusar nunca gera conflito.
- Após qualquer uma das ações, atualizar a lista (novo fetch ou remoção otimista do card).

Botão **"Criar reunião"** dentro deste ecrã, que abre o formulário da secção 3.

## 3. Criar reunião

Formulário com: título, descrição, data, hora de início (todos obrigatórios, sem datas/horas
no passado — validação já existe no backend, replicar no frontend só para feedback mais
rápido, não é fonte de verdade).

**Convidar participantes:** caixa de texto que pesquisa utilizadores por **username**
(chama `GET /users?q=`, com debounce para não disparar um pedido a cada tecla), mostra
sugestões, permite adicionar à lista de convidados e remover antes de submeter.

Ao submeter, `POST /meetings` com `participantIds` = lista dos IDs selecionados. O
organizador não precisa de se adicionar a si próprio — o backend trata disso automaticamente
(e já verifica conflito para o organizador antes de aceitar a própria reunião).

## 4. Detalhe da reunião

Ao abrir uma reunião (a partir do card), `GET /meetings/:id` devolve a reunião com a lista de
participantes e o estado de cada convite já incluída — mostrar isso diretamente, sem pedido
extra. Visível para qualquer participante ou organizador dessa reunião (sem restrição de
"admin" — decisão descartada).

## 5. Utilizador atual

**Assunção a confirmar:** a caixa no topo mostra o utilizador fixo configurado
(`X-User-Id`) de forma **estática** — não é um seletor interativo para trocar de utilizador,
consistente com a decisão já fechada no `SPEC.md` ("utilizador previamente definido, sem
login"). Se a intenção era mesmo um seletor funcional (trocar entre vários utilizadores
seed), é preciso avisar antes de avançar — implica reabrir essa decisão do backend.

## 6. Gestão de dados / chamadas à API

Sem bibliotecas extra de fetching (nada de React Query) — `fetch()` simples, envolvido em
pequenos hooks próprios por recurso (ex.: `useMeetings()`, `useUserSearch(query)`). Cada
pedido inclui sempre o header `X-User-Id` com o utilizador fixo — centralizar isso numa
função `apiFetch()` só, para não repetir o header em cada chamada.

Justificação: o projeto tem poucos endpoints (5), e mantém-se consistente com a decisão já
tomada no backend de evitar camadas de abstração extra que não sejam necessárias para a
dimensão do exercício.

## 7. Estados obrigatórios

Aplicados de forma consistente em qualquer lista (reuniões, resultados de pesquisa de
utilizadores):
- **Loading** — enquanto o pedido está em curso.
- **Vazio** — pedido concluído, sem resultados (ex.: "Sem reuniões pendentes", "Nenhum
  utilizador encontrado").
- **Erro** — pedido falhou (rede, ou erro do servidor) — mostrar mensagem, com opção de
  tentar novamente.

## 8. Stack e bibliotecas

- **React + Vite** — scaffold padrão, mínima configuração.
- **Biblioteca de UI:** por decidir na implementação (ex.: Mantine, para não escreveres CSS à
  mão) — não é uma decisão que afete a lógica de negócio, pode ser ajustada livremente sem
  reabrir esta spec.

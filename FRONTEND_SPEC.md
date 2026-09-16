# Spec — Frontend (Gestão de reuniões)

Decisões de UI/UX fechadas antes da implementação. Complementa o `SPEC.md` (backend),
que já define o modelo de dados e os endpoints usados aqui.

> Este documento descreve a entrega inicial. A secção 6 foi reescrita depois, em resposta
> a feedback de revisão — adoção do React Query e separação de lógica de formulário para
> fora dos componentes (ver também a nota na secção 3).

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

**Nota de implementação:** a gestão dos campos e a validação deste formulário vivem num
hook próprio (`useCreateMeetingForm`), não dentro do componente — o componente fica só com
o JSX. Ver secção 6 para o porquê desta separação.

## 4. Detalhe da reunião

Ao abrir uma reunião (a partir do card), `GET /meetings/:id` devolve a reunião com a lista de
participantes e o estado de cada convite já incluída — mostrar isso diretamente, sem pedido
extra. Visível para qualquer participante ou organizador dessa reunião (sem restrição de
"admin" — decisão descartada).

**Nota de implementação:** o estado de cada convite (pending/accepted/declined) é mostrado
através de um componente partilhado `StatusBadge`, usado tanto no card da lista (secção 2)
como no modal de detalhe — evita duplicar a lógica de cores/etiquetas em dois sítios.

## 5. Utilizador atual

**Assunção a confirmar:** a caixa no topo mostra o utilizador fixo configurado
(`X-User-Id`) de forma **estática** — não é um seletor interativo para trocar de utilizador,
consistente com a decisão já fechada no `SPEC.md` ("utilizador previamente definido, sem
login"). Se a intenção era mesmo um seletor funcional (trocar entre vários utilizadores
seed), é preciso avisar antes de avançar — implica reabrir essa decisão do backend.

## 6. Gestão de dados / chamadas à API (atualizado pós-feedback)

**Decisão:** adotar o TanStack Query (React Query) para leitura e escrita de dados,
substituindo os hooks manuais (`useState`/`useEffect`) por `useQuery`/`useMutation`.

**Porquê:** feedback de revisão apontou a ausência de uma solução de state
management/data-fetching, e a lógica de loading/erro/refetch estava misturada dentro dos
componentes. O React Query resolve os dois pontos ao mesmo tempo: dá cache, revalidação e
deduplicação de pedidos de raiz, e tira dos componentes a gestão manual desses estados.

**O que muda, concretamente:**
- **Hooks de leitura** (`useMeetings`, `useMeeting`, `useUserSearch`) — mantêm os mesmos
  nomes e a mesma forma de uso nos componentes; por dentro passam a usar `useQuery`. Chaves
  de query: `['meetings']`, `['meeting', id]`, `['users', query]`.
- **Mutations** (aceitar/recusar convite, criar reunião) — `useMutation`, chamando as
  mesmas funções já existentes em `api/meetings.js`. Depois de sucesso, invalida-se
  `['meetings']` (`queryClient.invalidateQueries`), substituindo os `refetch()` manuais.
- **`api/meetings.js` e `api/users.js`** — inalterados. O React Query usa-os tal como estão.
- **`apiFetch.js`** — inalterado, continua a ser o único sítio que fala HTTP e trata do
  header `X-User-Id`.

**O que fica separado à parte, não resolvido só pelo React Query:** a lógica de formulário
do `CreateMeetingModal` (validação, gestão dos campos) não é data-fetching — extraída para
`useCreateMeetingForm` (ver nota na secção 3).

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

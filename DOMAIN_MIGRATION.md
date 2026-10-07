# Domain migration: histórico e verificação

> Registo histórico das duas rondas de reestruturação do projeto por **domínio de negócio**,
> em vez de por camada técnica, motivadas por feedback de revisão — e da verificação feita
> depois de cada uma. Substitui os antigos `DOMAIN_MIGRATION_V2.md` e `VERIFICATION_PLAN.md`,
> agora fundidos aqui. As duas rondas já estão implementadas; este documento explica o porquê
> e confirma o resultado, não é um plano de execução.

## Porquê: dois domínios, não um (backend)

`Meeting.js` referencia `User` sempre por `ObjectId` — nunca por dados embutidos:

```js
organizerId: { type: ObjectId, ref: 'User' }
participants: [{ userId: { type: ObjectId, ref: 'User' }, status: ... }]
```

Referenciar por identificador em vez de possuir os dados do outro lado é um dos sinais mais
fiáveis de fronteira de domínio, independentemente do número de entidades do projeto. A escala
pequena decide a profundidade da separação, não se ela existe.

**Users** (identidade): quem são os utilizadores, e pesquisá-los por `username`. Não sabe nada
sobre reuniões, convites ou conflitos de horário.

**Meetings** (agendamento): criar reuniões, convidar, aceitar/recusar, decidir conflitos de
horário. Conhece os utilizadores só pelo `id`.

**Costura deliberada entre os dois, mantida e documentada em vez de escondida:**
`meetingRepository.findByIdWithDetails()` usa `.populate()` do Mongoose para ir buscar
`name`/`username` diretamente da coleção de Users, evitando um pedido extra ao mostrar o
detalhe de uma reunião. Uma separação mais rigorosa exigiria um read model próprio ou uma
chamada explícita ao `userRepository`; dada a escala (dois campos, sem necessidade de
desacoplar as bases de dados), o `.populate()` mantém-se como exceção consciente à fronteira.
Isto é também a razão pela qual `participants[].userId` chega ao frontend com formas diferentes
consoante o endpoint — string crua em `GET /meetings`, objeto `{ _id, name, username }` em
`GET /meetings/:id` — e porque o frontend trata os dois casos de forma diferente e deliberada
(ver `MeetingsScreen.jsx` vs. `MeetingDetailModal.jsx`).

## Ronda 1 — pastas por domínio: `users/` vs `meetings/`

**Antes:** o backend estava organizado por **camada técnica** (`models/`, `repositories/`,
`routes/`, `domain/`, `utils/`), com `User` e `Meeting` misturados dentro de cada pasta.

**Depois:** reorganização para `users/` e `meetings/`, cada uma com o seu modelo, repositório e
rotas; `shared/objectId.js` para a única peça sem vocabulário de negócio (validação de formato
de ObjectId, usada por ambos); `middleware/currentUser.js` ficou fora de `users/` por ser
pipeline HTTP (ler o header `X-User-Id`), não lógica de domínio.

**Efeito colateral positivo:** a consolidação em `conflictService.js` eliminou a duplicação de
lógica que existia entre `POST /meetings` (auto-aceite do organizador) e `PATCH /invites`
(aceitar um convite) — ambos tinham praticamente a mesma query + verificação de overlap
escritas separadamente.

**Fora do âmbito desta ronda:** o frontend não foi tocado — o contrato da API não mudou, só a
organização interna do backend.

## Ronda 2 — modelo rico + domínio Scheduling + frontend por domínio

Feedback de revisão apontou que separar por pastas de domínio não bastava: os modelos
continuavam anémicos (só schema, sem comportamento — quem decidia e alterava `participants` era
sempre código de fora, nas rotas), e o frontend nunca tinha sido reorganizado da mesma forma.

**1. `Meeting` deixa de ser anémico.** Ganhou métodos de instância que respondem a perguntas
sobre o seu próprio estado e o alteram, em vez de expor `participants` para quem chama mexer à
vontade:

| Método | Substitui, nas rotas |
| --- | --- |
| `findParticipant(userId)` | `participants.find(...)` repetido em 3 sítios |
| `isOrganizer(userId)` / `hasAccess(userId)` | verificação manual de acesso em `GET /:id` |
| `isAcceptedBy(userId)` / `isPendingFor(userId)` | filtros manuais em `GET /` |
| `respondToInvite(userId, status)` | `participant.status = status` direto, em `PATCH /invites` |

Fica deliberadamente fora do modelo: decidir *se* aceitar um convite entra em conflito de
horário — essa regra cruza vários agregados `Meeting` ao mesmo tempo (a candidata contra outras
reuniões do mesmo utilizador), e um agregado sozinho não tem essa informação.

**2. `scheduling/` como domínio próprio, separado de `meetings/`.** `overlap.js` e
`conflictService.js` saíram de `meetings/` para `scheduling/` — não é só mudar de pasta: a
lógica já era genérica sobre `{ date, startTime }`, nunca conheceu o conceito de "reunião". É
uma regra sobre qualquer bloco de tempo que um utilizador ocupe, não sobre `Meeting`
especificamente. `meetings/routes.js` continua a ser o único ponto que liga os dois domínios:
chama `hasConflict()` do Scheduling antes de decidir se `Meeting.respondToInvite()` pode ser
chamado.

**3. Frontend reorganizado por domínio.** `components/`, `hooks/`, `api/` (pastas por tipo
técnico, com Meetings e Users misturados) passaram a `features/meetings/` e `features/users/`,
cada uma com o seu `api.js`, `components/` e `hooks/`. `shared/` ficou só com o que é
genuinamente transversal — `apiFetch.js` e `RequestState.jsx`. O único import entre domínios no
frontend (`useCreateMeetingForm` a chamar `useUserSearch`) é o paralelo direto do único
cross-domínio do backend (`meetings/routes.js` a chamar `users/userRepository.js`).

As mudanças de fundo desta ronda (DDD tático aplicado, mapeamento dos conceitos) estão
detalhadas em `SPEC.md`, secções 8 e 9.

## Estrutura final

> Final destas duas rondas. Mudanças posteriores (ficheiros `*Model.js`, `InviteStatus.js`,
> `commitmentPolicy.js`, e `scheduling/` com `TimeSlot.js` e `Agenda.js`) estão em `SPEC.md` §15-§19.

```
backend/src/
├── users/
│   ├── User.js
│   ├── userRepository.js
│   └── routes.js
├── meetings/
│   ├── Meeting.js
│   ├── Meeting.test.js
│   ├── meetingRepository.js
│   └── routes.js
├── scheduling/
│   ├── overlap.js
│   ├── overlap.test.js
│   ├── conflictService.js
│   └── conflictService.test.js
├── shared/
│   └── objectId.js
├── middleware/
│   └── currentUser.js
├── app.js
├── db.js
├── server.js
└── seed.js

frontend/src/
├── features/
│   ├── meetings/
│   │   ├── api.js
│   │   ├── components/   (MeetingCard, MeetingDetailModal, MeetingsScreen, CreateMeetingModal, StatusBadge)
│   │   └── hooks/        (useMeetings, useMeeting, useCreateMeeting, useCreateMeetingForm, useRespondToInvite)
│   └── users/
│       ├── api.js
│       └── hooks/        (useUserSearch)
├── shared/
│   ├── apiFetch.js
│   └── components/RequestState.jsx
└── App.jsx / main.jsx / constants.js / index.css
```

## Verificação

Confirmado após as duas rondas, contra esta estrutura final:

- **Integridade estrutural** — as pastas acima existem com exatamente estes ficheiros; as
  antigas `models/`, `repositories/`, `domain/`, `routes/`, `utils/` já não existem.
- **Imports** — nenhuma referência a caminhos antigos (`../models/`, `../repositories/`,
  `../domain/`, `../utils/`) resta no código; `meetings/routes.js` importa `userRepository` de
  `../users/userRepository.js` (o único cross-domínio legítimo).
- **Testes automáticos** — `npm test` no backend: **20/20 a passar** (12 de `scheduling/`:
  `overlap.test.js` + `conflictService.test.js`, mais 8 de `meetings/Meeting.test.js`, sem
  ligação a base de dados).
- **Build do frontend** — `npm run build` limpo, sem erros; comportamento visível inalterado
  (mesma UI, mesmos endpoints consumidos).
- **Contrato da API** — mesmos URLs, métodos e formas de resposta antes e depois das duas
  rondas; a costura `.populate()` em `GET /meetings/:id` continua a devolver `organizerId` e
  `participants[].userId` como objetos com `name`/`username`, não strings.
- **Higiene de git** — trabalho feito fora de `main`; nada commitado ou enviado
  automaticamente como parte da reestruturação.

Documentação atualizada em consequência: `SPEC.md` (secções 8 e 9) e a secção "Arquitetura do
backend" do `README.md` refletem a estrutura final acima, não os passos intermédios.

# Exercício de validação Buildtoo

Aplicação de gestão de reuniões entre utilizadores. `React` (frontend) + `Node.js`/`Express`/`MongoDB` (backend).

## Como executar

### Pré-requisitos
- `Node.js` (v18 ou superior)
- Uma base de dados `MongoDB` — conta gratuita no [MongoDB Atlas](https://mongodb.com/cloud/atlas)

### 1. Backend

    cd backend
    npm install

Copiar .env.example para .env e preencher a connection string:

    MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/buildtoo
    PORT=3000

Popular a base de dados com dados iniciais:

    npm run seed

**Importante:** este comando imprime no terminal o ID do utilizador fixo (Ana Silva), por exemplo:

    Utilizador fixo (usar em X-User-Id): 6a993aadec0db327f78dbcdf — Ana Silva

Copiar esse ID (vai ser necessário no passo do frontend).

Arrancar o servidor:

    npm run dev

A API fica disponível em http://localhost:3000

### 2. Frontend

Com o backend já a correr, noutro terminal:

    cd frontend
    npm install

Copiar .env.example para .env , confirmar que VITE_API_URL aponta para http://localhost:3000 e colar o ID do utilizador fixo copiado no passo anterior em VITE_FIXED_USER_ID:

    VITE_API_URL=http://localhost:3000
    VITE_FIXED_USER_ID=<ID copiado do seed>
    VITE_FIXED_USER_NAME=Ana Silva

Arrancar a aplicação:

    npm run dev

Abrir http://localhost:5173 no browser.

### Testes (backend)

    cd backend
    npm test

## Decisões técnicas

> As secções abaixo descrevem a entrega inicial. Algumas foram atualizadas depois, em duas
> rondas de feedback de revisão: primeiro a extração do componente `StatusBadge` partilhado, a
> reestruturação do backend com padrões de Domain-Driven Design, e a adoção do React Query com
> separação de lógica de formulário no frontend; depois, numa segunda ronda, dar comportamento
> aos modelos de domínio (deixavam de ser anémicos), extrair `scheduling/` como domínio próprio
> no backend, e reorganizar o frontend por domínio em vez de por camada técnica — ver
> "Arquitetura do backend" e "Stack do frontend" abaixo, e `DOMAIN_MIGRATION.md` para o
> detalhe completo de todo o histórico da migração.

### Autenticação

Não há autenticação real, cada pedido à API identifica-se através do header `X-User-Id`, sempre com o mesmo valor: o ID de um utilizador previamente definido (Ana Silva). 

Optei por esta abordagem para não gastar tempo que poderia faltar para aplicar no foco do exercicio: a regra de negócio de conflito de horários.

### Modelo de dados

- **User**: `name` (nome apresentado na UI) e `username` (identificador único, usado para pesquisa).
- **Meeting**: `title`, `description`, `date`, `startTime`, `organizerId` (referência ao organizador) e `participants` — um array de `{ userId, status }`, onde `status` é `pending`, `accepted` ou `declined`. O organizador é incluído automaticamente neste array, já com `status: 'accepted'`.

### Tipagem: JSDoc, não TypeScript completo

Usei JSDoc (`@typedef`, `@param`, `@returns`) nos ficheiros mais críticos — os modelos `User`/`Meeting` e a função de conflito, pois pesquisei e conclui que poderia ser uma mais valia no processo de desenvolvimento do código: avisa de incompatibilidades de forma enquanto o código é escrito, mas **não tem efeito nenhum em tempo de execução** — não valida nada quando a aplicação está a correr. Essa validação a sério (campos obrigatórios, tipos, valores permitidos) é feita pelo `Mongoose`, através do schema. Optámos por não adotar `TypeScript` completo no projeto para não acrescentar uma curva de aprendizagem extra, dado o tempo disponível e a falta de experiência prévia em `JavaScript`/`React`.

### A matemática da sobreposição

A fórmula em `scheduling/TimeSlot.js` (`TimeSlot.overlaps()`, inalterada desde a entrega inicial):
```
A.overlaps(B) = A.inicio < B.fim && B.inicio < A.fim
```
Cobre os três casos possíveis — sem sobreposição, sobreposição total e sobreposição parcial. É lógica pura, sem acesso a nada do resto da aplicação, o que a torna fácil de testar isoladamente.

### Arquitetura do backend: Domain-Driven Design (organização por domínio)

O backend aplica os padrões táticos do DDD proporcionais à escala do projeto (entidade, objeto
de valor, agregado, serviço de domínio, repositório), organizado em três **domínios de
negócio** — `users/`, `meetings/` e `scheduling/` — em vez de por camada técnica (decisão
detalhada em `SPEC.md`, secções 8 a 18; o histórico das duas rondas de revisão que levaram a
esta estrutura está em `DOMAIN_MIGRATION.md`). `scheduling/` é o Core Subdomain do projeto (a
regra de negócio principal do enunciado); `meetings/` é Supporting; `users/` é Generic — ver
`SPEC.md` §10 para a classificação completa e para a razão de as rotas serem chamadas Serviço
de Aplicação, não só "controladores finos". `Meeting`/`User` também deixaram de depender do
Mongoose diretamente — são classes de domínio simples, com o schema de persistência à parte em
`MeetingModel.js`/`UserModel.js` (`SPEC.md` §15), para a camada de Domínio ficar isolada de
infraestrutura como o capítulo 4 do livro do Evans pede.

- **`users/`** (identidade) — `User.js`, `userRepository.js` (esconde as queries Mongoose atrás
  de nomes que refletem o vocabulário do negócio) e `routes.js`. Não sabe nada sobre reuniões
  nem conflitos de horário.
- **`meetings/`** (agendamento) — `Meeting.js` é um agregado com comportamento próprio:
  `findParticipant`, `isOrganizer`, `hasAccess`, `isAcceptedBy`, `isPendingFor` e
  `respondToInvite` protegem o seu próprio estado; `routes.js` já não lê nem escreve
  `participants` diretamente, pergunta ao agregado. `meetingRepository.js` esconde as queries
  Mongoose (`findForUser`, `findAgendaOf`, etc.). É também dono da duração fixa de 1h e de
  converter data + hora de início num bloco de tempo (`Meeting.timeSlot()`).
- **`scheduling/`** (conflito de horário) — `TimeSlot.js` e `Agenda.js`, dois Value Objects; um
  domínio à parte, não uma pasta dentro de Meetings, porque a lógica é genérica sobre blocos de
  tempo e não conhece o conceito de "reunião", nem a sua duração. A `Agenda` de um utilizador
  decide se um bloco de tempo candidato entra em conflito com os que ele já aceitou
  (`agenda.conflictsWith(slot)`) — uma regra que cruza vários agregados `Meeting`, por isso não
  é método do agregado (até à `SPEC.md` §18 vivia num serviço de domínio, `conflictService`).
  `meetings/routes.js` consulta a agenda antes de chamar `Meeting.respondToInvite()`.
- **`shared/objectId.js`** — validação de formato de ObjectId, partilhada pelos três domínios; a
  única peça sem vocabulário de negócio.
- **`middleware/`** — inalterado; fica fora de `users/` porque a sua função é pipeline HTTP, não
  lógica de domínio.

`meetingRepository.findByIdWithDetails()` usa `.populate()` do Mongoose para ir buscar
`name`/`username` de Users ao mostrar o detalhe de uma reunião — a única dependência direta de
Meetings sobre dados de Users, mantida por ser proporcional à escala (dois campos) e
documentada como exceção consciente, não escondida.

Os termos do domínio (agenda, bloco de tempo, convite, etc.) e o identificador de cada um no
código estão em `GLOSSARY.md`, junto com as assunções que ainda precisam de ser confirmadas por
um especialista do domínio.

O contrato da API não mudou com esta reestruturação — mesmos URLs, métodos e formas de
resposta; verificado com os testes automáticos (hoje 35/35 a passar, incluindo
`meetings/Meeting.test.js`, sem base de dados) e testes manuais a todos os endpoints.

### `hasConflict` calculado no backend

O `GET /meetings` devolve, para cada reunião com o convite `pending`, um campo `hasConflict` já calculado pelo servidor (pela `Agenda` do utilizador), e para todas um campo `myInviteStatus` com o estado do convite do utilizador atual. O frontend mostra esse aviso diretamente, sem reimplementar a lógica — assim existe uma única fonte de verdade para a regra mais importante do projeto, em vez de duas versões (backend e frontend) que um dia poderiam divergir.

### Stack do frontend

`React` + `Vite` + `Mantine` (biblioteca de componentes, para não escrever CSS à mão).

A interface tem um único ecrã de reuniões, com separadores "Pendentes" e "Todas", em vez de páginas separadas — reduz a estrutura (uma rota, um fetch, um conjunto de estados de loading/vazio/erro) sem confundir "o que precisa da minha ação" e "o histórico completo".

**Gestão de dados: React Query (atualizado pós-feedback).** O projeto inicial usava `fetch` simples com hooks manuais (`useState`/`useEffect`), para manter a curva de aprendizagem baixa. Após feedback entendi que era relevante implementar uma solução de state management/data-fetching. Outro erro cometido foi misturar a lógica de loading/erro/refetch dentro dos componentes. Os dois problemas foram resolvidos ao mesmo tempo pelo `@tanstack/react-query`:
- `useMeetings`, `useMeeting`, `useUserSearch` mantêm os mesmos nomes e forma de usar, mas por dentro usam `useQuery`: cache, revalidação e deduplicação de pedidos de raiz.
- Aceitar/recusar convite e criar reunião passam a `useMutation`, invalidando a query `['meetings']` no sucesso em vez de `refetch()` manuais.
- `api/meetings.js`, `api/users.js` e `apiFetch.js` ficaram inalterados: o React Query usa-os como estão.

**Separação de lógica e UI (atualizado pós-feedback).** A validação e gestão de campos do formulário de criar reunião, antes misturada com o JSX do `CreateMeetingModal.jsx`, está agora isolada num hook próprio (`useCreateMeetingForm`) — o componente ficou reduzido a apresentação.

**Organização por domínio, não por camada (atualizado numa segunda ronda de feedback).** `components/`, `hooks/` e `api/` eram pastas por tipo técnico, com ficheiros de Meetings e de Users misturados dentro de cada uma — o único lado da aplicação sem nenhuma organização por domínio, quando o backend já tinha `users/` vs `meetings/` (ver acima). Passaram a `features/meetings/{api.js,components/,hooks/}` e `features/users/{api.js,hooks/}`, com `shared/` só para o que é mesmo transversal aos dois: `apiFetch.js` e `RequestState.jsx`. O único import entre domínios (`useCreateMeetingForm` a chamar `useUserSearch`) é o paralelo direto do único cross-domínio do backend. Sem mudança de comportamento — build com os mesmos hashes de asset de antes desta reorganização. Detalhe em `DOMAIN_MIGRATION.md`.

### CORS e tratamento de erros assíncronos

Duas correções feitas numa primeira revisão ao backend, antes de qualquer feedback:

- **`CORS`**: por defeito, o browser bloqueia pedidos entre origens diferentes (o `React` em `localhost:5173`, a API em `localhost:3000` contam como origens diferentes, mesmo sendo ambos "localhost"). Adicionei o middleware `cors()` para permitir explicitamente estes pedidos.
- **Erros assíncronos**: no `Express` 4, um erro lançado dentro de uma função de rota `async` não chega automaticamente ao middleware de tratamento de erros — é uma limitação conhecida desta versão. Acrescentei `express-async-errors`, que corrige isto, garantindo que erros inesperados do servidor mostram sempre uma resposta de erro tratada, em vez de ficarem sem resposta.

## Assunções

- O organizador de uma reunião fica automaticamente convidado e aceite nela — não precisa de a aceitar separadamente.
- Só o organizador pode convidar participantes, e só no momento em que cria a reunião — não há edição de participantes depois de criada.
- Um utilizador só pode ter um convite para cada reunião.
- Convites **pendentes** não contam para efeitos de conflito de horário — só convites já **aceites**. Assim, posso continuar a receber convites sobrepostos entre si, e só sou impedido de aceitar um deles se já tiver outro aceite no mesmo período.
- A data e a hora de início de uma reunião não podem estar no passado (valido a combinação das duas, não só a data).
- Todos os campos de uma reunião (título, descrição, data, hora) são de preenchimento obrigatório.
- "As minhas reuniões" inclui tanto as que organizei como aquelas para que fui convidado, independentemente do estado do convite.
- A pesquisa de utilizadores é feita pelo `username`, não pelo nome.

## Se tivesses mais tempo

- **Autenticação real**: numa aplicação em produção, substituiria o utilizador fixo por um sistema de contas a sério — registo, palavras-passe com hash (nunca em texto simples), e sessão/token para manter o login entre pedidos. Não o fiz aqui porque o próprio enunciado desaconselha investir tempo nisso, e o foco do exercício está na regra de conflito de horários.
- **Concorrência**: a verificação de conflito faz leitura e escrita sem qualquer tipo de bloqueio — em teoria, dois pedidos de aceitação em simultâneo, para reuniões que se sobrepõem, poderiam ambos passar a verificação antes de qualquer um gravar o resultado. Resolveria isto com uma transação do MongoDB.
- **Distribuição do projeto**: adicionaria um `docker-compose.yml` com uma instância local do MongoDB, para quem for avaliar isto não depender das minhas credenciais pessoais do Atlas.
- **Mais testes**: atualmente só a lógica pura tem testes automáticos — `TimeSlot.js`, `Agenda.js` (domínio Scheduling) e o comportamento do agregado `Meeting` (`meetings/Meeting.test.js`). Adicionaria testes de integração às rotas, sobretudo à verificação de conflito no `POST /meetings` e no `PATCH /invites`.
- **Escalabilidade da pesquisa de utilizadores**: com a lista de utilizadores pequena, o endpoint devolve todos quando a pesquisa está vazia. Numa aplicação com muitos mais utilizadores, adicionaria paginação ou um mínimo de caracteres antes de pesquisar.

## Ferramentas de IA

Usei o **Claude Code** (aplicação desktop e extensão do VS Code) ao longo de todo o processo, mas com uma divisão clara: as decisões de arquitetura, modelo de dados e regras de negócio foram discutidas e fechadas por mim antes de qualquer código ser escrito, documentadas em `SPEC.md` e `FRONTEND_SPEC.md` — a IA implementou a partir dessas decisões.

Usei-a também para me explicar conceitos que desconhecia por completo (React, Node.js, Express, HTTP, Mongoose), já que não tinha experiência relevante nestas tecnologias.

Um exemplo concreto de revisão que fiz ao código gerado: desconfiei e identifiquei, com apoio da IA, que a regra de conflito de horários só estava a ser verificada no momento de aceitar um convite (`PATCH /invites`), mas não quando o próprio organizador é automaticamente aceite na reunião que cria (`POST /meetings`) — o que permitia, na prática, criar duas reuniões próprias que se sobrepunham sem nenhum aviso. Corrigi isto aplicando uma verificação também nesse ponto.

Um segundo exemplo: ao fazer uma verificação final e completa de todos os fluxos antes do merge, identifiquei que a lista de sugestões de participantes ao criar uma reunião não tinha nenhum estado para quando a pesquisa não encontra ninguém — ao contrário das listas de reuniões, que já usavam esse padrão (`EmptyState`). Corrigi isto antes de fazer merge novamente.

Numa terceira ronda, feedback de revisão apontou que a separação em pastas por domínio (`users/`/`meetings/` no backend) não bastava por si só — os modelos continuavam sem comportamento, e o frontend nunca tinha sido reorganizado da mesma forma. Discuti este feedback com a IA para perceber com precisão o que estava a faltar (modelo anémico vs. comportamento no agregado, e a organização do frontend por camada técnica em vez de domínio), e implementei com o seu apoio as mudanças documentadas em `DOMAIN_MIGRATION.md`.

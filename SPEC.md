# Spec — Gestão de reuniões (Buildtoo)

Documento de decisões técnicas do backend, fechado antes de qualquer implementação.
Serve de base direta para as secções "Decisões técnicas" e "Assunções" do README final.

> As secções 1-7 descrevem a entrega inicial. As secções 8 e 9 foram acrescentadas depois, em
> duas rondas de feedback de revisão — a estrutura de pastas e a tabela de conceitos na secção 8
> refletem o estado logo após a primeira ronda; a secção 9 corrige isso com a extração de
> `scheduling/`, e `DOMAIN_MIGRATION.md` tem a estrutura final.

## 1. Modelo de dados

### User
| Campo | Tipo | Notas |
|---|---|---|
| `name` | string | nome apresentado na UI |
| `username` | string | único, usado para pesquisa/identificação |

### Meeting
| Campo | Tipo | Notas |
|---|---|---|
| `title` | string | obrigatório |
| `description` | string | obrigatório |
| `date` | string (data) | obrigatório, não pode estar no passado |
| `startTime` | string (hora) | obrigatório; duração fixa de 1h (não é campo guardado, é assumida) |
| `organizerId` | string (ref. User) | quem criou a reunião |
| `participants` | `[{ userId: string, status: 'pending' \| 'accepted' \| 'declined' }]` | inclui o organizador (ver Assunções) |

## 2. Autenticação

**Decisão:** utilizador previamente definido (fixo, sem login).

**Porquê:** o enunciado desencoraja explicitamente investir tempo significativo em autenticação, e o foco real deste exercício é a correção da lógica de conflito de horários. Um único utilizador fixo é suficiente para demonstrar todas as funcionalidades obrigatórias, desde que a base de dados tenha outros utilizadores seed para pesquisar/convidar e pelo menos uma reunião já aceite para o utilizador fixo, para o conflito ser demonstrável sem ter de ser fabricado manualmente.

**Nota técnica:** a API recebe o identificador do utilizador atual via header (`X-User-Id`), mesmo sendo sempre o mesmo valor — mantém o backend desacoplado e testável independentemente do mecanismo de autenticação escolhido no frontend.

## 3. Endpoints

| Método | URL | Propósito | Quem pode chamar |
|---|---|---|---|
| `GET` | `/users?q=texto` | pesquisar utilizadores por username | qualquer utilizador |
| `GET` | `/meetings` | consultar reuniões do utilizador atual (organizadas + convidado, todos os estados) | utilizador atual |
| `POST` | `/meetings` | criar reunião | organizador (autor do pedido) |
| `GET` | `/meetings/:id` | detalhes da reunião, incluindo participantes e estado dos respetivos convites | participante ou organizador da reunião |
| `PATCH` | `/meetings/:id/invites/:userId` | aceitar ou recusar um convite | o próprio utilizador do convite |

Não existe endpoint de cancelamento — não é funcionalidade obrigatória do enunciado.

## 4. Regra de conflito

```
function overlap(A, B):
    return A.inicio < B.fim && B.inicio < A.fim

conflito = overlap(reuniaoNova, reuniaoJaAceite)
```

**Alcance:**
- Verificada no momento de **aceitar** um convite, e também na **criação** de uma reunião — porque o organizador fica automaticamente aceite na própria reunião (ver Assunções), esse auto-accept teria de passar pela mesma verificação, senão contornava a regra. Não é verificada para convites pendentes de outros participantes na criação — só o organizador é confrontado nesse momento.
- Compara sempre a reunião candidata contra reuniões **já aceites** desse mesmo utilizador — convites pendentes não entram na verificação.
- É uma regra por utilizador: dois utilizadores diferentes podem ter reuniões sobrepostas sem restrição.

## 5. Assunções

- O organizador é automaticamente convidado **e aceite** na própria reunião.
- Só o organizador pode convidar participantes, e apenas no momento da criação (não há edição de participantes depois).
- Um utilizador só pode ter um convite por reunião (sem duplicados).
- Convites pendentes não contam para efeitos de conflito — só convites já aceites.
- Data e hora de início não podem estar no passado (validação combinada, não só a data).
- Todos os campos da reunião são de preenchimento obrigatório.

## 6. Prioridades

**P0 (crítico — sem isto não há entrega):**
- Criar uma reunião
- Pesquisar utilizadores
- Consultar reuniões (minhas)
- Aceitar ou recusar um convite
- Regra de conflito correta nos 3 casos: sem sobreposição, sobreposição total, sobreposição parcial

**P1 (importante, mas simplificável se faltar tempo):**
- Consultar detalhes de uma reunião (inclui participantes e estado dos convites — vem incluído na mesma chamada, sem custo extra)
- Estados de loading / ausência de resultados / erro

**Fora do MVP inicial (extras opcionais do enunciado, só se sobrar tempo):**
Docker, paginação, filtros, documentação da API, testes e2e, tratamento explícito de race conditions.

## 7. Stack e tipagem

- **Backend:** Node.js + Express + MongoDB (Mongoose)
- **Tipagem:** JSDoc (`@typedef`, `@param`, `@returns`) aplicado a `User`, `Meeting` e à função `overlap` — o código mais crítico e mais reutilizado. Resto do backend em JavaScript simples, sem anotações.
- **Fronteira HTTP** (`req.body`/`req.params`): não protegida por tipos — protegida por testes automatizados, já que nenhum sistema de tipos (incluindo TypeScript completo) garante a forma de dados vindos de fora da aplicação.
- **Frontend:** React — decisões de UI/UX e bibliotecas a fechar em spec separada.

## 8. Arquitetura do backend — atualização pós-feedback (Domain-Driven Design)

**Decisão:** aplicar os padrões táticos do Domain-Driven Design relevantes à escala deste
projeto (entidade, objeto de valor, agregado, serviço de domínio, repositório) e organizar o
código por **domínio de negócio** — `users/` e `meetings/` — em vez de por camada técnica.

**Porquê (tático):** feedback de revisão apontou a ausência de alinhamento com a direção
arquitetural discutida previamente. As peças táticas resolvem um problema concreto já
identificado: a lógica de conflito estava duplicada entre `POST /meetings` e `PATCH /invites`,
e misturada com acesso direto ao Mongoose dentro das rotas.

**Porquê (estratégico — revisão):** uma primeira leitura desta decisão concluiu que, com duas
entidades e uma regra de negócio central, o design estratégico do DDD (bounded contexts) não se
aplicava de forma útil, por não haver conflito de significado no mesmo termo entre partes da
aplicação — a leitura mais estrita de "bounded context". Essa conclusão não considerou a leitura
mais prática: separar por área de responsabilidade de negócio, independentemente de haver ou não
conflito de termos. O próprio modelo de dados já apontava para essa separação — `Meeting`
referencia `User` sempre por `ObjectId` (`organizerId`, `participants[].userId`), nunca por
dados embutidos, o que é um dos sinais mais fiáveis de fronteira de domínio. Escala pequena
decide a profundidade da separação, não se ela existe — por isso a estrutura foi revista para
refletir os dois domínios explicitamente.

**Linguagem ubíqua:** os termos usados no código refletem diretamente o vocabulário do negócio,
sem tradução — "aceitar convite", "conflito de horário", "organizador", "participante" aparecem
tal como no enunciado, tanto no código como na documentação.

**Estrutura:**
```
backend/src/
├── users/
│   ├── User.js
│   ├── userRepository.js
│   └── routes.js
├── meetings/
│   ├── Meeting.js
│   ├── meetingRepository.js
│   ├── conflictService.js
│   ├── conflictService.test.js
│   ├── overlap.js
│   ├── overlap.test.js
│   └── routes.js
├── shared/
│   └── objectId.js          ← isValidId, sem vocabulário de negócio, partilhado pelos dois domínios
├── middleware/
│   └── currentUser.js        ← pipeline HTTP, não lógica de domínio (por isso não vive em users/)
├── app.js
├── db.js
├── server.js
└── seed.js
```

**Mapeamento dos conceitos aplicados:**

| Conceito | No projeto | Aplicado? |
|---|---|---|
| Entidade | `User`, `Meeting` | Sim |
| Objeto de valor | `{ start, end }` de `toRange()` | Sim |
| Agregado | `Meeting` + `participants` embutidos | Sim |
| Serviço de domínio | `meetings/conflictService.js` | Sim |
| Repositório | `users/userRepository.js`, `meetings/meetingRepository.js` | Sim |
| Bounded Context | `users/` vs. `meetings/` | Sim — dois domínios, separados por pasta e por responsabilidade **(errado — corrigido na §19: são Módulos de um só Bounded Context)** |
| Evento de domínio | — | Não aplicado — não há efeitos secundários/notificações no projeto |

> Estrutura e tabela acima refletem o estado logo após esta primeira ronda. A secção 9 (abaixo)
> extrai `scheduling/` de `meetings/`, o que move a linha "Serviço de domínio" para lá e torna
> "Bounded Context" três domínios, não dois — ver `DOMAIN_MIGRATION.md` para a estrutura final.

**Costura deliberada entre os dois domínios:** `meetingRepository.findByIdWithDetails()` usa
`.populate()` do Mongoose para ir buscar `name`/`username` diretamente à coleção de Users,
evitando um pedido extra ao mostrar o detalhe de uma reunião. Uma separação mais rigorosa
exigiria um read model próprio ou uma chamada explícita ao `userRepository`; dada a escala (dois
campos, sem necessidade de desacoplar as bases de dados), mantém-se o `.populate()` como exceção
consciente à fronteira, documentada em vez de escondida.

**Efeito colateral positivo:** a consolidação em `conflictService.js` elimina a duplicação entre
`POST /meetings` e `PATCH /invites` (ambos tinham praticamente a mesma query + verificação de
overlap escritas separadamente).

**Numa aplicação real:** se o sistema crescesse para incluir outros domínios (faturação,
notificações, um painel de administração com preocupações diferentes), cada um ganharia a sua
própria pasta seguindo o mesmo padrão — e seria nesse ponto que eventos de domínio (para
comunicação assíncrona entre domínios) passariam a justificar-se.

**Sem mudança:** o contrato da API não muda — mesmos URLs, métodos e formas de resposta. Esta é
uma reorganização interna, o frontend não precisa de nenhuma alteração por causa disto.

## 9. Arquitetura do backend — atualização pós-segunda revisão (modelo rico + domínio Scheduling)

**Decisão:** dar comportamento a `Meeting` (em vez de só schema) e extrair `overlap.js` +
`conflictService.js` de `meetings/` para um `scheduling/` próprio.

**Porquê:** a secção 8 acima organizou as pastas por domínio, mas isso sozinho não é DDD tático
— os modelos continuavam anémicos (sem métodos, todo o comportamento vivia nas rotas) e não
havia reconhecimento de que a regra de conflito é, ela própria, um domínio à parte (Scheduling),
não uma função interna de Meetings. Detalhe completo, com o mapeamento rota-a-rota do que mudou
e porquê, em `DOMAIN_MIGRATION.md`.

**Em resumo:** `Meeting` ganhou `findParticipant`, `isOrganizer`, `hasAccess`, `isAcceptedBy`,
`isPendingFor` e `respondToInvite` — as rotas já não leem nem escrevem `participants`
diretamente, perguntam ao agregado. `scheduling/` (novo) é independente do conceito de
"reunião" — opera sobre `{ date, startTime }` genéricos, e é por isso que é um domínio à parte,
não uma pasta a mais dentro de `meetings/`. Testado em `meetings/Meeting.test.js` (8 testes,
sem base de dados).

**Sem mudança:** contrato da API igual; comportamento da aplicação igual (build/testes
confirmam-no em `DOMAIN_MIGRATION.md`).

## 10. Classificação de subdomínios e nomeação do Serviço de Aplicação

**Decisão:** classificar explicitamente os três domínios como Core/Supporting/Generic Subdomain,
e nomear as rotas Express como Serviço de Aplicação (Application Service) — dois conceitos do
catálogo estratégico/tático de DDD que já eram verdade na estrutura existente, só nunca tinham
sido escritos com estes nomes.

**Porquê:** ao rever este projeto à luz de um catálogo mais completo de padrões DDD (fora do
âmbito do enunciado e das rondas de revisão anteriores), ficou claro que dois conceitos —
Subdomínio e Serviço de Aplicação — já estavam implicitamente presentes: a divisão em três
domínios e as rotas finas já cumpriam este papel, só nunca tinham sido nomeados. Nomear o que já
é verdade não muda comportamento nenhum; torna a intenção explícita.

**Classificação dos subdomínios:**

> **Revista na secção 19:** a tabela abaixo classifica pastas inteiras, e põe a matemática da
> sobreposição no Core. A §19 corrige isso: o Core é a política de compromissos
> (`meetings/commitmentPolicy.js` + `scheduling/Agenda.js`), e `TimeSlot` é um Cohesive Mechanism.

| Domínio | Classificação | Porquê |
|---|---|---|
| `scheduling/` | **Core Subdomain** | É a razão de ser do exercício — a secção 4.1 do enunciado chama-lhe "regra de negócio principal", a única regra tratada como obrigatória e central. |
| `meetings/` | **Supporting Subdomain** | Necessário para o Core existir (não há conflito sem reuniões), mas não é ele próprio o problema difícil — a complexidade real está na regra que `scheduling/` decide. |
| `users/` | **Generic Subdomain** | Identidade e pesquisa por username resolvem-se da mesma forma em praticamente qualquer aplicação — nada aqui é específico deste negócio. |

**Serviço de Aplicação:** `users/routes.js` e `meetings/routes.js` desempenham o papel de
Application Service — leem o pedido HTTP, chamam o repositório e/ou serviço de domínio certo,
devolvem a resposta, e nunca decidem uma regra de negócio por conta própria. A distinção que
importa manter: um Serviço de Aplicação *orquestra*; quem *decide* é sempre
`scheduling/conflictService.js` ou os métodos do agregado `Meeting`.

**Fora do âmbito, e porquê** *(revisto na §19 e em `CONTEXT_MAP.md`: dentro do backend há um só
contexto, por isso de facto não há padrões a aplicar entre `users/` e `meetings/`; mas há relações
reais com contextos de fora — o frontend e a identidade — que este parágrafo não considerou)*: o
Mapa de Contexto (Context Map) não ganha aqui nenhum dos padrões
nomeados (Shared Kernel, Conformist, Anticorruption Layer, etc.) — esses descrevem relações entre
equipas ou sistemas diferentes, e este projeto é um único código, uma pessoa. Rotular a leitura de
`meetings` a `users` com um desses nomes seria inventar complexidade organizacional que não
existe. A relação fica descrita de forma mais honesta como está — `meetings` depende de `users`
(upstream/downstream), sem um padrão decorado por cima.

**Sem mudança:** nenhuma linha de código foi alterada por esta secção — é só vocabulário mais
preciso sobre uma estrutura que já existia.

## 11. Domain Vision Statement

**Decisão:** registar, num parágrafo curto e sem vocabulário técnico, o porquê deste sistema
existir — separado de qualquer spec de implementação.

**Porquê:** ao comparar o projeto com a Parte IV completa do livro do Evans (Estratégico), esta
peça (capítulo 15, Distillation) ficou identificada como ausente e barata de acrescentar — não
muda nada no código, só torna explícito o valor que o Core Domain entrega.

> O coração desta aplicação é garantir que ninguém fica preso, sem dar por isso, entre duas
> responsabilidades que assumiu ao mesmo tempo. Pesquisar pessoas, criar reuniões, ver o estado
> de um convite — tudo isso existe para dar a um utilizador a informação de que precisa para
> decidir bem. A única decisão que o sistema toma sozinho, sem pedir confirmação a ninguém, é
> impedir que essa mesma pessoa aceite, sem reparar, duas reuniões que não podem coexistir na
> sua agenda. Esse impedimento — não a gestão de reuniões em si — é a razão de ser do projeto.

## 12. Highlighted Core

**Decisão:** um resumo condensado, isolado do resto da documentação, com só os elementos que
constituem o Core Domain — para alguém a chegar de novo ao projeto perceber o essencial sem ler
`README.md`, `SPEC.md` e `DOMAIN_MIGRATION.md` inteiros primeiro.

**Porquê:** é a técnica que o Evans chama Highlighted Core (capítulo 15) — não um modelo novo,
só uma marcação do que já existe, destacando o que é central e silenciando o resto.

**O núcleo, e nada mais:**

```
meetings/commitmentPolicy.js  → scheduleMeeting(), respondToInvite(), wouldConflict()  — a política
scheduling/Agenda.js          → Agenda.conflictsWith(candidate)                         — a agenda
meetings/Meeting.js           → agendaOf(), isAcceptedBy(), timeSlot()                  — o que conta
scheduling/TimeSlot.js        → TimeSlot.overlaps()   — mecanismo genérico usado pelo Core (Cohesive Mechanism)
```

(Atualizado pelas secções 16, 18 e 19. Até à §19, a última linha deste núcleo era "as ~6 linhas à
volta do conflito em `meetings/routes.js`" — parte do Core vivia nas rotas Express. A §19 juntou-a
em `commitmentPolicy.js`.)

Se um leitor só tivesse tempo de ler três ficheiros neste repositório antes de o avaliar, seriam
os três primeiros. Tudo o resto — `users/`, os componentes React, os hooks de React Query, os middlewares —
existe para dar a estas linhas um sítio onde correr, não para acrescentar regra de negócio nova.

## 13. Published Language

**Decisão:** formalizar o contrato de cada endpoint — pedido, resposta e erros — num formato
explícito, em vez da tabela informal da secção 3.

**Porquê:** é um padrão de Context Map do capítulo 14 (Maintaining Model Integrity) — a língua
partilhada que um Open Host Service publica para quem o consome (ver `CONTEXT_MAP.md`). *(Até à
§19 esta frase chamava-lhe, por engano, uma peça de Distillation, que é o capítulo 15.)* Liga
diretamente a "documentação da API", que o próprio enunciado lista como extra opcional
(secção 10). Formato JSON, sem introduzir OpenAPI/Swagger — proporcional à escala do projeto.

### `GET /users?q=texto`
Resposta `200`: `User[]` → `{ "_id": string, "name": string, "username": string }[]`

### `GET /meetings`
Resposta `200`: `Meeting[]`, cada um:
```json
{
  "_id": "string",
  "title": "string", "description": "string", "date": "YYYY-MM-DD", "startTime": "HH:mm",
  "organizerId": "string",
  "participants": [{ "userId": "string", "status": "pending | accepted | declined" }],
  "myInviteStatus": "pending | accepted | declined",
  "hasConflict": false
}
```
`myInviteStatus` é o estado do convite do utilizador atual nesta reunião (acrescentado na secção
18, para o frontend não ter de o procurar em `participants`).
`hasConflict` só é calculado (`true`/`false`) quando o convite do utilizador atual está
`pending`; caso contrário vem sempre `false`.

### `POST /meetings`
Pedido: `{ "title", "description", "date", "startTime", "participantIds": string[] }`
Resposta `201`: um `Meeting` (forma igual à de `GET /meetings`, sem `hasConflict`).
Erros: `400` (campo obrigatório em falta, data/hora no passado, ou data/hora inválida — formato
diferente de `YYYY-MM-DD`/`HH:mm`, ou uma data que não existe, como 30 de fevereiro), `409`
(conflito com a agenda do organizador).

### `GET /meetings/:id`
Resposta `200`: como acima, mas `organizerId` e `participants[].userId` vêm **populados** —
`{ "_id", "name", "username" }` em vez de string (ver a costura documentada na secção 10/
`DOMAIN_MIGRATION.md`).
Erros: `404` (reunião não existe), `403` (utilizador atual não é organizador nem participante).

### `PATCH /meetings/:id/invites/:userId`
Pedido: `{ "status": "accepted" | "declined" }`
Resposta `200`: o `Meeting` atualizado (forma não populada).
Erros: `400` (`status` inválido), `403` (a responder por outro utilizador, ou o organizador a
recusar a própria reunião), `404` (reunião ou convite não encontrado), `409` (aceitar entraria
em conflito de horário, ou outra pessoa alterou a reunião ao mesmo tempo — repetir o pedido).

### Todos os endpoints
Header obrigatório: `X-User-Id`. Em falta ou inválido → `401`, corpo `{ "error": "string" }` —
a mesma forma de erro em qualquer resposta não-2xx do projeto.

## 14. Módulos (nomeação)

**Decisão:** nomear explicitamente `users/`, `meetings/` e `scheduling/` como o padrão Módulos
(capítulo 5 do livro do Evans), além de já serem chamados "domínios"/"Bounded Contexts".
*(A §19 corrige esta última parte: são só Módulos, de um único Bounded Context.)*

**Porquê:** ao comparar o projeto com a Parte II completa do livro (capítulos 4-6), ficou claro
que estas três pastas cumprem também o padrão Módulos — fronteiras de pacote que seguem o modelo
conceptual, com baixo acoplamento entre pastas e alta coesão dentro de cada uma — só que o
projeto só as tinha nomeado ao nível estratégico (Bounded Context), nunca ao nível tático
(Módulos) descrito no mesmo livro. É a mesma estrutura, vista de dois capítulos diferentes.

**Sem mudança:** nenhuma linha de código foi alterada — só mais um nome para uma estrutura já
existente.

## 15. Isolar o Domínio do Mongoose (Layered Architecture, a sério)

**Decisão:** `Meeting` e `User` deixam de ser schemas do Mongoose e passam a classes de domínio
puras, sem nenhum import de infraestrutura. Cada uma ganha um ficheiro `*Model.js` irmão
(`MeetingModel.js`, `UserModel.js`) com o schema Mongoose correspondente — só os repositórios
importam esses ficheiros.

**Porquê:** ao comparar o projeto com o capítulo 4 do livro do Evans (Layered Architecture),
ficou identificado um incumprimento real, não só uma lacuna de vocabulário como as secções 10 e
14: `Meeting`/`User` importavam `mongoose` diretamente e *eram* o schema, o que significa que a
camada de Domínio dependia de uma tecnologia de persistência concreta — o oposto do isolamento
que o capítulo pede. Trocar a base de dados exigiria hoje reescrever as entidades de domínio, não
só a infraestrutura por baixo delas.

**O que mudou:**
- `meetings/Meeting.js` e `users/User.js` — classes simples (`class Meeting`, `class User`),
  com os mesmos métodos de sempre, sem `import mongoose` nenhum.
- `meetings/MeetingModel.js` e `users/UserModel.js` (novos) — os schemas Mongoose, exportando
  `MeetingModel`/`UserModel`; usados exclusivamente pelos repositórios e pelo `seed.js`.
- `meetingRepository.js`/`userRepository.js` ganham uma função `toDomain()` que traduz o
  documento Mongoose devolvido pela query para a entidade de domínio correspondente — é aqui,
  e só aqui, que as duas camadas se tocam.
- `middleware/currentUser.js` deixa de importar `User`/Mongoose diretamente — passa a usar
  `userRepository.findById()`, estendendo à middleware a regra que já existia para as rotas
  ("nunca falar com o Mongoose diretamente").
- `seed.js` continua a falar diretamente com `UserModel`/`MeetingModel` — é infraestrutura
  (popular a base de dados), não uma operação de domínio, por isso fica isento desta regra por
  natureza, tal como o próprio `middleware/` fica fora de `users/` pela mesma lógica de "isto é
  pipeline técnico, não vocabulário de negócio".

**Sem mudança visível:** contrato da API e comportamento da aplicação idênticos — confirmado com
os 20 testes automáticos (nenhum ficheiro de teste precisou de alteração, incluindo
`Meeting.test.js`, que já instanciava `Meeting` diretamente sem tocar em Mongoose) e com um teste
manual completo (listar, ver detalhe populado, aceitar sem conflito, aceitar com conflito → 409).

## 16. Linguagem Ubíqua: glossário, e o Scheduling deixa de falar de reuniões

**Decisão:** criar `GLOSSARY.md` como a fonte única dos termos do domínio (português ↔
identificador no código), alinhar o código com ele, e tirar de `scheduling/` o último
conhecimento que tinha sobre reuniões.

**Porquê:** ao comparar o projeto com a Parte I do livro do Evans (Linguagem Ubíqua,
Model-Driven Design, Knowledge Crunching), ficaram identificadas três lacunas:

1. **A linguagem partia-se entre a documentação e o código.** A documentação falava de "agenda" e
   "bloco de tempo", mas o código dizia `acceptedMeetings`/`findAcceptedForUser` e
   `toRange`/`TimeRange`. Um conceito do negócio sem nome no código é um conceito que o modelo
   não tem.
2. **O Scheduling dizia-se genérico, mas não era.** `scheduling/overlap.js` tinha
   `MEETING_DURATION_MINUTES` e `toRange(meeting)`, e `hasConflict` recebia ids de reuniões
   (`excludeMeetingId`). A regra "uma reunião dura 1h" é de Meetings, e estava escondida no
   Scheduling — precisamente o contrário do que as secções 9 e 10 afirmavam.
3. **Não houve especialista do domínio.** Todas as regras vieram do enunciado e de revisões
   técnicas. Isto não se corrige com código; o que se pode fazer é tornar explícitas as
   assunções tomadas sem ele, para serem confirmadas.

**O que mudou:**
- `GLOSSARY.md` (novo) — termos, identificadores correspondentes, termos a evitar, e a lista
  de perguntas em aberto para um especialista do domínio (lacuna 3).
- `scheduling/overlap.js` — só `TimeSlot` (`{ start, end }`) e `overlap(a, b)`. Sem durações, sem
  `date`/`startTime` em texto, sem a palavra "reunião".
- `scheduling/conflictService.js` — `hasConflict(candidate, agenda)` recebe só `TimeSlot`s.
  `excludeMeetingId` saiu: excluir a própria reunião é vocabulário de Meetings, e já era feito
  pela query de `findAgendaOf` (em `GET /meetings` era redundante — uma reunião pendente nunca
  está na agenda).
- `meetings/Meeting.js` — passa a ser dono da duração (`MEETING_DURATION_MINUTES`) e de converter
  data + hora de início num bloco de tempo (`meetingTimeSlot()` e o método `timeSlot()`).
- `meetings/meetingRepository.js` — `findAcceptedForUser` → `findAgendaOf`.
- `meetings/routes.js` — fala em `agenda` e passa ao Scheduling blocos de tempo, não reuniões.

**Testes:** 21/21 (antes 20). `overlap.test.js` e `conflictService.test.js` constroem blocos de
tempo com início e fim explícitos, em vez de assumir 1h; os 3 testes de `excludeMeetingId`
saíram com o parâmetro; `Meeting.test.js` ganha 2 testes para a duração de 1h, que é onde essa
regra agora vive.

**Sem mudança:** contrato da API e comportamento idênticos — confirmado chamando a app Express
real (com repositórios em memória) no código antes e depois desta secção, com o mesmo cenário:
listar com `hasConflict`, aceitar com conflito (`409`), aceitar sem conflito, voltar a aceitar um
convite já aceite, criar com conflito, criar sem conflito, e criar no passado (`400`). As
respostas foram iguais nos dois casos.

## 17. Três bugs da Parte II: Value Object, invariante do agregado, concorrência no Repositório

**Decisão:** corrigir os três bugs encontrados ao comparar o projeto com a Parte II do livro do
Evans (os blocos de construção), usando o padrão que faltava em cada caso.

**Porquê:** ao contrário das secções 10, 12, 14 e 16, estes não eram lacunas de vocabulário ou
de organização — eram comportamentos errados, reproduzíveis com um pedido HTTP. Os três foram
reproduzidos primeiro (testes e pedidos à API com MongoDB real) e só depois corrigidos.

### Bug 1 — data/hora inválida contornava as regras de negócio → Value Object

**O que acontecia:** `POST /meetings` com `date: "amanhã"` criava a reunião (`201`). O `Date` do
JavaScript devolve uma data inválida para texto que não reconhece, e qualquer comparação com uma
data inválida dá `false` — por isso "não pode estar no passado" passava e o conflito de horário
**nunca** era detetado. O `Date` também corrige datas inexistentes em silêncio: `2026-02-30`
passava a 2 de março, e `24:00` passava para o dia seguinte.

**Correção:**
- `scheduling/overlap.js` — `TimeSlot` passa de um objeto literal a uma classe Value Object:
  imutável (`Object.freeze`), e o construtor recusa datas inválidas e blocos em que o fim não é
  depois do início. Nenhum bloco de tempo inválido chega a `overlap()`.
- `meetings/Meeting.js` — `meetingTimeSlot()` valida o formato (`YYYY-MM-DD`, `HH:mm` entre
  `00:00` e `23:59`) e confirma que a data existe no calendário, lançando `InvalidScheduleError`.
- `POST /meetings` responde `400` com a mensagem do erro.

### Bug 2 — respostas em simultâneo apagavam-se → concorrência otimista no Repositório

**O que acontecia:** `meetingRepository.save()` gravava a lista inteira de `participants`. Se duas
pessoas respondessem ao mesmo tempo a convites da mesma reunião, cada uma lia a lista antes da
outra gravar, e a segunda gravação apagava a primeira. Reproduzido com MongoDB real: em 30 rondas
de respostas simultâneas, **as 30** perderam uma resposta — e a API tinha respondido `200` às duas.

**Correção:** controlo de concorrência otimista (*optimistic locking*), o mecanismo que Evans
associa à fronteira do agregado. O repositório guarda a versão (`__v`) com que leu cada reunião,
e `save()` só grava se o documento ainda estiver nessa versão (incrementando-a); senão lança
`ConcurrentModificationError`, e `PATCH /invites` responde `409` a pedir para repetir. A versão
fica num `WeakMap` dentro do repositório, não no `Meeting`: é um detalhe de persistência, o
agregado não precisa de o conhecer, e não aparece nas respostas da API. Depois da correção, nas
mesmas 30 rondas: nenhuma resposta confirmada com `200` se perdeu; a que chega em segundo
recebe `409`.

**Fora do âmbito:** a corrida *entre* agregados — a mesma pessoa a aceitar, ao mesmo tempo, dois
convites de reuniões diferentes que se sobrepõem. Cada reunião é gravada com a sua versão, mas a
verificação de conflito lê outras reuniões, e nada impede as duas verificações de passarem antes
de qualquer gravação. Resolver isso exige uma decisão de modelo (por exemplo, uma `Agenda` por
utilizador como agregado próprio), não uma correção local.

### Bug 3 — o organizador podia recusar a própria reunião → invariante no agregado

**O que acontecia:** a secção 5 diz que o organizador está sempre aceite, mas
`respondToInvite(organizador, 'declined')` era aceite (`200`), deixando uma reunião cujo
organizador a tinha recusado.

**Correção:** `Meeting.respondToInvite()` passa a proteger esta invariante e lança
`OrganizerCannotDeclineError`; `PATCH /invites` responde `403`. O frontend nunca oferecia esta
ação (o convite do organizador nunca está pendente), por isso só se chegava a ela pela API.

**Testes:** 28/28 (antes 21) — 5 novos em `Meeting.test.js` (formatos inválidos, datas que não
existem, ano bissexto, organizador a recusar, organizador a voltar a aceitar) e 2 em
`overlap.test.js` (o `TimeSlot` recusa valores inválidos e é imutável). O bug 2 depende da base
de dados, por isso foi verificado com MongoDB real fora da suite (ainda não há testes de
integração no projeto).

**Sem mudança para o uso normal:** o mesmo cenário de ponta a ponta da secção 16 (12 pedidos,
MongoDB real, `seed.js` e `server.js` verdadeiros) dá respostas idênticas antes e depois. As
únicas respostas novas são as dos três casos acima (`400`, `409` por concorrência, `403`),
documentadas na secção 13.

**A ter em conta** *(a §21 acrescenta `npm run check-data` para encontrar estas reuniões)***:** uma reunião gravada antes desta correção com data/hora inválida (só possível
chamando a API diretamente — o formulário do frontend usa campos `date`/`time`) faria agora
`GET /meetings` falhar com `500` para quem a tem, porque o seu bloco de tempo já não se consegue
construir. O `seed.js` apaga todas as reuniões, por isso uma base de dados criada a partir dele
não tem este problema.

## 18. Parte III: conceitos implícitos tornados explícitos, e Supple Design

**Decisão:** aplicar os padrões da Parte III do livro do Evans (*Refactoring Toward Deeper
Insight*) onde o código tinha conceitos sem nome ou interfaces que escondiam a intenção — e
registar onde um padrão desta parte foi considerado e **não** aplicado, e porquê.

### 1. A Agenda passa a existir no código (Refactoring Toward Deeper Insight)

A regra central vivia num serviço de domínio, `conflictService.hasConflict(candidate, agenda)`,
justificado por "nenhum agregado tem, sozinho, a informação para decidir isto" (secção 9). Era
verdade para o `Meeting` — mas o objeto que tem essa informação já existia no vocabulário (a
agenda, desde a secção 16) e não no código. Dado o nome, a regra passa a ser comportamento dele:

- `scheduling/Agenda.js` (novo, substitui `conflictService.js`) — Value Object imutável com os
  blocos de tempo aceites, e `conflictsWith(candidate)`.
- `meetings/Meeting.js` → `agendaOf(meetings)` monta a agenda a partir de reuniões aceites;
  `meetingRepository.findAgendaOf()` passa a devolver uma `Agenda`.

O serviço de domínio deixa de ser preciso. É o caso típico do capítulo 9: um serviço que existia
porque faltava um conceito ao modelo.

### 2. Closure of Operations e Intention-Revealing Interfaces no bloco de tempo

`overlap(a, b)` passa a `TimeSlot.overlaps(other)`: uma operação fechada sobre o próprio Value
Object, que recebe um `TimeSlot` e não precisa de mais nada. `scheduling/overlap.js` passa a
`scheduling/TimeSlot.js`, porque o ficheiro já só tinha o Value Object.

### 3. Estado do convite como conceito explícito

As strings `'pending'`, `'accepted'` e `'declined'` estavam repetidas no agregado, no schema
Mongoose, na query do repositório, nas rotas e no seed. `meetings/InviteStatus.js` (novo) é a
única fonte, com `isInviteResponse()` para a regra "uma resposta é aceitar ou recusar". Os
valores não mudam (são os da Published Language, secção 13).

### 4. `respondToInvite()` passa a revelar a intenção (Intention-Revealing Interfaces, CQS)

- Antes devolvia `null` em silêncio quando o utilizador não tinha sido convidado; agora lança
  `NotInvitedError`.
- Antes misturava comando e consulta (mudava o estado e devolvia o participante); agora é um
  comando puro, e o estado consulta-se com o novo `inviteStatusOf(userId)`.
- Recusa respostas que não sejam aceitar ou recusar (`TypeError`), em vez de gravar qualquer
  valor.

### 5. Assertions: o agregado verifica as suas invariantes

O construtor do `Meeting` passa a verificar e lança `InvalidMeetingError` se:
- um utilizador aparecer mais do que uma vez em `participants` (a regra "um convite por
  utilizador" da secção 5 só era garantida por um `Set` dentro da rota);
- o organizador não for participante com o convite aceite;
- um estado de convite não for um valor de `InviteStatus`.

Para isto proteger a gravação e não só a leitura, `POST /meetings` constrói o `Meeting` **antes**
de gravar, e `meetingRepository.create()` passa a receber o agregado em vez de dados soltos (o que
também acaba com a assimetria entre `create(data)` e `save(meeting)`). A rota já garante estas
condições, por isso as asserções não disparam em uso normal: apanham erros de programação, e
respondem `500` se dispararem.

### 6. O frontend deixa de duplicar regras do agregado

`MeetingsScreen.jsx` e `MeetingCard.jsx` procuravam o utilizador atual em `participants` para
saber o estado do seu convite — a mesma pergunta que `Meeting.inviteStatusOf()` responde.
`GET /meetings` passa a incluir `myInviteStatus` (mudança aditiva ao contrato, secção 13), e o
frontend usa-o em vez de reimplementar a procura. `MeetingCard.jsx` deixa de precisar de saber
quem é o utilizador fixo.

### Considerado e não aplicado: Specification

A regra "uma reunião conta para a agenda de X" aparece em dois sítios: `Meeting.isAcceptedBy(X)`
(em memória, em `GET /meetings`) e a query de `findAgendaOf` (em MongoDB, em `POST` e `PATCH`). O
padrão Specification juntaria as duas num objeto com `isSatisfiedBy(meeting)` e uma tradução para
query. Não foi aplicado: a regra é uma comparação, e a tradução para query obrigaria o domínio a
conhecer o formato de filtros do MongoDB (ou a construir um tradutor genérico), complexidade
desproporcional para uma regra que cabe numa linha. Em vez disso, a query documenta que é a
tradução de `isAcceptedBy()`, e o glossário tem uma só definição de agenda. Se surgirem mais
regras de seleção (filtros, que o enunciado lista como extra), a decisão deve ser revista.

### O que fica por fazer

- *(Resolvido na §21, com `toJSON()` — afinal sem precisar de um DTO.)* **`participants` continua a ser um array público e mutável.** As invariantes são verificadas na
  construção, mas `meeting.participants.push(...)` continua possível. Torná-lo privado (`#`) faria
  `res.json(meeting)` deixar de o serializar; resolver isto passa por separar o agregado da forma
  como é enviado na API (DTO), o que é uma mudança maior.
- **A criação da reunião continua na rota** (montar a lista de participantes, o organizador
  aceite, remover duplicados). O sítio natural é uma Factory no `Meeting` (Parte II).
- **A corrida entre agregados** (secção 17) mantém-se: a `Agenda` é agora um conceito explícito,
  mas é um Value Object calculado, não um agregado com a sua própria consistência.

**Testes:** 35/35 (antes 28). `scheduling/` passa a `TimeSlot.test.js` e `Agenda.test.js` (mais um
teste: a `Agenda` é imutável); `Meeting.test.js` ganha 6 (invariantes, `inviteStatusOf`,
respostas inválidas, `agendaOf`) e os de `respondToInvite` passam a verificar o erro e o comando
puro.

**Sem mudança de comportamento:** com MongoDB real, `seed.js` e `server.js` verdadeiros, o código
antes e depois desta secção dá respostas idênticas no cenário de ponta a ponta das secções 16-17,
nas reproduções dos bugs da secção 17 e no teste de concorrência. O frontend foi verificado num
browser (Chromium) com backend e base de dados reais: os separadores, as etiquetas de estado, o
aviso de conflito e aceitar um convite comportam-se exatamente como antes, sem erros na consola.

## 19. Parte IV: um só Bounded Context, Context Map, e o Core Domain no sítio certo

**Decisão:** corrigir a forma como o projeto aplicava o design estratégico do livro do Evans
(Parte IV). Ao contrário das secções 10, 11, 12 e 14, que acrescentaram nomes, esta corrige nomes
que estavam **errados**, e muda o código num ponto: a política que é o Core Domain sai das rotas
Express para um módulo próprio.

### 1. Um só Bounded Context, com três Módulos

As secções 8, 9 e 14 chamavam Bounded Contexts a `users/`, `meetings/` e `scheduling/`. Evans
define um Bounded Context como a fronteira dentro da qual **um modelo** e a sua linguagem são
válidos. Aqui há um só modelo: uma base de dados, `Meeting` a referenciar `User` diretamente,
`.populate()` a atravessar as pastas, e cada termo com um só significado em todas
(`GLOSSARY.md`). As três pastas são **Módulos** (cap. 5) de um único Bounded Context, *Gestão de
Reuniões*. A confusão vinha de misturar **subdomínio** (uma área do problema, que pode ser Core,
Supporting ou Generic) com **Bounded Context** (uma fronteira da solução): classificar as pastas
como subdomínios (secção 10) não as torna contextos separados.

### 2. Context Map: as relações que existem são com o que está fora

A secção 10 recusava o Context Map por ser "um único código, uma pessoa". Dentro do backend é
verdade, porque com um só contexto não há relações a mapear. Mas havia relações reais com o que
está **fora** do backend, que nunca tinham sido escritas. Estão agora em `CONTEXT_MAP.md`:

- **Backend → Frontend:** Open Host Service com Published Language (o contrato da §13); o frontend
  é Conformist, porque adota o modelo tal como vem, sem tradução.
- **Identidade → Backend:** hoje um utilizador fixo; com autenticação real seria um contexto
  upstream, e `middleware/currentUser.js` (o único sítio que lê a identidade do pedido) seria a
  Anticorruption Layer.
- **MongoDB** é infraestrutura, não um contexto.

### 3. Correção factual na secção 13

A §13 dizia que a Published Language é "a peça de Distillation que falta do capítulo 14". Published
Language é um padrão de **Context Map** (cap. 14, *Maintaining Model Integrity*); Distillation é o
capítulo 15. Corrigido no próprio texto da §13.

### 4. O Core Domain é a política, não a matemática — e passa a viver num só sítio

A secção 10 classificava `scheduling/` como Core Subdomain. Mas o que lá estava, a fórmula
`A.início < B.fim && B.início < A.fim`, é um algoritmo genérico de intervalos, que qualquer
calendário usa. Evans chama a isto um **Cohesive Mechanism**: precisamente o que se separa do Core
para o Core ficar mais claro. O que é específico deste negócio, e o próprio Domain Vision
Statement (§11) descreve, é a **política de compromissos**:

- criar uma reunião compromete o organizador (fica aceite), por isso tem de caber na agenda dele;
- aceitar um convite compromete quem aceita, por isso tem de caber na agenda dele;
- recusar nunca é bloqueado;
- só convites aceites contam para a agenda.

Esta política estava espalhada: metade nas rotas Express (`meetings/routes.js`), que a própria §12
listava como parte do núcleo, e sem testes automáticos. Agora vive toda em
`meetings/commitmentPolicy.js` (**Segregated Core**), sem HTTP nem base de dados:

- `scheduleMeeting(pedido, agendaDoOrganizador)`: a Factory da reunião. Valida data e hora, recusa
  o passado e o conflito, e constrói o `Meeting` com o organizador aceite e os convidados
  pendentes (sem duplicados, e sem o organizador a convidar-se a si próprio).
- `respondToInvite(reunião, utilizador, resposta, agenda)`: confirma que o utilizador foi
  convidado, só verifica o conflito ao aceitar, e delega no agregado.
- `wouldConflict(reunião, utilizador, agenda)`: o aviso da lista, só para convites pendentes.

As rotas ficam como Serviço de Aplicação a sério (§10): leem o pedido, vão buscar a agenda e os
utilizadores aos repositórios, chamam a política e traduzem os erros de domínio para HTTP numa só
tabela (`HTTP_STATUS_BY_ERROR`).

**Classificação revista** (substitui a tabela da §10):

| Parte | Classificação | Onde |
|---|---|---|
| Política de compromissos + Agenda | **Core Domain** | `meetings/commitmentPolicy.js`, `scheduling/Agenda.js` |
| Sobreposição de blocos de tempo | **Cohesive Mechanism** (genérico, usado pelo Core) | `scheduling/TimeSlot.js` |
| Reuniões, convites, persistência, API | **Supporting** | resto de `meetings/` |
| Utilizadores e pesquisa | **Generic** | `users/` |

O Highlighted Core (§12) foi atualizado para esta classificação.

### 5. A corrida entre reuniões diferentes: decisão consciente de não a resolver

A §17 deixou em aberto: a mesma pessoa a aceitar, ao mesmo tempo, dois convites de reuniões
diferentes que se sobrepõem. Cada aceitação lê a agenda, não vê a outra, e as duas passam. É uma
invariante que atravessa vários agregados (`Meeting`s diferentes), e Evans dá duas saídas:
redesenhar a fronteira (fazer da agenda de cada utilizador um agregado próprio, com versão, gravado
na mesma transação que a resposta ao convite) ou aceitar consistência eventual.

**Decisão: não resolver agora.** Com um único utilizador fixo, sem login (§2), a corrida exige que
a mesma pessoa carregue em "Aceitar" em dois convites no mesmo instante. O custo de a fechar é
alto: um agregado novo, uma coleção nova e transações MongoDB, que pedem um replica set. Com
vários utilizadores reais a decisão deve ser revista, e o caminho é o primeiro (agenda como
agregado com versão, numa transação).

### 6. Large-Scale Structure: não se aplica

Os padrões do capítulo 16 (Responsibility Layers, Knowledge Level, System Metaphor, etc.) servem
para organizar sistemas com muitos contextos e módulos. Com um contexto e três módulos, impor um
deles seria estrutura sem problema para resolver.

**Testes:** 47/47 (antes 35). `meetings/commitmentPolicy.test.js` (novo, 12 testes) cobre as regras
do Core sem HTTP nem base de dados: organizador aceite e convidados pendentes, duplicados e
auto-convite, conflito ao criar, limite exato, a agenda dos convidados não ser verificada ao criar,
passado e data inválida, conflito ao aceitar, recusar com conflito, quem não foi convidado, as
regras do agregado, e o aviso da lista.

**Sem mudança de comportamento:** com MongoDB real, `seed.js` e `server.js` verdadeiros, o código
antes e depois desta secção dá respostas idênticas em 30 pedidos HTTP: o cenário de ponta a ponta
das secções 16-18, as reproduções dos bugs da §17, e um cenário novo de casos-limite (convidado
inexistente, ids repetidos ou com formato inválido, campo em falta, quem não foi convidado a
responder, responder por outra pessoa, estado inválido, reunião inexistente, mudar de ideias, acesso
negado, pedido sem `X-User-Id`). O teste de concorrência da §17 continua sem respostas perdidas,
e o frontend, verificado no Chromium, mostra o mesmo que antes, sem erros na consola.

## 20. Testes de integração com MongoDB real

**Decisão:** acrescentar ao repositório uma suite de testes de integração
(`npm run test:integration`) que corre a app Express verdadeira contra um MongoDB verdadeiro,
temporário e em memória (`mongodb-memory-server-core`). Até aqui só a lógica pura tinha testes
automáticos; as verificações com base de dados das secções 16-19 foram feitas à mão, com scripts
que não ficaram no repositório.

**Porquê:** os testes unitários não conseguem apanhar o que depende da base de dados: as queries do
Mongoose (por exemplo, a agenda só contar convites aceites), a tradução documento ↔ agregado,
o `.populate()` do detalhe, a concorrência otimista do `save()` (§17) e a tradução dos erros de
domínio para HTTP. Para confirmar que os testes servem para alguma coisa, foram reintroduzidos de
propósito cinco bugs, um de cada vez, e a suite falhou em todos: o `save()` sem controlo de versão,
a agenda a contar convites pendentes, a criação sem verificar a agenda do organizador, o detalhe
sem `.populate()`, e um conflito traduzido para `400` em vez de `409`.

**O que existe** (em `backend/test/integration/`, fora de `src/` para o `npm test` continuar rápido
e sem base de dados):
- `helpers.js` — arranca o MongoDB temporário e a app numa porta livre, limpa a base de dados antes
  de cada teste, e dá funções curtas para criar utilizadores e reuniões e fazer pedidos.
- `meetings.api.test.js` — a API pelas regras de negócio: lista com `myInviteStatus` e
  `hasConflict`, criar (com e sem conflito, no limite, convidados repetidos, erros `400`), detalhe
  populado e acesso negado, aceitar e recusar (conflito, voltar a aceitar, mudar de ideias, erros
  `403`/`404`/`400`), identificação por `X-User-Id`, e pesquisa de utilizadores.
- `meetingRepository.test.js` — a concorrência otimista de forma determinística (duas leituras da
  mesma reunião e duas gravações: a segunda falha em vez de apagar a primeira, sem depender de
  pedidos em simultâneo), documentos sem `__v`, a query da agenda, e ida e volta
  agregado → documento → agregado.
- `seed.test.js` — corre o `seed.js` verdadeiro, como o README manda, e confirma que o id impresso
  funciona em `X-User-Id` e que o cenário de demonstração (um conflito, um convite livre) fica pronto.

**Escolha da dependência:** `mongodb-memory-server-core` em vez de `mongodb-memory-server`. Fazem o
mesmo, mas o segundo descarrega o MongoDB (~120 MB) em cada `npm install`, mesmo para quem nunca
corre estes testes; o `-core` só o descarrega na primeira vez que a suite corre.

**Resultado:** 25 testes de integração, ~4 segundos depois do primeiro download. `npm test`
continua com os mesmos 47 testes unitários.

## 21. Pesquisa literal, verificação de dados antigos e encapsulamento do `Meeting`

**Decisão:** corrigir três problemas que ficaram em aberto depois das secções 17-20. Cada um foi
reproduzido primeiro com um teste a falhar.

### 1. A pesquisa de utilizadores trata o texto como literal (bug)

`GET /users?q=...` passava o texto do utilizador diretamente para um `$regex` do MongoDB. Por isso,
pesquisar `(` ou `[` dava erro `500`, `.` encontrava qualquer carácter (`ana.silva` encontrava
também `anaXsilva`), e um padrão malicioso podia deixar a base de dados lenta (ReDoS).
`userRepository.search()` passa a escapar o texto antes de o usar: pesquisa-se o que foi escrito,
nada mais.

### 2. `npm run check-data`: encontrar reuniões que o modelo já não aceita

Reuniões gravadas antes das regras atuais (data/hora validada desde a §17; organizador obrigado a
estar aceite desde a §18) já não se conseguem transformar num `Meeting`. Uma só reunião assim faz
`GET /meetings` dar `500` a todos os que nela participam. A §17 já referia o caso da data inválida,
mas a §18 acrescentou outro sem o assinalar: o organizador que recusou a própria reunião (possível
antes da §17).

- `meetingRepository.findInvalid()` percorre as reuniões gravadas e devolve as que o modelo
  recusa, com o motivo (a mensagem do erro de domínio).
- `npm run check-data` (`src/check-data.js`) usa-a contra a base de dados do `.env`, lista o que
  encontrar e termina com código `1`, ou diz que não há nenhuma e termina com `0`. **Só lê**: não
  corrige nem apaga nada, porque essa decisão cabe a quem gere os dados.

Foi considerada a alternativa de tornar a lista tolerante (ignorar a reunião inválida e registá-la
no log). Não foi aplicada: escondia dados estragados, que apareceriam a uns utilizadores e não a
outros sem ninguém perceber porquê.

### 3. A reunião só muda através dos seus métodos (encapsulamento)

A §18 deixou em aberto: `meeting.participants.push(...)` continuava possível, e as invariantes só
eram verificadas na construção. Dizia também que resolver isto exigia separar o agregado da forma
enviada pela API (um DTO). Afinal não exigia:

- a lista interna passa a ser um campo privado (`#participants`), e `participants` passa a ser um
  getter que devolve uma lista **só de leitura** (array e participantes congelados);
- o construtor copia a lista que recebe, por isso alterar o array original depois não afeta a
  reunião;
- `findParticipant()` devolve o participante só de leitura; só `respondToInvite()` muda um
  convite, substituindo o participante por uma cópia nova;
- o objeto é congelado no fim do construtor: `meeting.date = ...` deixa de ser possível;
- `toJSON()` devolve a mesma forma de antes. O `JSON.stringify` (e portanto o `res.json`) chama-o
  automaticamente, por isso a API não muda. Onde o código fazia spread de um `Meeting`
  (`{ ...m }`, em `GET /meetings` e num teste), passa a usar `m.toJSON()`, porque o spread não copia
  campos privados nem getters.

**Testes:** 52 unitários (antes 47; +5 de encapsulamento e da forma do `toJSON`) e 30 de integração
(antes 25; +1 da pesquisa literal, +4 de dados antigos e do `check-data`).

**Sem mudança na API:** com MongoDB real, o código antes e depois desta secção dá respostas
idênticas nos 30 pedidos dos cenários das secções 16-19. O JSON de seis respostas
(lista, os três detalhes populados, aceitar e criar) foi comparado **byte a byte** e é igual. O
frontend, verificado no Chromium, mostra o mesmo que antes, sem erros na consola.

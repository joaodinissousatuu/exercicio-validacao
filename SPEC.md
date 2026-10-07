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
| Bounded Context | `users/` vs. `meetings/` | Sim — dois domínios, separados por pasta e por responsabilidade |
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

**Fora do âmbito, e porquê:** o Mapa de Contexto (Context Map) não ganha aqui nenhum dos padrões
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
scheduling/overlap.js         → TimeSlot, overlap()           — o bloco de tempo e a matemática
scheduling/conflictService.js → hasConflict(candidate, agenda)
meetings/Meeting.js           → timeSlot(), isAcceptedBy(), isPendingFor(), respondToInvite()
meetings/routes.js            → as ~6 linhas à volta de hasConflict() em POST / e PATCH /invites
```

(Atualizado pela secção 16: `toRange()`/`rangesOverlap()` passaram a `Meeting.timeSlot()` e
`overlap()`, e `hasConflict` deixou de receber `excludeMeetingId`.)

Se um leitor só tivesse tempo de ler quatro coisas neste repositório antes de o avaliar, seriam
estas. Tudo o resto — `users/`, os componentes React, os hooks de React Query, os middlewares —
existe para dar a estas linhas um sítio onde correr, não para acrescentar regra de negócio nova.

## 13. Published Language

**Decisão:** formalizar o contrato de cada endpoint — pedido, resposta e erros — num formato
explícito, em vez da tabela informal da secção 3.

**Porquê:** é a peça de Distillation que falta do capítulo 14 (Maintaining Model Integrity), e
liga diretamente a "documentação da API", que o próprio enunciado lista como extra opcional
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
  "hasConflict": false
}
```
`hasConflict` só é calculado (`true`/`false`) quando o convite do utilizador atual está
`pending`; caso contrário vem sempre `false`.

### `POST /meetings`
Pedido: `{ "title", "description", "date", "startTime", "participantIds": string[] }`
Resposta `201`: um `Meeting` (forma igual à de `GET /meetings`, sem `hasConflict`).
Erros: `400` (campo obrigatório em falta, ou data/hora no passado), `409` (conflito com reunião
já aceite do organizador).

### `GET /meetings/:id`
Resposta `200`: como acima, mas `organizerId` e `participants[].userId` vêm **populados** —
`{ "_id", "name", "username" }` em vez de string (ver a costura documentada na secção 10/
`DOMAIN_MIGRATION.md`).
Erros: `404` (reunião não existe), `403` (utilizador atual não é organizador nem participante).

### `PATCH /meetings/:id/invites/:userId`
Pedido: `{ "status": "accepted" | "declined" }`
Resposta `200`: o `Meeting` atualizado (forma não populada).
Erros: `400` (`status` inválido), `403` (a responder por outro utilizador), `404` (reunião ou
convite não encontrado), `409` (aceitar entraria em conflito de horário).

### Todos os endpoints
Header obrigatório: `X-User-Id`. Em falta ou inválido → `401`, corpo `{ "error": "string" }` —
a mesma forma de erro em qualquer resposta não-2xx do projeto.

## 14. Módulos (nomeação)

**Decisão:** nomear explicitamente `users/`, `meetings/` e `scheduling/` como o padrão Módulos
(capítulo 5 do livro do Evans), além de já serem chamados "domínios"/"Bounded Contexts".

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

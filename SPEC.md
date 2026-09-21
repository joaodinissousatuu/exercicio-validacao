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

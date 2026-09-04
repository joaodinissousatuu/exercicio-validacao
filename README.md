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

### Autenticação

Não há autenticação real, cada pedido à API identifica-se através do header `X-User-Id`, sempre com o mesmo valor: o ID de um utilizador previamente definido (Ana Silva). 

Optei por esta abordagem para não gastar tempo que poderia faltar para aplicar no foco do exercicio: a regra de negócio de conflito de horários.

### Modelo de dados

- **User**: `name` (nome apresentado na UI) e `username` (identificador único, usado para pesquisa).
- **Meeting**: `title`, `description`, `date`, `startTime`, `organizerId` (referência ao organizador) e `participants` — um array de `{ userId, status }`, onde `status` é `pending`, `accepted` ou `declined`. O organizador é incluído automaticamente neste array, já com `status: 'accepted'`.

### Tipagem: JSDoc, não TypeScript completo

Usei JSDoc (`@typedef`, `@param`, `@returns`) nos ficheiros mais críticos — os modelos `User`/`Meeting` e a função de conflito, pois pesquisei e conclui que poderia ser uma mais valia no processo de desenvolvimento do código: avisa de incompatibilidades de forma enquanto o código é escrito, mas **não tem efeito nenhum em tempo de execução** — não valida nada quando a aplicação está a correr. Essa validação a sério (campos obrigatórios, tipos, valores permitidos) é feita pelo `Mongoose`, através do schema. Optámos por não adotar `TypeScript` completo no projeto para não acrescentar uma curva de aprendizagem extra, dado o tempo disponível e a falta de experiência prévia em `JavaScript`/`React`.

### Onde vive a regra de conflito

A regra está dividida propositadamente em dois sítios:

- **`utils/overlap.js`** — só compara. Responde à pergunta "estes dois intervalos de tempo sobrepõem-se?". Não tem acesso a nada do resto da aplicação, o que o torna fácil de testar isoladamente.
- **`routes/meetings.js`** — o alcance da regra: contra que reuniões comparar (só as já **aceites** do mesmo utilizador, nunca as pendentes), em que momento (só ao **aceitar** um convite, nunca ao recusar), e o que fazer com o resultado (bloquear com `409` se houver conflito).

A fórmula criada em `overlap.js`:
```
overlap(A, B) = A.inicio < B.fim && B.inicio < A.fim
```
Cobre os três casos possíveis — sem sobreposição, sobreposição total e sobreposição parcial.

### `hasConflict` calculado no backend

O `GET /meetings` devolve, para cada reunião com o convite `pending`, um campo `hasConflict` já calculado pelo servidor (reutilizando a mesma função `overlap()`). O frontend mostra esse aviso diretamente, sem reimplementar a lógica — assim existe uma única fonte de verdade para a regra mais importante do projeto, em vez de duas versões (backend e frontend) que um dia poderiam divergir.

### Organização de pastas do backend

- **`models/`** — só a forma dos dados (User, Meeting).
- **`middleware/`** — código que corre antes de qualquer rota (identificar o utilizador atual).
- **`routes/`** — o que acontece quando chega um pedido a um URL específico.
- **`utils/`** — lógica reutilizável, independente do resto da aplicação (a função de conflito).

Cada pasta representa um tipo diferente de responsabilidade — separa "o que são os dados" de "o que acontece quando alguém pede algo" de "lógica pura, sem contexto de HTTP ou base de dados".

### Stack do frontend

`React` + `Vite` + `Mantine` (biblioteca de componentes, para não escrever CSS à mão). A comunicação com a API é feita com `fetch` simples, envolvido em pequenos hooks próprios por recurso (`useMeetings`, `useMeeting`, `useUserSearch`) — sem bibliotecas maiores de data-fetching (como `React Query`), para manter a curva de aprendizagem baixa, consistente com a decisão de não adotar `TypeScript` completo no backend.

A interface tem um único ecrã de reuniões, com separadores "Pendentes" e "Todas", em vez de páginas separadas — reduz a estrutura (uma rota, um fetch, um conjunto de estados de loading/vazio/erro) sem perder a distinção entre "o que precisa da minha ação" e "o histórico completo".

### CORS e tratamento de erros assíncronos

Duas correções feitas depois de uma primeira revisão do backend:

- **`CORS`**: por defeito, o browser bloqueia pedidos entre origens diferentes (o `React` em `localhost:5173`, a API em `localhost:3000` contam como origens diferentes, mesmo sendo ambos "localhost"). Adicionei o middleware `cors()` para permitir explicitamente estes pedidos.
- **Erros assíncronos**: no `Express` 4, um erro lançado dentro de uma função de rota `async` não chega automaticamente ao middleware de tratamento de erros — é uma limitação conhecida desta versão. Acrescentei `express-async-errors`, que corrige isto, garantindo que erros inesperados do servidor produzem sempre uma resposta de erro tratada, em vez de ficarem sem resposta.

## Assunções

- O organizador de uma reunião fica automaticamente convidado e aceite nela — não precisa de a aceitar separadamente.
- Só o organizador pode convidar participantes, e só no momento em que cria a reunião — não há edição de participantes depois de criada.
- Um utilizador só pode ter um convite por reunião (sem duplicados).
- Convites **pendentes** não contam para efeitos de conflito de horário — só convites já **aceites**. Assim, posso continuar a receber convites sobrepostos entre si, e só sou impedido de aceitar um deles se já tiver outro aceite no mesmo período.
- A data e a hora de início de uma reunião não podem estar no passado (valido a combinação das duas, não só a data).
- Todos os campos de uma reunião (título, descrição, data, hora) são de preenchimento obrigatório.
- "As minhas reuniões" inclui tanto as que organizei como aquelas para que fui convidado, independentemente do estado do convite.
- A pesquisa de utilizadores é feita pelo `username`, não pelo nome.

## Se tivesses mais tempo

- **Autenticação real**: numa aplicação em produção, substituiria o utilizador fixo por um sistema de contas a sério — registo, palavras-passe com hash (nunca em texto simples), e sessão/token para manter o login entre pedidos. Não o fiz aqui porque o próprio enunciado desaconselha investir tempo nisso, e o foco do exercício está na regra de conflito de horários.
- **Concorrência**: a verificação de conflito faz leitura e escrita sem qualquer tipo de bloqueio — em teoria, dois pedidos de aceitação em simultâneo, para reuniões que se sobrepõem, poderiam ambos passar a verificação antes de qualquer um gravar o resultado. Resolveria isto com uma transação do MongoDB.
- **Distribuição do projeto**: adicionaria um `docker-compose.yml` com uma instância local do MongoDB, para quem for avaliar isto não depender das minhas credenciais pessoais do Atlas.
- **Pequena duplicação no frontend**: `MeetingCard.jsx` e `MeetingDetailModal.jsx` definem, cada um, o mesmo objeto de cores/etiquetas para os estados dos convites — extraía isso para um único sítio partilhado.
- **Mais testes**: atualmente só a função de conflito (`overlap.js`) tem testes automáticos. Adicionaria testes de integração às rotas, sobretudo à verificação de conflito no `POST /meetings` e no `PATCH /invites`.
- **Escalabilidade da pesquisa de utilizadores**: com a lista de utilizadores pequena, o endpoint devolve todos quando a pesquisa está vazia. Numa aplicação com muitos mais utilizadores, adicionaria paginação ou um mínimo de caracteres antes de pesquisar.

## Ferramentas de IA

Usei o **Claude Code** (aplicação desktop e extensão do VS Code) ao longo de todo o processo, mas com uma divisão clara: as decisões de arquitetura, modelo de dados e regras de negócio foram discutidas e fechadas por mim antes de qualquer código ser escrito, documentadas em `SPEC.md` e `FRONTEND_SPEC.md` — a IA implementou a partir dessas decisões.

Usei-a também para me explicar conceitos que desconhecia por completo (React, Node.js, Express, HTTP, Mongoose), já que não tinha experiência relevante nestas tecnologias.

Um exemplo concreto de revisão que fiz ao código gerado: identifiquei, com apoio da IA, que a regra de conflito de horários só estava a ser verificada no momento de aceitar um convite (`PATCH /invites`), mas não quando o próprio organizador é automaticamente aceite na reunião que cria (`POST /meetings`) — o que permitia, na prática, criar duas reuniões próprias que se sobrepunham sem nenhum aviso. Corrigi isto aplicando a mesma verificação também nesse ponto.

# Spec — Gestão de reuniões (Buildtoo)

Documento de decisões técnicas do backend, fechado antes de qualquer implementação.
Serve de base direta para as secções "Decisões técnicas" e "Assunções" do README final.

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

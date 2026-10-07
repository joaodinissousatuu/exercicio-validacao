# Glossário — Linguagem Ubíqua

> A linguagem partilhada deste projeto (Evans, Parte I, cap. 2). Cada conceito tem **um só
> nome** em português (usado na documentação e nas conversas) e **um só identificador** no código
> (em inglês). Esta tabela é a tradução oficial entre os dois — se um termo não está aqui, ou
> aparece com outro nome, é uma lacuna a corrigir, não uma variação aceitável.
>
> Regra de trabalho: um conceito novo entra **primeiro aqui**, depois no código.

## Termos

| Termo | No código | Módulo | Definição |
|---|---|---|---|
| **Utilizador** | `User` | `users/` | Pessoa que usa a aplicação. Identificada por `username`, único. |
| **Reunião** | `Meeting` | `meetings/` | Encontro com título, descrição, data e hora de início, criado por um organizador. |
| **Organizador** | `organizerId`, `isOrganizer()` | `meetings/` | O utilizador que criou a reunião. É sempre também participante, com o convite aceite. |
| **Participante** | `Participant`, `participants[]` | `meetings/` | Utilizador convidado para uma reunião, incluindo o organizador. |
| **Convite** | `respondToInvite()`, `inviteStatusOf()`, `PATCH /meetings/:id/invites/:userId` | `meetings/` | O pedido para um participante estar numa reunião. **Não é uma entidade à parte**: é o estado (`status`) do participante. |
| **Estado do convite** | `InviteStatus.PENDING` / `ACCEPTED` / `DECLINED` (`'pending'` / `'accepted'` / `'declined'` na API) | `meetings/` | **Pendente**, **aceite** ou **recusado**. |
| **Responder a um convite** | `respondToInvite(userId, status)` | `meetings/` | Aceitar ou recusar. Só o próprio participante pode responder ao seu convite. |
| **Duração da reunião** | `MEETING_DURATION_MINUTES` | `meetings/` | Fixa: 1 hora a partir da hora de início. Regra de Meetings, não de Scheduling. |
| **Compromisso** | `commitmentPolicy` (`scheduleMeeting`, `respondToInvite`, `wouldConflict`) | `meetings/` | Qualquer coisa que ocupa um bloco de tempo na agenda de alguém. Hoje, só reuniões: **criar** uma reunião compromete o organizador, **aceitar** um convite compromete quem aceita; **recusar** liberta. O Scheduling não sabe que são reuniões, só vê o bloco de tempo. |
| **Bloco de tempo** | `TimeSlot`, `Meeting.timeSlot()` | `scheduling/` | O período que um compromisso ocupa, de início (inclusive) a fim (exclusive). Value Object: imutável e sempre válido (o fim é depois do início). |
| **Agenda** | `Agenda`, `agendaOf(meetings)`, `findAgendaOf(userId)` | `scheduling/` (montada em `meetings/`) | Os blocos de tempo das reuniões que um utilizador **já aceitou**. Convites pendentes ou recusados não fazem parte da agenda. Value Object, imutável. |
| **Conflito de horário** | `Agenda.conflictsWith(candidate)`, `TimeSlot.overlaps(other)` | `scheduling/` | Quando o bloco de tempo de um compromisso candidato se sobrepõe a algum bloco da agenda. Blocos que só se tocam no limite (um acaba quando o outro começa) **não** estão em conflito. |

## Termos a evitar

| Em vez de… | Usar | Porquê |
|---|---|---|
| "evento", "marcação" | **reunião** | O enunciado só fala de reuniões. |
| "intervalo", "range", "período" | **bloco de tempo** | Um só nome para o mesmo conceito (o código chamava-lhe `toRange`/`TimeRange` até à SPEC §16). |
| "reuniões aceites", `acceptedMeetings` | **agenda** | É o conceito do negócio; "reuniões aceites" é a definição, não o nome (o código usava `findAcceptedForUser` até à SPEC §16). |
| "convidado" (como substantivo) | **participante** | O organizador também é participante; "convidado" sugere que não. |
| "sobreposição" (como regra) | **conflito de horário** | Sobreposição é a matemática (`overlap`); conflito é a regra de negócio. |

## Decisões tomadas sem especialista do domínio

Este projeto foi modelado a partir do enunciado e de rondas de revisão técnica, **sem conversa
com um especialista do domínio** (o que Evans chama *knowledge crunching*). As respostas abaixo
são assunções nossas, não conhecimento confirmado. Cada uma é uma pergunta a levar à próxima
conversa com quem conhece o negócio. Quando houver resposta, regista-a aqui (com a data e quem
respondeu) e ajusta o código.

| # | Pergunta | Assunção atual | Onde vive no código |
|---|---|---|---|
| 1 | As reuniões têm sempre 1 hora? Há reuniões de 30 min ou de 2 h? | Sempre 1 hora. | `meetings/Meeting.js` → `MEETING_DURATION_MINUTES` |
| 2 | Duas reuniões seguidas (10h–11h e 11h–12h) estão em conflito? | Não estão. | `scheduling/TimeSlot.js` → `overlaps()` |
| 3 | Um convite pendente deve "reservar" o tempo na agenda? | Não. Só convites aceites contam. | `meetings/meetingRepository.js` → `findAgendaOf()` |
| 4 | O organizador pode recusar a própria reunião? Se não, deve poder cancelá-la? | Não pode: fica sempre aceite, e o agregado garante-o (SPEC §17). Cancelar não existe. | `meetings/Meeting.js` → `respondToInvite()` |
| 5 | Em que fuso horário estão a data e a hora de uma reunião? Do organizador, de cada participante, ou um fuso fixo? | Implicitamente, o fuso do servidor. | `meetings/Meeting.js` → `meetingTimeSlot()` |
| 6 | Um participante pode mudar de ideias (aceitar, depois recusar, depois aceitar outra vez)? Até quando? | Sim, sem limite. | `meetings/routes.js` → `PATCH /:id/invites/:userId` |
| 7 | Quando um convite fica em conflito com a agenda, o sistema deve só impedir, ou também sugerir alternativas? | Só impede (`409`) e avisa na lista (`hasConflict`). | `meetings/routes.js` |

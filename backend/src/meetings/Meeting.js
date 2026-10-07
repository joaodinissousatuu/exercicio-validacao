/**
 * @typedef {Object} Participant
 * @property {string} userId - Referência ao User convidado.
 * @property {'pending' | 'accepted' | 'declined'} status - Estado do convite.
 */

/**
 * @typedef {Object} MeetingProps
 * @property {string} [_id] - Identificador (ausente antes de gravado pelo repositório).
 * @property {string} title - Título da reunião.
 * @property {string} description - Descrição da reunião.
 * @property {string} date - Data da reunião (formato 'YYYY-MM-DD').
 * @property {string} startTime - Hora de início (formato 'HH:mm'). Duração fixa de 1h, não é campo guardado.
 * @property {string} organizerId - Referência ao User que criou a reunião.
 * @property {Participant[]} participants - Lista de participantes, inclui o organizador (já aceite).
 */

/**
 * Agregado de domínio, sem qualquer dependência de Mongoose ou de outra
 * tecnologia de persistência — meetingRepository.js é o único ficheiro que
 * sabe traduzir entre isto e o documento gravado na base de dados
 * (MeetingModel.js). Isolar assim a camada de Domínio da de Infraestrutura é
 * o próprio padrão Layered Architecture do capítulo 4 do livro do Evans.
 *
 * Comportamento do agregado: quem pode ver a reunião, qual o estado do
 * convite de alguém, e como responder a um convite. Vive aqui para que a
 * rota nunca mexa diretamente em `participants` de fora — só o próprio
 * agregado sabe como interpretar e alterar o seu estado interno.
 *
 * Fica deliberadamente de fora: decidir SE aceitar entra em conflito de
 * horário com outras reuniões. Essa regra cruza vários agregados Meeting ao
 * mesmo tempo (a candidata contra as já aceites de outras reuniões), e um
 * agregado não tem, sozinho, os dados para a decidir — por isso continua no
 * serviço de domínio scheduling/conflictService.js, chamado pela rota antes
 * de invocar respondToInvite().
 */

/** Extrai o id de uma referência, populada ou não (string crua ou objeto {_id, name, username}). */
function idOf(value) {
  return String(value?._id ?? value);
}

export class Meeting {
  /** @param {MeetingProps} props */
  constructor({ _id, title, description, date, startTime, organizerId, participants }) {
    this._id = _id;
    this.title = title;
    this.description = description;
    this.date = date;
    this.startTime = startTime;
    this.organizerId = organizerId;
    this.participants = participants;
  }

  /** @param {string} userId @returns {Participant | null} */
  findParticipant(userId) {
    const target = String(userId);
    return this.participants.find((p) => idOf(p.userId) === target) ?? null;
  }

  /** @param {string} userId */
  isOrganizer(userId) {
    return idOf(this.organizerId) === String(userId);
  }

  /** Organizador ou participante (convidado), independentemente do estado do convite. @param {string} userId */
  hasAccess(userId) {
    return this.isOrganizer(userId) || this.findParticipant(userId) !== null;
  }

  /** @param {string} userId */
  isAcceptedBy(userId) {
    return this.findParticipant(userId)?.status === 'accepted';
  }

  /** @param {string} userId */
  isPendingFor(userId) {
    return this.findParticipant(userId)?.status === 'pending';
  }

  /**
   * Regista a resposta de um utilizador ao seu convite. Só muda o estado —
   * quem decide se pode fazê-lo (conflito de horário) é responsabilidade de
   * quem chama, através do serviço de domínio scheduling, não deste método.
   * @param {string} userId
   * @param {'accepted' | 'declined'} status
   * @returns {Participant | null} o participante atualizado, ou null se o utilizador não foi convidado
   */
  respondToInvite(userId, status) {
    const participant = this.findParticipant(userId);
    if (!participant) return null;
    participant.status = status;
    return participant;
  }
}

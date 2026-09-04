const MEETING_DURATION_MINUTES = 60;

/**
 * @typedef {Object} TimeRange
 * @property {Date} start
 * @property {Date} end
 */

/**
 * Converte uma reunião (date + startTime) num intervalo [start, end),
 * assumindo a duração fixa de 1h.
 * @param {{ date: string, startTime: string }} meeting
 * @returns {TimeRange}
 */
function toRange(meeting) {
  const start = new Date(`${meeting.date}T${meeting.startTime}`);
  const end = new Date(start.getTime() + MEETING_DURATION_MINUTES * 60 * 1000);
  return { start, end };
}

/**
 * Verifica se dois intervalos de tempo se sobrepõem.
 * Sobreposição no limite (uma termina exatamente quando a outra começa) não conta.
 * @param {TimeRange} a
 * @param {TimeRange} b
 * @returns {boolean}
 */
function rangesOverlap(a, b) {
  return a.start < b.end && b.start < a.end;
}

/**
 * Verifica se duas reuniões (cada uma com date + startTime, duração fixa de 1h)
 * têm conflito de horário.
 * @param {{ date: string, startTime: string }} meetingA
 * @param {{ date: string, startTime: string }} meetingB
 * @returns {boolean}
 */
export function overlap(meetingA, meetingB) {
  return rangesOverlap(toRange(meetingA), toRange(meetingB));
}

export { toRange };

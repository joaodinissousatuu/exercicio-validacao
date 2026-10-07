/**
 * Estado do convite de um participante (ver GLOSSARY.md). Única fonte destes
 * valores no backend: o agregado, o schema Mongoose, as queries do
 * repositório, as rotas e o seed usam estas constantes em vez de repetir as
 * strings. Os valores em si são os da Published Language (SPEC.md §13), por
 * isso não mudam — o frontend recebe e envia exatamente estas strings.
 */
export const InviteStatus = Object.freeze({
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
});

/** @typedef {typeof InviteStatus[keyof typeof InviteStatus]} InviteStatusValue */

/**
 * Uma resposta a um convite só pode ser aceitar ou recusar — voltar a
 * "pendente" não é uma resposta.
 * @param {unknown} value
 * @returns {value is 'accepted' | 'declined'}
 */
export function isInviteResponse(value) {
  return value === InviteStatus.ACCEPTED || value === InviteStatus.DECLINED;
}

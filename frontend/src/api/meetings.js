import { apiFetch } from './apiFetch.js';

export const getMeetings = () => apiFetch('/meetings');

export const getMeeting = (id) => apiFetch(`/meetings/${id}`);

export const createMeeting = ({ title, description, date, startTime, participantIds }) =>
  apiFetch('/meetings', {
    method: 'POST',
    body: { title, description, date, startTime, participantIds },
  });

export const respondToInvite = (meetingId, userId, status) =>
  apiFetch(`/meetings/${meetingId}/invites/${userId}`, {
    method: 'PATCH',
    body: { status },
  });

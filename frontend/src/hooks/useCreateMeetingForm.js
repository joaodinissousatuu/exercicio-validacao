import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { useUserSearch } from './useUserSearch.js';
import { useCreateMeeting } from './useCreateMeeting.js';
import { FIXED_USER_ID } from '../constants.js';

const emptyForm = { title: '', description: '', date: '', startTime: '' };

/**
 * Gestão de campos, validação e submissão do formulário de criação de reunião.
 * Fica fora do componente para que o CreateMeetingModal seja só JSX.
 */
export function useCreateMeetingForm({ onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [participantQuery, setParticipantQuery] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [formError, setFormError] = useState(null);

  const { users, loading: searching } = useUserSearch(participantQuery);
  const createMeetingMutation = useCreateMeeting();

  // O organizador já fica incluído automaticamente (ver backend) — não faz sentido
  // sugerirmo-nos a nós próprios como convidado.
  const suggestions = users
    .filter((u) => u._id !== FIXED_USER_ID)
    .filter((u) => !selectedParticipants.some((p) => p._id === u._id));

  function updateField(field) {
    return (e) => {
      // O valor tem de ser lido já aqui, de forma síncrona — o React reutiliza/liberta
      // o evento depois do handler terminar, e o setForm(f => ...) só corre mais tarde
      // (na próxima renderização), altura em que e.currentTarget já seria null.
      const value = e.currentTarget.value;
      setForm((f) => ({ ...f, [field]: value }));
    };
  }

  function reset() {
    setForm(emptyForm);
    setParticipantQuery('');
    setSelectedParticipants([]);
    setFormError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function addParticipant(user) {
    setSelectedParticipants((prev) => [...prev, user]);
    setParticipantQuery('');
  }

  function removeParticipant(userId) {
    setSelectedParticipants((prev) => prev.filter((p) => p._id !== userId));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);

    if (!form.title || !form.description || !form.date || !form.startTime) {
      setFormError('Todos os campos são obrigatórios.');
      return;
    }
    // Validação replicada do backend só para feedback mais rápido — quem decide é a API.
    if (new Date(`${form.date}T${form.startTime}`).getTime() < Date.now()) {
      setFormError('Data/hora não pode estar no passado.');
      return;
    }

    try {
      await createMeetingMutation.mutateAsync({
        ...form,
        participantIds: selectedParticipants.map((p) => p._id),
      });
      notifications.show({ color: 'green', title: 'Reunião criada', message: form.title });
      reset();
      onCreated();
    } catch (err) {
      setFormError(err.message);
    }
  }

  return {
    form,
    participantQuery,
    setParticipantQuery,
    selectedParticipants,
    suggestions,
    searching,
    submitting: createMeetingMutation.isPending,
    formError,
    updateField,
    handleClose,
    addParticipant,
    removeParticipant,
    handleSubmit,
  };
}

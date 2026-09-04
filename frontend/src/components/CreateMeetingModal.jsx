import { useState } from 'react';
import { Badge, Button, Group, Loader, Modal, Stack, Text, TextInput, Textarea, UnstyledButton } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useUserSearch } from '../hooks/useUserSearch.js';
import { createMeeting } from '../api/meetings.js';
import { FIXED_USER_ID } from '../constants.js';

const emptyForm = { title: '', description: '', date: '', startTime: '' };

export function CreateMeetingModal({ opened, onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [participantQuery, setParticipantQuery] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const { users, loading: searching } = useUserSearch(participantQuery);
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

  function handleClose() {
    setForm(emptyForm);
    setParticipantQuery('');
    setSelectedParticipants([]);
    setFormError(null);
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

    setSubmitting(true);
    try {
      await createMeeting({ ...form, participantIds: selectedParticipants.map((p) => p._id) });
      notifications.show({ color: 'green', title: 'Reunião criada', message: form.title });
      handleClose();
      onCreated();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal opened={opened} onClose={handleClose} title="Criar reunião" size="md">
      <form onSubmit={handleSubmit}>
        <Stack>
          <TextInput label="Título" value={form.title} onChange={updateField('title')} required />
          <Textarea label="Descrição" value={form.description} onChange={updateField('description')} required />
          <Group grow>
            <TextInput type="date" label="Data" value={form.date} onChange={updateField('date')} required />
            <TextInput
              type="time"
              label="Hora de início"
              value={form.startTime}
              onChange={updateField('startTime')}
              required
            />
          </Group>

          <div>
            <TextInput
              label="Convidar participantes"
              placeholder="Pesquisar por username..."
              value={participantQuery}
              onChange={(e) => setParticipantQuery(e.currentTarget.value)}
              rightSection={searching ? <Loader size="xs" /> : null}
            />
            {suggestions.length > 0 && (
              <Stack gap={4} mt={4}>
                {suggestions.map((user) => (
                  <UnstyledButton
                    key={user._id}
                    onClick={() => addParticipant(user)}
                    p={8}
                    style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 4 }}
                  >
                    <Text size="sm">
                      {user.name}{' '}
                      <Text span c="dimmed">
                        @{user.username}
                      </Text>
                    </Text>
                  </UnstyledButton>
                ))}
              </Stack>
            )}
          </div>

          {selectedParticipants.length > 0 && (
            <Group gap="xs">
              {selectedParticipants.map((user) => (
                <Badge
                  key={user._id}
                  rightSection={
                    <UnstyledButton onClick={() => removeParticipant(user._id)} c="white">
                      ×
                    </UnstyledButton>
                  }
                >
                  {user.name}
                </Badge>
              ))}
            </Group>
          )}

          {formError && (
            <Text c="red" size="sm">
              {formError}
            </Text>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={submitting}>
              Criar
            </Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}

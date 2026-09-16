import { Badge, Button, Group, Loader, Modal, Stack, Text, TextInput, Textarea, UnstyledButton } from '@mantine/core';
import { useCreateMeetingForm } from '../hooks/useCreateMeetingForm.js';
import { EmptyState } from './RequestState.jsx';

export function CreateMeetingModal({ opened, onClose, onCreated }) {
  const {
    form,
    participantQuery,
    setParticipantQuery,
    selectedParticipants,
    suggestions,
    searching,
    submitting,
    formError,
    updateField,
    handleClose,
    addParticipant,
    removeParticipant,
    handleSubmit,
  } = useCreateMeetingForm({ onClose, onCreated });

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
            {!searching && suggestions.length === 0 && <EmptyState message="Nenhum utilizador encontrado." />}
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

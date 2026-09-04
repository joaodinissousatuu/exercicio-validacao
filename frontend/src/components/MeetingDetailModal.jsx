import { Badge, Group, Modal, Stack, Text } from '@mantine/core';
import { useMeeting } from '../hooks/useMeeting.js';
import { ErrorState, LoadingState } from './RequestState.jsx';

const STATUS_LABELS = {
  pending: { label: 'Pendente', color: 'yellow' },
  accepted: { label: 'Aceite', color: 'green' },
  declined: { label: 'Recusada', color: 'red' },
};

export function MeetingDetailModal({ meetingId, onClose }) {
  const { meeting, loading, error, refetch } = useMeeting(meetingId);

  return (
    <Modal opened={!!meetingId} onClose={onClose} title="Detalhe da reunião" size="md">
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={refetch} />}
      {meeting && (
        <Stack>
          <div>
            <Text fw={600} size="lg">
              {meeting.title}
            </Text>
            <Text c="dimmed">{meeting.description}</Text>
          </div>

          <Text size="sm">
            {meeting.date} às {meeting.startTime}
          </Text>

          <Text size="sm">
            Organizador: {meeting.organizerId.name}{' '}
            <Text span c="dimmed" size="sm">
              @{meeting.organizerId.username}
            </Text>
          </Text>

          <div>
            <Text fw={600} size="sm" mb={4}>
              Participantes
            </Text>
            <Stack gap={6}>
              {meeting.participants.map((p) => (
                <Group key={p.userId._id} justify="space-between">
                  <Text size="sm">
                    {p.userId.name}{' '}
                    <Text span c="dimmed" size="sm">
                      @{p.userId.username}
                    </Text>
                  </Text>
                  <Badge color={STATUS_LABELS[p.status].color}>{STATUS_LABELS[p.status].label}</Badge>
                </Group>
              ))}
            </Stack>
          </div>
        </Stack>
      )}
    </Modal>
  );
}

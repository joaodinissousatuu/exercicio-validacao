import { Button, Card, Group, Stack, Text } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import { FIXED_USER_ID } from '../constants.js';
import { StatusBadge } from './StatusBadge.jsx';

export function MeetingCard({ meeting, showActions, responding, onOpen, onAccept, onDecline }) {
  const myParticipant = meeting.participants.find((p) => p.userId === FIXED_USER_ID);

  return (
    <Card withBorder padding="md" radius="md">
      <Stack gap="xs">
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <Stack gap={2} style={{ cursor: 'pointer', flex: 1 }} onClick={() => onOpen(meeting)}>
            <Text fw={600}>{meeting.title}</Text>
            <Text size="sm" c="dimmed">
              {meeting.description}
            </Text>
            <Text size="sm">
              {meeting.date} às {meeting.startTime}
            </Text>
          </Stack>
          {myParticipant && <StatusBadge status={myParticipant.status} />}
        </Group>

        {showActions && meeting.hasConflict && (
          <Group gap={4}>
            <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" />
            <Text size="sm" c="red">
              Conflito com outra reunião já aceite
            </Text>
          </Group>
        )}

        {showActions && (
          <Group gap="sm">
            <Button
              size="xs"
              loading={responding === 'accepted'}
              disabled={!!responding}
              onClick={() => onAccept(meeting)}
            >
              Aceitar
            </Button>
            <Button
              size="xs"
              variant="light"
              color="red"
              loading={responding === 'declined'}
              disabled={!!responding}
              onClick={() => onDecline(meeting)}
            >
              Rejeitar
            </Button>
          </Group>
        )}
      </Stack>
    </Card>
  );
}

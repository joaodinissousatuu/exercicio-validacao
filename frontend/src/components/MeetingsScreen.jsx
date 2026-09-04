import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Group, Stack, Tabs, Title } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useMeetings } from '../hooks/useMeetings.js';
import { respondToInvite } from '../api/meetings.js';
import { FIXED_USER_ID } from '../constants.js';
import { MeetingCard } from './MeetingCard.jsx';
import { EmptyState, ErrorState, LoadingState } from './RequestState.jsx';
import { CreateMeetingModal } from './CreateMeetingModal.jsx';
import { MeetingDetailModal } from './MeetingDetailModal.jsx';

function isMyPending(meeting) {
  return meeting.participants.some((p) => p.userId === FIXED_USER_ID && p.status === 'pending');
}

export function MeetingsScreen() {
  const { meetings, loading, error, refetch } = useMeetings();
  const [createOpen, setCreateOpen] = useState(false);
  const [openMeetingId, setOpenMeetingId] = useState(null);
  const [respondingMeetingId, setRespondingMeetingId] = useState(null);
  const [respondingStatus, setRespondingStatus] = useState(null);

  const pendingMeetings = useMemo(() => meetings.filter(isMyPending), [meetings]);

  // Separador "Pendentes" só é aberto por defeito na primeira carga se houver
  // convites pendentes — depois disso respeita sempre o separador escolhido pelo utilizador.
  const [activeTab, setActiveTab] = useState('pending');
  const initializedRef = useRef(false);
  useEffect(() => {
    if (!loading && !initializedRef.current) {
      setActiveTab(pendingMeetings.length > 0 ? 'pending' : 'all');
      initializedRef.current = true;
    }
  }, [loading, pendingMeetings.length]);

  async function handleRespond(meeting, status) {
    setRespondingMeetingId(meeting._id);
    setRespondingStatus(status);
    try {
      await respondToInvite(meeting._id, FIXED_USER_ID, status);
      await refetch();
    } catch (err) {
      notifications.show({
        color: 'red',
        title: 'Não foi possível responder ao convite',
        message: err.message,
      });
    } finally {
      setRespondingMeetingId(null);
      setRespondingStatus(null);
    }
  }

  function renderList(list, { showActions, emptyMessage }) {
    if (loading) return <LoadingState />;
    if (error) return <ErrorState message={error} onRetry={refetch} />;
    if (list.length === 0) return <EmptyState message={emptyMessage} />;

    return (
      <Stack gap="sm" mt="md">
        {list.map((meeting) => (
          <MeetingCard
            key={meeting._id}
            meeting={meeting}
            showActions={showActions}
            responding={meeting._id === respondingMeetingId ? respondingStatus : null}
            onOpen={(m) => setOpenMeetingId(m._id)}
            onAccept={(m) => handleRespond(m, 'accepted')}
            onDecline={(m) => handleRespond(m, 'declined')}
          />
        ))}
      </Stack>
    );
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Reuniões</Title>
        <Button onClick={() => setCreateOpen(true)}>Criar reunião</Button>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="pending">Pendentes</Tabs.Tab>
          <Tabs.Tab value="all">Todas</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="pending">
          {renderList(pendingMeetings, { showActions: true, emptyMessage: 'Sem reuniões pendentes.' })}
        </Tabs.Panel>
        <Tabs.Panel value="all">
          {renderList(meetings, { showActions: false, emptyMessage: 'Ainda não tens reuniões.' })}
        </Tabs.Panel>
      </Tabs>

      <CreateMeetingModal
        opened={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setCreateOpen(false);
          refetch();
        }}
      />

      <MeetingDetailModal meetingId={openMeetingId} onClose={() => setOpenMeetingId(null)} />
    </Stack>
  );
}

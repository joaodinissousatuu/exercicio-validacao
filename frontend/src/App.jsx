import { Container, Group, Text, ThemeIcon, Title } from '@mantine/core';
import { IconUserCircle } from '@tabler/icons-react';
import { FIXED_USER_NAME } from './constants.js';
import { MeetingsScreen } from './components/MeetingsScreen.jsx';

function TopBar() {
  return (
    <Group
      justify="space-between"
      px="md"
      py="sm"
      style={{ borderBottom: '1px solid var(--mantine-color-gray-3)' }}
    >
      <Title order={3}>Reuniões</Title>
      <Group gap={6}>
        <ThemeIcon variant="light" radius="xl">
          <IconUserCircle size={18} />
        </ThemeIcon>
        <Text size="sm">{FIXED_USER_NAME}</Text>
      </Group>
    </Group>
  );
}

export default function App() {
  return (
    <>
      <TopBar />
      <Container size="sm" py="lg">
        <MeetingsScreen />
      </Container>
    </>
  );
}

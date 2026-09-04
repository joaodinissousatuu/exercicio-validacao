import { Alert, Button, Center, Loader, Text } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';

export function LoadingState() {
  return (
    <Center py="xl">
      <Loader />
    </Center>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <Alert color="red" title="Ocorreu um erro" icon={<IconAlertCircle />} my="md">
      <Text mb={onRetry ? 'sm' : 0}>{message}</Text>
      {onRetry && (
        <Button size="xs" variant="light" color="red" onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </Alert>
  );
}

export function EmptyState({ message }) {
  return (
    <Center py="xl">
      <Text c="dimmed">{message}</Text>
    </Center>
  );
}

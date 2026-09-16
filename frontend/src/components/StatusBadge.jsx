import { Badge } from '@mantine/core';

export const STATUS_LABELS = {
  pending: { label: 'Pendente', color: 'yellow' },
  accepted: { label: 'Aceite', color: 'green' },
  declined: { label: 'Recusada', color: 'red' },
};

export function StatusBadge({ status }) {
  const statusInfo = STATUS_LABELS[status];
  if (!statusInfo) return null;

  return <Badge color={statusInfo.color}>{statusInfo.label}</Badge>;
}

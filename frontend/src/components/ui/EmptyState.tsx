import { Card } from "./Card";

interface EmptyStateProps {
  message: string;
}

export function EmptyState({ message }: EmptyStateProps) {
  return (
    <Card padding={false}>
      <p className="py-12 text-center text-sm text-gray-400">{message}</p>
    </Card>
  );
}


export interface RealtimeMessage<T = any> {
  tenantId: string | null;
  userId: string | null;
  event: string;
  data: T;
}

export interface RealtimeTransport {
  emit(message: RealtimeMessage): void;
}

export type SystemNotificationSeverityFilter = 'info' | 'warning' | 'critical';

export class ListSystemNotificationsQueryDto {
  page?: string;
  limit?: string;
  isRead?: string;
  unreadOnly?: string;
  severity?: string;
}

export class MarkSystemNotificationReadParamsDto {
  id!: string;
}

export class ReadAllSystemNotificationsDto {
  targetRole?: string;
  targetUserId?: string;
}

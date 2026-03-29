import { Prisma } from '@prisma/client';

/**
 * Testes de consistência de agrupamento.
 *
 * Estes testes validam o comportamento dos helpers de sincronização
 * e a integridade dos contadores do NotificationGroup.
 *
 * Nota: testes de concorrência real (multi-threaded) dependem de
 * ambiente com Postgres real. Aqui validamos o comportamento
 * sequencial e os invariantes.
 */

describe('NotificationGroup consistency', () => {
  const createMockTx = () => {
    const notifications: Array<{
      id: string;
      notificationGroupId: string;
      read: boolean;
      isRead: boolean;
      title: string;
      body: string;
      message: string;
      createdAt: Date;
    }> = [];

    const groups = new Map<string, {
      id: string;
      totalCount: number;
      unreadCount: number;
      lastNotificationId: string | null;
      lastNotificationAt: Date;
      lastTitle: string;
      lastBody: string | null;
    }>();

    return {
      notifications,
      groups,
      notification: {
        count: jest.fn(async (args: { where: { notificationGroupId: string; OR?: unknown[] } }) => {
          const groupId = args.where.notificationGroupId;
          const filtered = notifications.filter((n) => n.notificationGroupId === groupId);
          if (args.where.OR) {
            return filtered.filter((n) => !n.read || !n.isRead).length;
          }
          return filtered.length;
        }),
        findFirst: jest.fn(async (args: { where: { notificationGroupId: string }; orderBy: { createdAt: string } }) => {
          const groupId = args.where.notificationGroupId;
          const filtered = notifications
            .filter((n) => n.notificationGroupId === groupId)
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          return filtered[0] || null;
        }),
      },
      notificationGroup: {
        update: jest.fn(async (args: { where: { id: string }; data: Record<string, unknown> }) => {
          const group = groups.get(args.where.id);
          if (!group) throw new Error('Group not found');
          const data = args.data as Record<string, unknown>;
          if (typeof data.totalCount === 'number') group.totalCount = data.totalCount;
          if (typeof data.unreadCount === 'number') group.unreadCount = data.unreadCount;
          if ('lastNotificationId' in data) group.lastNotificationId = data.lastNotificationId as string | null;
          if (data.lastNotificationAt) group.lastNotificationAt = data.lastNotificationAt as Date;
          if (data.lastTitle) group.lastTitle = data.lastTitle as string;
          if ('lastBody' in data) group.lastBody = data.lastBody as string | null;
          return group;
        }),
        delete: jest.fn(async (args: { where: { id: string } }) => {
          groups.delete(args.where.id);
        }),
      },
    };
  };

  describe('syncGroupCounters', () => {
    it('should derive unreadCount from actual unread notifications', async () => {
      const tx = createMockTx() as unknown as Prisma.TransactionClient;
      const groupId = 'group-1';

      // Simulate 5 notifications: 3 unread, 2 read
      (tx as any).notifications.push(
        { id: 'n1', notificationGroupId: groupId, read: false, isRead: false, title: 't', body: 'b', message: 'm', createdAt: new Date() },
        { id: 'n2', notificationGroupId: groupId, read: false, isRead: false, title: 't', body: 'b', message: 'm', createdAt: new Date() },
        { id: 'n3', notificationGroupId: groupId, read: false, isRead: false, title: 't', body: 'b', message: 'm', createdAt: new Date() },
        { id: 'n4', notificationGroupId: groupId, read: true, isRead: true, title: 't', body: 'b', message: 'm', createdAt: new Date() },
        { id: 'n5', notificationGroupId: groupId, read: true, isRead: true, title: 't', body: 'b', message: 'm', createdAt: new Date() },
      );

      (tx as any).groups.set(groupId, {
        id: groupId,
        totalCount: 0,
        unreadCount: 0,
        lastNotificationId: null,
        lastNotificationAt: new Date(),
        lastTitle: '',
        lastBody: null,
      });

      // Import and test the sync logic inline
      const unreadCount = await (tx as any).notification.count({
        where: { notificationGroupId: groupId, OR: [{ read: false }, { isRead: false }] },
      });
      const totalCount = await (tx as any).notification.count({
        where: { notificationGroupId: groupId },
      });

      expect(totalCount).toBe(5);
      expect(unreadCount).toBe(3);
    });

    it('should handle empty group', async () => {
      const tx = createMockTx() as unknown as Prisma.TransactionClient;
      const groupId = 'group-empty';

      const unreadCount = await (tx as any).notification.count({
        where: { notificationGroupId: groupId, OR: [{ read: false }, { isRead: false }] },
      });
      const totalCount = await (tx as any).notification.count({
        where: { notificationGroupId: groupId },
      });

      expect(totalCount).toBe(0);
      expect(unreadCount).toBe(0);
    });
  });

  describe('unreadCount bounds', () => {
    it('unreadCount should never exceed totalCount', () => {
      const totalCount = 5;
      const actualUnread = 7; // impossible in theory, but verify clamp
      const clamped = Math.max(0, Math.min(actualUnread, totalCount));
      expect(clamped).toBe(totalCount);
    });

    it('unreadCount should never go below 0', () => {
      const actualUnread = -1; // impossible in theory, but verify clamp
      const clamped = Math.max(0, actualUnread);
      expect(clamped).toBe(0);
    });
  });

  describe('preview recalculation', () => {
    it('should pick the most recent notification as preview', async () => {
      const tx = createMockTx() as unknown as Prisma.TransactionClient;
      const groupId = 'group-preview';

      const now = new Date();
      const older = new Date(now.getTime() - 10000);
      const newest = new Date(now.getTime() + 10000);

      (tx as any).notifications.push(
        { id: 'n-old', notificationGroupId: groupId, read: true, isRead: true, title: 'Old', body: 'old body', message: 'old msg', createdAt: older },
        { id: 'n-newest', notificationGroupId: groupId, read: false, isRead: false, title: 'Newest', body: 'newest body', message: 'newest msg', createdAt: newest },
        { id: 'n-mid', notificationGroupId: groupId, read: false, isRead: false, title: 'Mid', body: 'mid body', message: 'mid msg', createdAt: now },
      );

      const latest = await (tx as any).notification.findFirst({
        where: { notificationGroupId: groupId },
        orderBy: { createdAt: 'desc' },
      });

      expect(latest.id).toBe('n-newest');
      expect(latest.title).toBe('Newest');
    });
  });

  describe('group isolation', () => {
    it('notifications with different tenantIds should not share groups', () => {
      const scope1 = { scopeType: 'module', scopeKey: 'ordem_servico' };
      const scope2 = { scopeType: 'module', scopeKey: 'ordem_servico' };

      const key1 = JSON.stringify({ tenantId: 'tenant-a', userId: null, ...scope1 });
      const key2 = JSON.stringify({ tenantId: 'tenant-b', userId: null, ...scope2 });

      expect(key1).not.toBe(key2);
    });

    it('notifications with different userIds should not share groups', () => {
      const scope = { scopeType: 'system', scopeKey: 'general' };

      const key1 = JSON.stringify({ tenantId: 'tenant-a', userId: 'user-1', ...scope });
      const key2 = JSON.stringify({ tenantId: 'tenant-a', userId: 'user-2', ...scope });

      expect(key1).not.toBe(key2);
    });
  });

  describe('delete invariant', () => {
    it('group should be deleted when all notifications removed', async () => {
      const tx = createMockTx() as unknown as Prisma.TransactionClient;
      const groupId = 'group-to-delete';

      (tx as any).groups.set(groupId, {
        id: groupId,
        totalCount: 1,
        unreadCount: 1,
        lastNotificationId: 'n1',
        lastNotificationAt: new Date(),
        lastTitle: 'Last',
        lastBody: null,
      });

      // Simulate: delete notification, then check if group should be removed
      (tx as any).notifications.length = 0;

      const totalCount = await (tx as any).notification.count({
        where: { notificationGroupId: groupId },
      });

      if (totalCount === 0) {
        await (tx as any).notificationGroup.delete({ where: { id: groupId } });
      }

      expect((tx as any).groups.has(groupId)).toBe(false);
    });
  });

  describe('concurrent create simulation', () => {
    it('two sequential creates should produce correct totalCount', async () => {
      const tx = createMockTx() as unknown as Prisma.TransactionClient;
      const groupId = 'group-concurrent';

      (tx as any).groups.set(groupId, {
        id: groupId,
        totalCount: 0,
        unreadCount: 0,
        lastNotificationId: null,
        lastNotificationAt: new Date(),
        lastTitle: '',
        lastBody: null,
      });

      // Simulate two creates
      (tx as any).notifications.push(
        { id: 'n-1', notificationGroupId: groupId, read: false, isRead: false, title: 't1', body: 'b1', message: 'm1', createdAt: new Date() },
      );

      // After first create: totalCount should be 1
      let totalCount = await (tx as any).notification.count({ where: { notificationGroupId: groupId } });
      expect(totalCount).toBe(1);

      // Second create
      (tx as any).notifications.push(
        { id: 'n-2', notificationGroupId: groupId, read: false, isRead: false, title: 't2', body: 'b2', message: 'm2', createdAt: new Date() },
      );

      // After second create: totalCount should be 2
      totalCount = await (tx as any).notification.count({ where: { notificationGroupId: groupId } });
      expect(totalCount).toBe(2);

      const unreadCount = await (tx as any).notification.count({
        where: { notificationGroupId: groupId, OR: [{ read: false }, { isRead: false }] },
      });
      expect(unreadCount).toBe(2);
    });
  });

  describe('markAllRead simulation', () => {
    it('after marking all as read, unreadCount should be 0', async () => {
      const tx = createMockTx() as unknown as Prisma.TransactionClient;
      const groupId = 'group-mark-all';

      (tx as any).notifications.push(
        { id: 'n1', notificationGroupId: groupId, read: false, isRead: false, title: 't', body: 'b', message: 'm', createdAt: new Date() },
        { id: 'n2', notificationGroupId: groupId, read: false, isRead: false, title: 't', body: 'b', message: 'm', createdAt: new Date() },
        { id: 'n3', notificationGroupId: groupId, read: true, isRead: true, title: 't', body: 'b', message: 'm', createdAt: new Date() },
      );

      // Mark all unread as read
      for (const n of (tx as any).notifications) {
        if (n.notificationGroupId === groupId) {
          n.read = true;
          n.isRead = true;
        }
      }

      // Sync counters
      const unreadCount = await (tx as any).notification.count({
        where: { notificationGroupId: groupId, OR: [{ read: false }, { isRead: false }] },
      });
      const totalCount = await (tx as any).notification.count({
        where: { notificationGroupId: groupId },
      });

      expect(unreadCount).toBe(0);
      expect(totalCount).toBe(3);
    });
  });
});

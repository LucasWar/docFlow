export type CreateSession = {
  refreshTokenJti: string;
  userId: string;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
};

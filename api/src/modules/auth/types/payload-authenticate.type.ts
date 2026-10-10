export type AuthenticatePayloadType = {
  sub: string;
  jtiRefresh: string;
  jtiAccess: string;
  sessionId: string;
  email: string;
};

export type AccessTokenPayloadType = {
  sub: string;
  jti: string;
  sessionId: string;
  email: string;
  type: 'access';
};

export type RefreshTokenPayloadType = {
  sub: string;
  jti: string;
  sessionId: string;
  type: 'refresh';
};

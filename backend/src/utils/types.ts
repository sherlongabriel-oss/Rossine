export type UserRole = "ADMIN" | "SUPERVISOR" | "ATTENDANT";

export interface AuthPayload {
  userId: string;
  companyId: string;
  role: UserRole;
}

export interface AuthRequest extends Express.Request {
  user?: AuthPayload;
}

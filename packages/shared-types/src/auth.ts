import { z } from "zod";

export const LoginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
}).strict();

export type LoginRequest = z.infer<typeof LoginRequestSchema>;

export const AuthUserRoleEnum = z.enum(["MEMBER", "OFFICER", "ADMIN"]);

export type AuthUserRole = z.infer<typeof AuthUserRoleEnum>;

export const AuthUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().email(),
  username: z.string().min(1),
  role: AuthUserRoleEnum
}).strict();

export type AuthUser = z.infer<typeof AuthUserSchema>;

export const LoginResponseSchema = z.object({
  token: z.string().min(1),
  user: AuthUserSchema
}).strict();

export type LoginResponse = z.infer<typeof LoginResponseSchema>;

const EmailSchema = z.string().trim().email().max(254);
const UsernameSchema = z.string().trim().min(2).max(32);
// bcrypt only uses the first 72 bytes of a password.
const PasswordSchema = z.string().min(6).max(72);

export const RegisterRequestSchema = z.object({
  email: EmailSchema,
  username: UsernameSchema,
  password: PasswordSchema
}).strict();

export type RegisterRequest = z.infer<typeof RegisterRequestSchema>;

export const CreateUserAdminSchema = z.object({
  email: EmailSchema,
  username: UsernameSchema,
  password: PasswordSchema,
  role: AuthUserRoleEnum
}).strict();

export type CreateUserAdmin = z.infer<typeof CreateUserAdminSchema>;

export const UpdateUserRoleRequestSchema = z.object({
  role: AuthUserRoleEnum
}).strict();

export type UpdateUserRoleRequest = z.infer<typeof UpdateUserRoleRequestSchema>;

export const UpdateUsernameRequestSchema = z.object({
  username: UsernameSchema
}).strict();

export type UpdateUsernameRequest = z.infer<typeof UpdateUsernameRequestSchema>;

export const ManagedUserSchema = AuthUserSchema.extend({
  createdAt: z.number().int().nonnegative(),
  isRootAdmin: z.boolean()
}).strict();

export type ManagedUser = z.infer<typeof ManagedUserSchema>;

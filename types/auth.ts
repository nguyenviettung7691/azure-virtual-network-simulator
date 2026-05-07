export interface AuthUser {
  userId: string
  username: string
  email: string
  attributes?: Record<string, string>
}

export type AuthMode = 'login' | 'register' | 'forgot'
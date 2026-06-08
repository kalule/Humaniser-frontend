import client from './client'
import type { UserProfile, UsageStats } from '../types'

export interface UpdateProfileDto {
  name?: string
  email?: string
  passwordConfirmation?: string
}

export interface ChangePasswordDto {
  currentPassword: string
  newPassword: string
}

export const userApi = {
  getProfile: () =>
    client.get<UserProfile>('/api/v1/user/profile'),

  updateProfile: (dto: UpdateProfileDto) =>
    client.put<UserProfile>('/api/v1/user/profile', dto),

  changePassword: (dto: ChangePasswordDto) =>
    client.put<void>('/api/v1/user/password', dto),

  getUsage: () =>
    client.get<UsageStats>('/api/v1/user/usage'),

  deleteAccount: (password: string) =>
    client.delete<void>('/api/v1/user/account', { data: { password } }),
}

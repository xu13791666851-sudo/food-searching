import { UserPreferences } from '../types';

export type ProfileSyncStatus = 'loading' | 'saving' | 'synced' | 'local';

const PROFILE_ID_KEY = 'food_app_anonymous_profile_id';

export function getAnonymousProfileId() {
  try {
    const existing = localStorage.getItem(PROFILE_ID_KEY);
    if (existing) return existing;
    const created =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `profile-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
    localStorage.setItem(PROFILE_ID_KEY, created);
    return created;
  } catch {
    return `profile-${Date.now()}-${Math.random().toString(36).slice(2, 14)}`;
  }
}

export async function loadRemoteProfile(profileId: string) {
  const response = await fetch('/api/profile', {
    headers: { 'X-Profile-Id': profileId },
    credentials: 'same-origin',
  });
  const data = await response.json();
  if (!response.ok || !data?.ok) {
    throw new Error(data?.message || '偏好读取失败');
  }
  return data.profile as Partial<UserPreferences> | null;
}

export async function saveRemoteProfile(
  profileId: string,
  preferences: UserPreferences,
) {
  const response = await fetch('/api/profile', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Profile-Id': profileId,
    },
    credentials: 'same-origin',
    body: JSON.stringify({ preferences }),
  });
  const data = await response.json();
  if (!response.ok || !data?.ok || !data?.stored) {
    throw new Error(data?.message || '偏好保存失败');
  }
}

import { apiRequest } from './queryClient';
import { authRequest } from './authRequest';
import type { LoginUser, RegisterUser, User } from '@shared/schema';

const TOKEN_KEY = 'auth_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getAuthHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function login(credentials: LoginUser): Promise<{ token: string; user: User }> {
  const response = await apiRequest('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Login failed');
  }
  
  setAuthToken(data.token);
  return data;
}

export async function register(userData: RegisterUser): Promise<{ token: string; user: User }> {
  const response = await apiRequest('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(userData),
  });
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.message || 'Registration failed');
  }
  
  setAuthToken(data.token);
  return data;
}

export async function logout(): Promise<void> {
  try {
    // Try to call the logout endpoint if available
    await apiRequest('/api/auth/logout', {
      method: 'POST',
      headers: getAuthHeaders(),
    });
  } catch (error) {
    // If endpoint doesn't exist or fails, still proceed with client-side logout
    console.log('Server logout failed, proceeding with client-side logout');
  }
  
  removeAuthToken();
}

export async function getCurrentUser(): Promise<User> {
  const token = getAuthToken();
  if (!token) throw new Error('401: Not signed in');
  const data = await authRequest<User & { token?: string }>('/api/auth/me', {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
  }, removeAuthToken);
  if (!data) throw new Error('401: Session expired');

  // Auto-refresh: save the new token returned by the server
  if (data.token) {
    setAuthToken(data.token);
  }

  return data;
}
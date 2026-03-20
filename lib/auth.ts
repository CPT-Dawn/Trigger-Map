import type { AuthError, Session, User } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase, supabaseConfigError } from '@/lib/supabase';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ResultOk<T> = { data: T; error: null };
type ResultErr = { data: null; error: string };
type ServiceResult<T> = ResultOk<T> | ResultErr;

function success<T>(data: T): ResultOk<T> {
  return { data, error: null };
}

function failure<T>(error: string): ServiceResult<T> {
  return { data: null, error };
}

function ensureConfigured<T>(): ServiceResult<T> | null {
  if (!isSupabaseConfigured) {
    return failure<T>(supabaseConfigError);
  }
  return null;
}

function toFriendlyAuthError(error: unknown) {
  if (!error) return 'Something went wrong. Please try again.';
  if (typeof error === 'string') return error;
  const authError = error as AuthError & { message?: string };
  const message = authError.message ?? 'Authentication failed. Please try again.';

  if (message.toLowerCase().includes('invalid login credentials')) {
    return 'Incorrect email or password.';
  }
  if (message.toLowerCase().includes('email not confirmed')) {
    return 'Check your inbox and confirm your email before logging in.';
  }
  if (message.toLowerCase().includes('rate limit')) {
    return 'Too many attempts. Please wait and try again.';
  }
  if (message.toLowerCase().includes('network')) {
    return 'Network error. Check your connection and try again.';
  }

  return message;
}

export function validateEmail(email: string): ServiceResult<true> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) return failure('Email is required.');
  if (!EMAIL_REGEX.test(trimmed)) return failure('Enter a valid email address.');
  return success(true);
}

export function validatePassword(password: string): ServiceResult<true> {
  if (!password) return failure('Password is required.');
  if (password.length < 8) return failure('Password must be at least 8 characters.');
  return success(true);
}

export function validateFullName(name: string): ServiceResult<true> {
  const trimmed = name.trim();
  if (!trimmed) return failure('Full name is required.');
  if (trimmed.length < 2) return failure('Full name must be at least 2 characters.');
  if (trimmed.length > 60) return failure('Full name must be 60 characters or fewer.');
  return success(true);
}

export async function signInWithEmail(email: string, password: string): Promise<ServiceResult<Session>> {
  const configError = ensureConfigured<Session>();
  if (configError) return configError;

  const emailValidation = validateEmail(email);
  if (emailValidation.error) return failure(emailValidation.error);

  const passwordValidation = validatePassword(password);
  if (passwordValidation.error) return failure(passwordValidation.error);

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) return failure(toFriendlyAuthError(error));
  if (!data.session) return failure('No active session returned. Try again.');
  return success(data.session);
}

export async function signUpWithEmail(params: {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): Promise<ServiceResult<{ session: Session | null; needsEmailConfirmation: boolean }>> {
  const configError = ensureConfigured<{ session: Session | null; needsEmailConfirmation: boolean }>();
  if (configError) return configError;

  const nameValidation = validateFullName(params.fullName);
  if (nameValidation.error) return failure(nameValidation.error);
  const name = params.fullName.trim();

  const emailValidation = validateEmail(params.email);
  if (emailValidation.error) return failure(emailValidation.error);

  const passwordValidation = validatePassword(params.password);
  if (passwordValidation.error) return failure(passwordValidation.error);

  if (params.password !== params.confirmPassword) {
    return failure('Passwords do not match.');
  }

  const { data, error } = await supabase.auth.signUp({
    email: params.email.trim().toLowerCase(),
    password: params.password,
    options: {
      data: {
        full_name: name,
      },
    },
  });

  if (error) return failure(toFriendlyAuthError(error));

  return success({
    session: data.session,
    needsEmailConfirmation: !data.session,
  });
}

export async function sendPasswordResetEmail(email: string): Promise<ServiceResult<true>> {
  const configError = ensureConfigured<true>();
  if (configError) return configError;

  const emailValidation = validateEmail(email);
  if (emailValidation.error) return failure(emailValidation.error);

  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
    redirectTo: 'triggermap://login',
  });
  if (error) return failure(toFriendlyAuthError(error));

  return success(true);
}

export async function getCurrentUser(): Promise<ServiceResult<User | null>> {
  const configError = ensureConfigured<User | null>();
  if (configError) return configError;

  const { data, error } = await supabase.auth.getUser();
  if (error) return failure(toFriendlyAuthError(error));
  return success(data.user ?? null);
}

export async function updateCurrentUserProfile(fullName: string): Promise<ServiceResult<User>> {
  const configError = ensureConfigured<User>();
  if (configError) return configError;

  const nameValidation = validateFullName(fullName);
  if (nameValidation.error) return failure(nameValidation.error);

  const { data, error } = await supabase.auth.updateUser({
    data: {
      full_name: fullName.trim(),
    },
  });

  if (error) return failure(toFriendlyAuthError(error));
  if (!data.user) return failure('Profile update did not return a user.');
  return success(data.user);
}

export async function signOutCurrentUser(): Promise<ServiceResult<true>> {
  const configError = ensureConfigured<true>();
  if (configError) return configError;

  const { error } = await supabase.auth.signOut();
  if (error) return failure(toFriendlyAuthError(error));
  return success(true);
}

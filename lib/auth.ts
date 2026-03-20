import { makeRedirectUri } from 'expo-auth-session';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import * as WebBrowser from 'expo-web-browser';
import type { AuthError, Session } from '@supabase/supabase-js';

import { isSupabaseConfigured, supabase, supabaseConfigError } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

const E164_PHONE_REGEX = /^\+[1-9]\d{6,14}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ResultOk<T> = { data: T; error: null };
type ResultErr = { data: null; error: string };
type ServiceResult<T> = ResultOk<T> | ResultErr;

type OAuthStatus = 'success' | 'cancelled';

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

export function normalizePhone(phone: string): ServiceResult<string> {
  const compact = phone.replace(/[^\d+]/g, '');
  if (!compact) return failure('Phone number is required.');
  if (!compact.startsWith('+')) return failure('Use full phone format with country code, e.g. +15551234567.');
  if (!E164_PHONE_REGEX.test(compact)) return failure('Enter a valid phone number in E.164 format.');
  return success(compact);
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

  const name = params.fullName.trim();
  if (!name) return failure('Full name is required.');

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

  const redirectTo = makeRedirectUri({ path: 'login' });
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
  if (error) return failure(toFriendlyAuthError(error));

  return success(true);
}

export async function signInWithGoogleOAuth(): Promise<ServiceResult<{ status: OAuthStatus }>> {
  const configError = ensureConfigured<{ status: OAuthStatus }>();
  if (configError) return configError;

  const redirectTo = makeRedirectUri({
    scheme: 'triggermap',
    path: 'auth/callback',
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) return failure(toFriendlyAuthError(error));
  if (!data.url) return failure('Unable to open Google sign-in at the moment.');

  const browserResult = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);

  if (browserResult.type === 'cancel' || browserResult.type === 'dismiss') {
    return success({ status: 'cancelled' });
  }

  if (browserResult.type !== 'success') {
    return failure('Google sign-in was not completed.');
  }

  const { params, errorCode } = QueryParams.getQueryParams(browserResult.url);

  if (errorCode) {
    return failure(`Google sign-in error: ${errorCode}`);
  }

  const code = params.code;
  if (!code || typeof code !== 'string') {
    return failure('Google sign-in did not return an authorization code.');
  }

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) return failure(toFriendlyAuthError(exchangeError));

  return success({ status: 'success' });
}

export async function sendPhoneOtp(phone: string): Promise<ServiceResult<{ normalizedPhone: string }>> {
  const configError = ensureConfigured<{ normalizedPhone: string }>();
  if (configError) return configError;

  const normalized = normalizePhone(phone);
  if (normalized.error) return failure(normalized.error);
  const normalizedPhone = normalized.data;
  if (!normalizedPhone) return failure('Invalid phone number.');

  const { error } = await supabase.auth.signInWithOtp({
    phone: normalizedPhone,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) return failure(toFriendlyAuthError(error));

  return success({ normalizedPhone });
}

export async function verifyPhoneOtp(phone: string, token: string): Promise<ServiceResult<Session>> {
  const configError = ensureConfigured<Session>();
  if (configError) return configError;

  const normalized = normalizePhone(phone);
  if (normalized.error) return failure(normalized.error);
  const normalizedPhone = normalized.data;
  if (!normalizedPhone) return failure('Invalid phone number.');

  const otp = token.trim();
  if (!/^\d{4,8}$/.test(otp)) {
    return failure('Enter a valid numeric OTP code.');
  }

  const { data, error } = await supabase.auth.verifyOtp({
    phone: normalizedPhone,
    token: otp,
    type: 'sms',
  });

  if (error) return failure(toFriendlyAuthError(error));
  if (!data.session) return failure('Verification succeeded but no session was returned.');
  return success(data.session);
}

export async function resendPhoneOtp(phone: string): Promise<ServiceResult<true>> {
  const configError = ensureConfigured<true>();
  if (configError) return configError;

  const normalized = normalizePhone(phone);
  if (normalized.error) return failure(normalized.error);
  const normalizedPhone = normalized.data;
  if (!normalizedPhone) return failure('Invalid phone number.');

  const { error } = await supabase.auth.resend({
    type: 'sms',
    phone: normalizedPhone,
  });

  if (error) return failure(toFriendlyAuthError(error));
  return success(true);
}

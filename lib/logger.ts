export function logWarn(message: string, context?: unknown) {
  if (!__DEV__) {
    return;
  }

  if (context === undefined) {
    console.warn(message);
    return;
  }

  console.warn(message, context);
}

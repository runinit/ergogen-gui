export function storageKey(key: string): string {
  if (
    process.env.REACT_APP_DEPLOYMENT_CHANNEL !== 'preview' ||
    key.startsWith('preview:')
  ) {
    return key;
  }
  return `preview:${key}`;
}

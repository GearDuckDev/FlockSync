export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'electron') {
    return nextResolve(new URL('./electronMock.ts', import.meta.url).href, context);
  }
  if (specifier.startsWith('.') && !/\.[a-zA-Z0-9]+$/.test(specifier)) {
    try {
      return await nextResolve(`${specifier}.ts`, context);
    } catch {
      return nextResolve(specifier, context);
    }
  }
  return nextResolve(specifier, context);
}

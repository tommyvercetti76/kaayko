const SRC = new URL('../src', import.meta.url).href;
export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('/js/') || specifier.startsWith('/css/')) {
    return nextResolve(SRC + specifier, context);
  }
  return nextResolve(specifier, context);
}

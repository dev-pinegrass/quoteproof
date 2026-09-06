export function registerReader(read: () => unknown) {
  const context = (
    document as Document & {
      modelContext?: {
        registerTool: (
          tool: unknown,
          options: { signal: AbortSignal },
        ) => void | Promise<void>;
      };
    }
  ).modelContext;
  if (!context) return;
  const lifecycle = new AbortController();
  try {
    void Promise.resolve(
      context.registerTool(
        {
          name: 'read_quote_comparison',
          description:
            'Read the current visible review. Does not analyze, approve, contact anyone, or publish anything.',
          inputSchema: {
            type: 'object',
            properties: {},
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute(input: unknown) {
            if (
              !input ||
              typeof input !== 'object' ||
              Object.keys(input).length
            )
              throw Error('Expected an empty object.');
            return read();
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
  } catch {}
  return () => lifecycle.abort();
}

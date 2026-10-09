import { afterEach, expect, it, vi } from 'vitest';
import { enrichWordWithAI } from '../src/services/ai';
import { clearAICache } from '../src/services/ai/aiCache';

afterEach(() => { clearAICache(); vi.unstubAllGlobals(); });
const config = { provider: 'custom' as const, apiKey: '', baseUrl: 'https://provider.invalid' };

it('keeps separate learning senses and reuses only the matching result', async () => {
  const fetcher = vi.fn(async (_url, init) => {
    const sense = String(init.body).includes('ngân hàng') ? 'ngân hàng' : 'bờ sông';
    return Response.json({ choices: [{ message: { content: JSON.stringify({ vietnameseDefinition: sense }) } }] });
  });
  vi.stubGlobal('fetch', fetcher);
  const first = await enrichWordWithAI('bank', 'noun', config, undefined, 'ngân hàng');
  const second = await enrichWordWithAI('bank', 'noun', config, undefined, 'bờ sông');
  const repeated = await enrichWordWithAI('bank', 'noun', config, undefined, 'ngân hàng');
  expect([first?.vietnameseDefinition, second?.vietnameseDefinition, repeated?.vietnameseDefinition])
    .toEqual(['ngân hàng', 'bờ sông', 'ngân hàng']);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('manual retranslation bypasses a warm AI cache', async () => {
  let count = 0;
  vi.stubGlobal('fetch', async () => Response.json({ choices: [{ message: {
    content: JSON.stringify({ vietnameseDefinition: `meaning ${++count}` }),
  } }] }));
  await enrichWordWithAI('bank', 'noun', config);
  const refreshed = await enrichWordWithAI('bank', 'noun', { ...config, forceReTranslate: true });
  expect(refreshed?.vietnameseDefinition).toBe('meaning 2');
});

it('preserves the intended learning sense while allowing a clearer Vietnamese equivalent', async () => {
  let prompt = '';
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    prompt = body.messages.find((message: { role: string }) => message.role === 'user').content;
    return Response.json({ choices: [{ message: { content: JSON.stringify({ vietnameseDefinition: 'bờ sông' }) } }] });
  });

  const intendedMeaning = 'Phần đất ở hai bên một con sông';
  const result = await enrichWordWithAI('bank', 'noun', config, undefined, intendedMeaning);
  expect(prompt).toContain(`TARGET LEARNING SENSE: "${intendedMeaning}"`);
  expect(prompt).toContain('Preserve its meaning, but rewrite it as concise, natural Vietnamese equivalents');
  expect(prompt).not.toContain('MUST prioritize and match this exact intended meaning');
  expect(result?.vietnameseDefinition).toBe('bờ sông');
});

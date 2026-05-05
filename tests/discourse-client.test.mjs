import { describe, expect, it } from 'vitest';
import { DiscourseClient } from '../src/discourse-client.mjs';
import { installTheme } from '../src/theme-installer.mjs';

describe('discourse adapters', () => {
  it('constructs authenticated request headers and urls', async () => {
    const calls = [];
    const client = new DiscourseClient({
      baseUrl: 'https://discourse.example.com/',
      apiKey: 'test-key',
      apiUsername: 'system',
      fetchImpl: async (url, options) => {
        calls.push({ url, options });
        return { ok: true, headers: new Map([['content-type', 'application/json']]), json: async () => ({ ok: true }) };
      },
    });
    await client.siteInfo();
    expect(calls[0].url).toBe('https://discourse.example.com/site.json');
    expect(calls[0].options.headers['Api-Key']).toBe('test-key');
    expect(calls[0].options.headers['Api-Username']).toBe('system');
  });

  it('skips installation safely by default', async () => {
    await expect(installTheme({ themeId: 'air', themePath: '/tmp/air' })).resolves.toMatchObject({ skipped: true, action: 'install' });
  });
});

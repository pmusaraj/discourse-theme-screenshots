export class DiscourseClient {
  constructor({ baseUrl, apiKey = process.env.DISCOURSE_API_KEY, apiUsername = process.env.DISCOURSE_API_USERNAME || 'system', fetchImpl = fetch } = {}) {
    if (!baseUrl) throw new Error('baseUrl is required');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.apiUsername = apiUsername;
    this.fetch = fetchImpl;
  }

  headers(extra = {}) {
    const headers = { Accept: 'application/json', ...extra };
    if (this.apiKey) {
      headers['Api-Key'] = this.apiKey;
      headers['Api-Username'] = this.apiUsername;
    }
    return headers;
  }

  url(path) {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  async request(path, options = {}) {
    const response = await this.fetch(this.url(path), { ...options, headers: this.headers(options.headers) });
    if (!response.ok) throw new Error(`Discourse request failed ${response.status} ${response.statusText}`);
    return response.headers.get('content-type')?.includes('application/json') ? response.json() : response.text();
  }

  async siteInfo() {
    return this.request('/site.json');
  }
}

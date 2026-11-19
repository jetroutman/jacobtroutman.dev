// Where the results go: the company's row in Notion, and a push to Jacob's phone through ntfy.
import type { Company, Outbox, Summary } from './track';

const TIME_ZONE = 'America/Chicago';
const TIMEOUT_MS = 5000;

async function send(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`${new URL(url).host} answered ${res.status}: ${(await res.text()).slice(0, 200)}`);
}

// Notion wants the local time without an offset when a time zone is given.
const date = (iso: string) => ({
  date: { start: new Date(iso).toLocaleString('sv-SE', { timeZone: TIME_ZONE }).replace(' ', 'T'), time_zone: TIME_ZONE },
});

export function alertText(company: string, visitors: number) {
  return visitors === 1
    ? { title: `Someone opened your ${company} page`, message: 'First real visit.', priority: 3 }
    : { title: `${visitors} people have opened your ${company} page`, message: 'A new browser just opened it, so it may be getting passed around.', priority: 4 };
}

export function createOutbox(env: { notionToken?: string; ntfyTopic?: string }): Outbox {
  return {
    async updateNotion(company: Company, s: Summary) {
      if (!env.notionToken || !company.notion) return;
      await send(`https://api.notion.com/v1/pages/${company.notion}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${env.notionToken}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          properties: {
            'First opened': date(s.firstOpened), 'Last opened': date(s.lastOpened),
            Visitors: { number: s.visitors }, Visits: { number: s.visits },
            'Furthest slide': { rich_text: [{ text: { content: s.furthest } }] },
            'Longest visit (min)': { number: s.longestMinutes },
          },
        }),
      });
    },
    async alert(company: Company, visitors: number) {
      if (!env.ntfyTopic) return;
      await send('https://ntfy.sh/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: env.ntfyTopic, ...alertText(company.company, visitors),
          ...(company.notion ? { click: `https://www.notion.so/${company.notion.replace(/-/g, '')}` } : {}),
        }),
      });
    },
  };
}

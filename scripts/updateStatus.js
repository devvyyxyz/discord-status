import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import { Octokit } from '@octokit/rest';

const API_URL = 'https://discordstatus.com/api/v2/summary.json';
const README_PATH = path.join(process.cwd(), 'README.md');
const START = '<!-- STATUS_START -->';
const END   = '<!-- STATUS_END -->';

// read owner/repo from environment (set by GitHub Actions)
const [owner, repo] = (process.env.GITHUB_REPOSITORY || '').split('/');
if (!owner || !repo) {
  console.error('GITHUB_REPOSITORY not set, cannot open issues');
  process.exit(1);
}
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function issueExists(title) {
  const q = `repo:${owner}/${repo} is:issue is:open in:title "${title.replace(/"/g, '\\"')}"`;
  const result = await octokit.rest.search.issuesAndPullRequests({ q, per_page: 1 });
  return result.data.total_count > 0;
}

async function createIncidentIssue(incident) {
  const title = `Discord Incident: ${incident.name}`;
  if (await issueExists(title)) return;

  const body = [
    `## ${incident.name}`,
    ``,
    `**Status:** ${incident.status}`,
    ``,
    `**Details / Updates:**`,
    ...incident.incident_updates.map(u => `- [${u.created_at}] ${u.body}`),
    ``,
    `🔗 [View on Discord Status](${incident.shortlink})`
  ].join('\n');

  await octokit.rest.issues.create({
    owner,
    repo,
    title,
    body,
    labels: ['discord-incident']
  });
}

async function main() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  const { status, components, incidents, scheduled_maintenances } = await res.json();

  // 1) Update README
  const emoji = { none: '⚪️', minor: '🟡', major: '🔴' }[status.indicator] || '⚪️';
  const compLines = components
    .map(c => `- ${c.status === 'operational' ? '✅' : '❌'} ${c.name} (${c.status})`)
    .join('\n');
  const incidentLines = incidents.length
    ? incidents.map(i => `- 🔴 [${i.name}](${i.shortlink}): ${i.status}`).join('\n')
    : '- None';
  const maintenanceLines = scheduled_maintenances.length
    ? scheduled_maintenances.map(m => `- 🛠️ [${m.name}](${m.shortlink}): ${m.status}`).join('\n')
    : '- None';
  const now = new Date().toUTCString();

  const block = [
    START,
    `**Overall Status:** ${emoji} ${status.description}`,
    ``,
    `**Components:**`,
    compLines,
    ``,
    `**Active Incidents:**`,
    incidentLines,
    ``,
    `**Scheduled Maintenance:**`,
    maintenanceLines,
    ``,
    `_Last updated at ${now}_`,
    END
  ].join('\n');

  let md = fs.readFileSync(README_PATH, 'utf8');
  md = md.replace(new RegExp(`${START}[\\s\\S]*?${END}`, 'm'), block);
  fs.writeFileSync(README_PATH, md);

  // 2) File GitHub issues for any new incidents
  for (const incident of incidents) {
    await createIncidentIssue(incident);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
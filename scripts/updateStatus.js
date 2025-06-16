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
  console.error('GITHUB_REPOSITORY not set, cannot open/close issues');
  process.exit(1);
}
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function closePreviousLogs() {
  // List open issues with the log label
  const { data: issues } = await octokit.rest.issues.listForRepo({
    owner,
    repo,
    state: 'open',
    labels: 'discord-status-log',
    per_page: 100
  });
  for (const issue of issues) {
    await octokit.rest.issues.update({
      owner,
      repo,
      issue_number: issue.number,
      state: 'closed'
    });
  }
}

async function createLogIssue(body) {
  const timestamp = new Date().toUTCString();
  const title = `Discord Status Log: ${timestamp}`;
  await octokit.rest.issues.create({
    owner,
    repo,
    title,
    body,
    labels: ['discord-status-log']
  });
}

async function main() {
  // 1) Fetch status
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  const { status, components, incidents, scheduled_maintenances } = await res.json();

  // 2) Build README block
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

  const readmeBlock = [
    START,
    `**Overall Status:** ${emoji} ${status.description}`,
    '',
    `**Components:**`,
    compLines,
    '',
    `**Active Incidents:**`,
    incidentLines,
    '',
    `**Scheduled Maintenance:**`,
    maintenanceLines,
    '',
    `_Last updated at ${now}_`,
    END
  ].join('\n');

  // 3) Write README
  let md = fs.readFileSync(README_PATH, 'utf8');
  md = md.replace(new RegExp(`${START}[\\s\\S]*?${END}`, 'm'), readmeBlock);
  fs.writeFileSync(README_PATH, md);

  // 4) Close previous log issue(s) and open a fresh one
  const issueBody = [
    `## Discord Status as of ${now}`,
    '',
    `**Overall:** ${emoji} ${status.description}`,
    '',
    `### Components`,
    compLines,
    '',
    `### Incidents`,
    incidentLines,
    '',
    `### Scheduled Maintenance`,
    maintenanceLines
  ].join('\n');

  await closePreviousLogs();
  await createLogIssue(issueBody);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
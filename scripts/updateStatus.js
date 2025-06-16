import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

const API_URL = 'https://discordstatus.com/api/v2/summary.json';
const README_PATH = path.join(process.cwd(), 'README.md');
const START = '<!-- STATUS_START -->';
const END   = '<!-- STATUS_END -->';

async function main() {
  const res = await fetch(API_URL);
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`);
  const { status, components, incidents, scheduled_maintenances } = await res.json();

  // Emoji for overall status
  const emoji = {
    none:   '⚪️',
    minor:  '🟡',
    major:  '🔴'
  }[status.indicator] || '⚪️';

  // Build a summary of component statuses
  const compLines = components.map(c => {
    const mark = c.status === 'operational' ? '✅' : '❌';
    return `- ${mark} ${c.name} (${c.status})`;
  }).join('\n');

  // Build a summary of active incidents
  const incidentLines = incidents.length
    ? incidents.map(i => `- 🔴 [${i.name}](${i.shortlink}): ${i.status}`).join('\n')
    : '- None';

  // Build a summary of scheduled maintenance
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
  const regex = new RegExp(`${START}[\\s\\S]*?${END}`, 'm');
  md = md.replace(regex, block);
  fs.writeFileSync(README_PATH, md);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
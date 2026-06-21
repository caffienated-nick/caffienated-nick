// Fetches the live, ordered list of pinned repos for GH_USERNAME and
// rewrites everything between <!-- PINS:START --> and <!-- PINS:END -->
// in README.md to match — same pin-card style already used in the README.

const fs = require('fs');

const USERNAME = process.env.GH_USERNAME;
const TOKEN = process.env.GH_TOKEN;
const README_PATH = 'README.md';
const START = '<!-- PINS:START -->';
const END = '<!-- PINS:END -->';

// rotate through these for the pin card title color, same palette as the rest of the README
const COLORS = ['00E5FF', 'FF3DA6', '00E5FF', 'FF6A00', 'b44fff'];

const QUERY = `
  query($login: String!) {
    user(login: $login) {
      pinnedItems(first: 6, types: REPOSITORY) {
        nodes {
          ... on Repository {
            name
            owner { login }
          }
        }
      }
    }
  }
`;

async function main() {
  if (!USERNAME) throw new Error('GH_USERNAME env var is required');
  if (!TOKEN) throw new Error('GH_TOKEN env var is required');

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: QUERY, variables: { login: USERNAME } }),
  });

  if (!res.ok) {
    throw new Error(`GitHub API responded ${res.status}: ${await res.text()}`);
  }

  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`);
  }

  const pins = json.data.user.pinnedItems.nodes;
  if (!pins.length) {
    console.log('No pinned repos found — leaving README untouched.');
    return;
  }

  const block = pins
    .map((repo, i) => {
      const color = COLORS[i % COLORS.length];
      const owner = repo.owner.login;
      const name = repo.name;
      return (
        `[![${name}](https://github-readme-stats.vercel.app/api/pin/` +
        `?username=${owner}&repo=${name}&theme=transparent&hide_border=true` +
        `&bg_color=0a0707&title_color=${color}&text_color=e8e8e8&icon_color=FF6A00)]` +
        `(https://github.com/${owner}/${name})`
      );
    })
    .join('\n\n');

  const readme = fs.readFileSync(README_PATH, 'utf8');
  const startIdx = readme.indexOf(START);
  const endIdx = readme.indexOf(END);

  if (startIdx === -1 || endIdx === -1) {
    throw new Error(
      `Could not find ${START} / ${END} sentinels in ${README_PATH}. ` +
      'Add them around the pin-card block in the FIELD DEPLOYMENTS section.'
    );
  }

  const before = readme.slice(0, startIdx + START.length);
  const after = readme.slice(endIdx);
  const updated = `${before}\n${block}\n${after}`;

  fs.writeFileSync(README_PATH, updated);
  console.log(`Synced ${pins.length} pinned repo(s) into README.md:`);
  pins.forEach((p, i) => console.log(`  ${i + 1}. ${p.owner.login}/${p.name}`));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

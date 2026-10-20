const { app, net } = require('electron');

const repository = 'GearDuckDev/FlockSync';
const tag = 'v0.3.1-beta';
const manifestName = 'flocksync-release.json';

const fetchJson = async (url) => {
  const response = await net.fetch(url, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'FlockSync-Desktop-Live-Smoke' },
  });
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return response.json();
};

app.whenReady().then(async () => {
  const releasesUrl = `https://api.github.com/repos/${repository}/releases?per_page=100&page=1`;
  const releases = await fetchJson(releasesUrl);
  const release = releases.find((entry) => entry.tag_name === tag);
  if (!release) throw new Error(`GitHub release ${tag} was not found`);
  if (!release.assets.some((asset) => asset.name === manifestName)) {
    throw new Error(`Release ${tag} does not include ${manifestName}`);
  }

  const manifestUrl = `https://github.com/${repository}/releases/download/${tag}/${manifestName}`;
  const manifest = await fetchJson(manifestUrl);
  if (manifest.releaseVersion !== tag.slice(1)) {
    throw new Error(`Manifest releaseVersion ${manifest.releaseVersion} does not match ${tag}`);
  }
  console.log(`Native Electron net.fetch succeeded: API and ${manifestName} both returned HTTP 200 (${tag}).`);
}).catch((error) => {
  console.error(error);
  process.exitCode = 1;
}).finally(() => {
  app.quit();
});

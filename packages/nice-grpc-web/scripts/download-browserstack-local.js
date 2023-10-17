const request = require('request');
const fs = require('fs');
const path = require('path');
const {mkdirp} = require('mkdirp');

const releases = {
  win32: 'https://bstack-local-prod.s3.amazonaws.com/BrowserStackLocal.exe',
  linux:
    'https://bstack-local-prod.s3.amazonaws.com/BrowserStackLocal-linux-x64',
  darwin:
    'https://bstack-local-prod.s3.amazonaws.com/BrowserStackLocal-darwin-x64',
};

const {platform} = process;

const targetPath = path.join(
  'browserstack-local',
  process.platform === 'win32'
    ? `browserstack-local.exe`
    : 'browserstack-local',
);

if (releases[platform]) {
  Promise.resolve()
    .then(async () => {
      await mkdirp('browserstack-local');

      console.log('Downloading browserstack-local');

      await new Promise((resolve, reject) => {
        request(releases[platform])
          .pipe(fs.createWriteStream(targetPath))
          .on('error', reject)
          .on('finish', resolve);
      });

      await fs.promises.chmod(targetPath, 0o755);
    })
    .catch(err => console.error(err));
} else {
  throw new Error(`Unsupported platform: ${platform}`);
}

const request = require('request');
const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');

const version = '0.4.4';

const releases = {
  linux_x86_64: `https://github.com/grpc-ecosystem/grpc-health-probe/releases/download/v${version}/grpc_health_probe-linux-amd64`,
  darwin_x86_64: `https://github.com/grpc-ecosystem/grpc-health-probe/releases/download/v${version}/grpc_health_probe-darwin-amd64`,
};

const platform = process.platform;
const arch = process.arch === 'x64' ? 'x86_64' : 'x86_32';
const release = platform + '_' + arch;

const targetPath = path.join(
  'grpc-health-probe',
  process.platform === 'win32' ? `grpc-health-probe.exe` : 'grpc-health-probe',
);

if (releases[release]) {
  Promise.resolve()
    .then(async () => {
      await mkdirp('grpc-health-probe');

      console.log('Downloading grpc-health-probe');

      await new Promise((resolve, reject) => {
        request(releases[release])
          .pipe(fs.createWriteStream(targetPath))
          .on('error', reject)
          .on('finish', resolve);
      });

      await fs.promises.chmod(targetPath, 0o755);
    })
    .catch(err => console.error(err));
} else {
  console.log(`Unsupported platform: ${release}`);
}

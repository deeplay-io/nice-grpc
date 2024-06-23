const request = require('request');
const fs = require('fs');
const path = require('path');
const unzip = require('unzipper');
const {mkdirp} = require('mkdirp');

const version = '0.0.1';

const releases = {
  win32_x86_32: `https://github.com/aikoven/grpc-web/releases/download/v${version}/grpcwebproxy-v${version}-win32.exe.zip`,
  win32_x86_64: `https://github.com/aikoven/grpc-web/releases/download/v${version}/grpcwebproxy-v${version}-win64.exe.zip`,
  linux_x86_64: `https://github.com/aikoven/grpc-web/releases/download/v${version}/grpcwebproxy-v${version}-linux-x86_64.zip`,
  darwin_x86_64: `https://github.com/aikoven/grpc-web/releases/download/v${version}/grpcwebproxy-v${version}-osx-x86_64.zip`,
};

const platform = process.platform;
const arch =
  process.arch === 'x64' || process.arch === 'arm64' ? 'x86_64' : 'x86_32';
const release = platform + '_' + arch;

const targetPath = path.join(
  'grpcwebproxy',
  process.platform === 'win32' ? `grpcwebproxy.exe` : 'grpcwebproxy',
);

if (releases[release]) {
  Promise.resolve()
    .then(async () => {
      await mkdirp('grpcwebproxy');

      console.log('Downloading grpcwebproxy');

      await new Promise((resolve, reject) => {
        request(releases[release])
          .pipe(unzip.ParseOne())
          .pipe(fs.createWriteStream(targetPath))
          .on('error', reject)
          .on('finish', resolve);
      });

      await fs.promises.chmod(targetPath, 0o755);
    })
    .catch(err => console.error(err));
} else {
  throw new Error(`Unsupported platform: ${release}`);
}

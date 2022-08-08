const fs = require('fs');
const path = require('path');

const contents = `// Generated by scripts/version.js
export const VERSION = ${JSON.stringify(process.env.npm_package_version)};
`;

fs.writeFileSync(
  path.join('src', 'version.ts'),
  contents,
  {encoding: 'utf-8'},
);

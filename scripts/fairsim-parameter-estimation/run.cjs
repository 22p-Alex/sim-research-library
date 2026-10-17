/* Compile pinned fairSIM sources and run the headless parameter example.
 * Reuses the project's test FFT adapter; requires Node and JDK 11+.
 * Does not download dependencies, modify fairSIM, or launch a GUI. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.resolve(__dirname, '../..');
const source = path.join(root, 'Wiener-SIM/fairSIM-src/fairSIM/src/main/java');
const adapter = path.join(root, 'tests/fairsim-reference');
const build = fs.mkdtempSync(path.join(os.tmpdir(), 'fairsim-parameters-'));

try {
  execFileSync('javac', [
    '-d', build, '-sourcepath', source + path.delimiter + adapter,
    path.join(__dirname, 'ParameterEstimationDemo.java'),
    path.join(adapter, 'JTransformsConnector.java'),
    path.join(source, 'org/fairsim/linalg/BasicVectors.java'),
  ], { stdio: 'pipe', timeout: 60000 });
  const log = execFileSync('java', [
    '-Djava.awt.headless=true', '-cp', build, 'ParameterEstimationDemo',
  ], { encoding: 'utf8', stdio: 'pipe', timeout: 60000 });
  console.log(log.split('\n').filter(line => /^(RESULT|CHECK) /.test(line)).join('\n'));
} catch (error) {
  if (error.stdout) process.stderr.write(error.stdout);
  if (error.stderr) process.stderr.write(error.stderr);
  throw error;
} finally {
  fs.rmSync(build, { recursive: true, force: true });
}

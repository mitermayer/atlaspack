// Simple dual-run test fixture
export function hello(name) {
  return `Hello, ${name}!`;
}

export const version = '1.0.0';

// Output for testing
if (typeof window === 'undefined') {
  // Node.js environment
  process.stdout.write(hello('World') + '\n');
  process.stdout.write(`Version: ${version}\n`);
}

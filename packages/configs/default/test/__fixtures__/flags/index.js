// Test entry point for feature flags testing
export function hello() {
  return 'Hello from JS engine!';
}

if (import.meta.hot) {
  import.meta.hot.accept();
}

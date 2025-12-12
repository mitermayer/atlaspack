# Ticket: HMR Message Ordering Parity

## Objective

Match HMR message ordering and runtime injections (React refresh, SW) between JS and Rust engines.

## Tasks

- Script HMR sessions (edit, save, recover error) and capture message transcripts for JS baseline.
- Implement transcript diffing for Rust runs; tolerate timestamp differences but not ordering/content changes.
- Validate runtime injections for React refresh and service worker paths.

## Acceptance Criteria

- HMR transcript diffs clean on scripted sessions; ordering/content matches baseline.
- Runtime injections occur at equivalent points; no duplicate or missing messages.
- Regression tests provided for typical HMR flows and error recovery, with command/path for integration CI to run them.

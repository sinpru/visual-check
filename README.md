# visual-check

A Percy-style visual regression testing tool that compares Figma designs with live web implementations.

## Getting Started

### 1. Installation

Install dependencies from the root directory:

```bash
pnpm install
```

### 2. Install Playwright Browsers

Playwright requires specific browser binaries. If you encounter "browser version mismatch" errors or if it's your first time running tests, run:

```bash
pnpm exec playwright install chromium
```

*Note: This ensures the Chromium version matches the `@playwright/test` version installed in the project.*

### 3. Environment Setup

Copy `.env.example` to `.env` and fill in your Figma token and other required variables:

```bash
cp .env.example .env
```

### 4. Running the Project

All commands should be run from the **root directory**.

- **Start Dashboard:** `pnpm dev`
- **Run Tests (CLI):** `pnpm test`
- **Capture Auth Session:** `pnpm --filter playwright exec tsx helpers/saveAuth.ts`

## Project Structure

- `core/`: Shared logic for diffing, Figma API, and storage.
- `dashboard/`: Next.js web interface for managing projects and reviewing diffs.
- `playwright/`: Visual regression test suite.
- `snapshots/`: Local storage for baselines, current screenshots, and results (gitignored).

## Troubleshooting

### Playwright Browser Mismatch
If you see errors about Chromium version, always run:
`pnpm exec playwright install chromium`

### Running from subdirectories
While you can run commands inside `dashboard/` or `playwright/`, it is recommended to stay at the root and use the provided `pnpm` scripts or `--filter` flags to maintain consistent environment variables and path resolution.

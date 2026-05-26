# Contributing to PHANTOM

First off, thank you for considering contributing to PHANTOM! It's people like you that make it such a great tool.

## How to clone and run locally

1. Fork the repository on GitHub
2. Clone your fork locally: `git clone https://github.com/YOUR-USERNAME/PHANTOM.git`
3. Install dependencies: `npm install`
4. Copy the environment variables: `cp .env.example .env`
5. Start the development server: `npm run dev`

## How to run tests

We use Vitest and Supertest for testing. To run the test suite:

```bash
npm test
```

## Code style guidelines

- We use ESLint to enforce code quality. Run `npm run lint` before committing.
- Keep components modular. If adding a new backend tool, place it in `server/tools/`.
- Try to keep PRs focused and under 50 lines of core logic changes if possible.
- Never commit secrets (API keys, etc.) or expose vulnerability details publicly.

## How to submit a PR

1. Create a new branch: `git checkout -b feature-or-bugfix-name`
2. Make your changes and write tests if applicable.
3. Verify your changes: `npm test` and `npm run lint`
4. Commit your changes: `git commit -m "Description of changes"`
5. Push to your fork: `git push origin feature-or-bugfix-name`
6. Open a Pull Request against the `main` branch of the upstream repository.

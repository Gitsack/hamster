# Contributing to Hamster

Thank you for your interest in contributing to Hamster!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/Gitsack/hamster.git`
3. Create a branch: `git checkout -b feature/your-feature-name`
4. Make your changes
5. Run tests and linting: `npm run lint && npm run typecheck`
6. Commit your changes with a descriptive message
7. Push to your fork and submit a pull request

## Development Setup

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your settings

# Run database migrations
node ace migration:run

# Start development server
npm run dev
```

## Code Style

- Run `npm run lint` before committing
- Run `npm run format` to auto-format code
- Follow existing code patterns and conventions

## Reporting Issues

When reporting issues, please include:

- A clear description of the problem
- Steps to reproduce the issue
- Expected vs actual behavior
- Environment details (OS, Node version, browser)

## Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Update documentation if needed
- Ensure all tests pass
- Add tests for new functionality

## License

By contributing, you agree that your contributions will be licensed under the GPL-3.0 License.

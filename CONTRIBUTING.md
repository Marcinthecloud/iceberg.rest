# Contributing to iceberg.rest

Thank you for your interest in contributing to iceberg.rest! This document provides guidelines for contributing to the project.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/yourusername/iceberg.rest.git`
3. Install dependencies: `npm install`
4. Set up local development (see README.md)

## Development Workflow

1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Test locally using both servers:
   ```bash
   npx wrangler dev --port 8787  # Terminal 1
   npm run dev                    # Terminal 2
   ```
4. Commit with clear messages: `git commit -m "Add feature: description"`
5. Push to your fork: `git push origin feature/your-feature-name`
6. Open a Pull Request

## Code Style

- Use TypeScript for type safety
- Follow existing code patterns
- Use Tailwind CSS for styling
- Add comments for complex logic
- Keep functions small and focused

## Testing

Before submitting a PR:
- Test with multiple catalog types (Bearer, OAuth2, SigV4)
- Verify responsive design/performance
- Check for console errors
- Test error handling (invalid endpoints, expired tokens, etc.)

## Areas for Contribution

### Features
- Add support for new catalog types
- Implement table comparison views
- Add export functionality (CSV, JSON)
- Improve analytics dashboards
- Add dark mode toggle

### UI/UX
- Add loading skeletons
- Enhance error messages
- Add keyboard shortcuts
- Improve accessibility

### Documentation
- Add more connection examples
- Improve catalog-specific guides
- Add troubleshooting sections
- Create video tutorials

### Performance
- Implement virtual scrolling for large lists
- Add request caching
- Optimize bundle size
- Add service worker for offline support

## Reporting Issues

When reporting bugs, please include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Browser and OS information
- Screenshots if applicable
- Catalog type (Bearer/OAuth2/SigV4)

## Pull Request Guidelines

- Keep PRs focused on a single feature/fix
- Update documentation if needed
- Add/update types in TypeScript
- Follow existing code style
- Test thoroughly before submitting
- Reference related issues

## Questions?

Open a [GitHub Discussion](https://github.com/yourusername/iceberg.rest/discussions) for questions about:
- Architecture decisions
- Feature proposals
- General discussions

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Help others learn and grow
- Focus on what's best for the project

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

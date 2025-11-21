# Tauri Mail Client - Build & Deployment Guide

This guide covers building, testing, and deploying the Tauri Mail Client.

## Prerequisites

### System Requirements
- **Node.js** 18+ 
- **Rust** 1.70+
- **Tauri CLI** (`cargo install tauri-cli`)
- **System dependencies** based on platform:
  - **Linux**: `libwebkit2gtk-4.0-dev`, `build-essential`, `curl`, `wget`, `libssl-dev`, `libgtk-3-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`
  - **Windows**: Microsoft Visual Studio C++ Build Tools
  - **macOS**: Xcode Command Line Tools

### Development Tools (Optional)
- **Docker** - For containerized builds
- **GitHub CLI** - For release management
- **cargo-audit** - For security auditing
- **cargo-deny** - For dependency checking

## Quick Start

### 1. Clone and Setup
```bash
git clone https://github.com/your-org/simplemail.git
cd simplemail
npm install
cd src-tauri && cargo fetch
```

### 2. Development Build
```bash
# Start development server
npm run tauri dev

# Or use the build script
./scripts/build-deploy.sh build all development
```

### 3. Production Build
```bash
# Build for current platform
./scripts/build-deploy.sh build

# Build for all platforms
./scripts/build-deploy.sh build all production
```

## Build Commands

### Using Build Script
```bash
# Clean all artifacts
./scripts/build-deploy.sh clean

# Install dependencies
./scripts/build-deploy.sh install

# Run all tests
./scripts/build-deploy.sh test

# Run security checks
./scripts/build-deploy.sh security

# Build application
./scripts/build-deploy.sh build [platform] [environment]

# Package application
./scripts/build-deploy.sh package [platform]

# Create Docker image
./scripts/build-deploy.sh docker

# Deploy to staging/production
./scripts/build-deploy.sh deploy [platform] [environment]

# Create release
./scripts/build-deploy.sh release
```

### Manual Build Commands
```bash
# Frontend development
npm run dev
npm run build
npm run build:dev

# Backend development
cd src-tauri
cargo build
cargo build --release
cargo test

# Tauri application
cargo tauri dev
cargo tauri build
cargo tauri build --debug
```

## Platform-Specific Builds

### Linux
```bash
# Build for Linux
./scripts/build-deploy.sh build linux production

# Manual build
cd src-tauri
cargo tauri build --target x86_64-unknown-linux-gnu
```

### Windows
```bash
# Build for Windows
./scripts/build-deploy.sh build windows production

# Manual build
cd src-tauri
cargo tauri build --target x86_64-pc-windows-msvc
```

### macOS
```bash
# Build for macOS (Intel)
./scripts/build-deploy.sh build macos production

# Manual build
cd src-tauri
cargo tauri build --target x86_64-apple-darwin
cargo tauri build --target aarch64-apple-darwin
```

## Testing

### Run All Tests
```bash
# Using build script
./scripts/build-deploy.sh test

# Manual testing
npm run test:unit
npm run test:component
npm run test:e2e
cd src-tauri && cargo test
```

### Specific Test Categories
```bash
# Frontend tests
npm run test:unit          # Unit tests
npm run test:component     # Component tests
npm run test:e2e          # End-to-end tests

# Backend tests
cd src-tauri
cargo test --lib           # Library tests
cargo test --test integration_tests  # Integration tests
cargo test security_tests  # Security tests

# Performance tests
cd src-tauri
cargo bench                # Benchmark tests
```

## Security Testing

### Run Security Audit
```bash
# Using security script
./scripts/security-test.sh

# Manual security checks
cd src-tauri
cargo audit                # Dependency vulnerability scan
cargo deny check           # License and security check
cargo clippy               # Security lints
```

### Frontend Security
```bash
# NPM audit
npm audit --audit-level=moderate

# ESLint security rules
npx eslint . --ext .js,.jsx,.ts,.tsx --config .eslintrc.security.js
```

## Performance Testing

### Run Performance Tests
```bash
# Using performance script
./scripts/performance-test.sh

# Manual performance tests
cd src-tauri
cargo bench                # Rust benchmarks
```

### Frontend Performance
```bash
# Lighthouse audit
npm run build
npx lighthouse http://localhost:1420 --output html --output-path ./lighthouse-report.html
```

## Deployment

### Environment Configuration

Create environment variables for deployment:

```bash
# Staging environment
export STAGING_HOST="staging.example.com"
export STAGING_USER="deploy"

# Production environment
export PRODUCTION_HOST="production.example.com"
export PRODUCTION_USER="deploy"

# Tauri signing (production)
export TAURI_PRIVATE_KEY="./private-key.pem"
export TAURI_KEY_PASSWORD="your-key-password"
```

### Deployment Process

#### Staging Deployment
```bash
# Build and deploy to staging
./scripts/build-deploy.sh build all production
./scripts/build-deploy.sh deploy

# Manual staging deployment
scp -r dist/v1.0.0/* deploy@staging.example.com:/var/www/staging/
ssh deploy@staging.example.com "sudo systemctl restart simplemail"
```

#### Production Deployment
```bash
# Build and deploy to production
./scripts/build-deploy.sh build all production
./scripts/build-deploy.sh deploy all production

# Manual production deployment
scp -r dist/v1.0.0/* deploy@production.example.com:/var/www/production/
ssh deploy@production.example.com "sudo systemctl restart simplemail"
```

### Docker Deployment

#### Build Docker Image
```bash
# Using build script
./scripts/build-deploy.sh docker

# Manual Docker build
docker build -t simplemail:latest .
docker build -t simplemail:v1.0.0 .
```

#### Run Docker Container
```bash
# Development
docker run -p 1420:1420 simplemail:latest

# Production
docker run -d \
  --name simplemail \
  -p 1420:1420 \
  -v /path/to/data:/app/data \
  --restart unless-stopped \
  simplemail:latest
```

## Release Management

### Create Release
```bash
# Using build script
./scripts/build-deploy.sh release

# Manual release
git tag -a v1.0.0 -m "Release version 1.0.0"
git push origin v1.0.0
gh release create v1.0.0 dist/v1.0.0/* --title "Release 1.0.0" --generate-notes
```

### Release Checklist
- [ ] All tests passing
- [ ] Security audit clean
- [ ] Performance benchmarks acceptable
- [ ] Documentation updated
- [ ] Version number updated
- [ ] Changelog updated
- [ ] Release notes prepared

## CI/CD Pipeline

### GitHub Actions
The project includes a comprehensive CI/CD pipeline (`.github/workflows/ci-cd.yml`) that:

1. **Tests** - Runs unit, integration, and E2E tests
2. **Security** - Performs security audits and vulnerability scans
3. **Performance** - Runs benchmarks and performance tests
4. **Build** - Builds for all platforms
5. **Deploy** - Deploys to staging and production
6. **Release** - Creates GitHub releases

### Pipeline Triggers
- **Push to main/develop** - Runs tests and builds
- **Pull requests** - Runs full test suite
- **Tags** - Creates releases and deploys to production

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clean and rebuild
./scripts/build-deploy.sh clean
./scripts/build-deploy.sh build

# Check dependencies
npm ci
cd src-tauri && cargo fetch
```

#### Test Failures
```bash
# Run tests with verbose output
cargo test -- --nocapture
npm run test:unit -- --verbose

# Check test environment
./scripts/security-test.sh
```

#### Deployment Issues
```bash
# Check build artifacts
ls -la dist/
ls -la src-tauri/target/release/bundle/

# Verify environment variables
echo $STAGING_HOST
echo $PRODUCTION_HOST
```

### Getting Help

1. **Check logs** - Review build and test logs for errors
2. **Run diagnostics** - Use `./scripts/build-deploy.sh help` for command options
3. **Check requirements** - Ensure all system requirements are met
4. **Review documentation** - Check Tauri and Rust documentation

## Best Practices

### Development
- Use `npm run tauri dev` for development
- Run tests frequently during development
- Use `cargo clippy` for code quality checks
- Keep dependencies updated

### Building
- Always run tests before building
- Use production builds for deployment
- Verify build artifacts before deployment
- Keep build logs for troubleshooting

### Deployment
- Test in staging before production
- Use environment variables for configuration
- Monitor deployment health
- Keep rollback procedures ready

### Security
- Run security audits regularly
- Keep dependencies updated
- Review code changes for security issues
- Use secure credential management

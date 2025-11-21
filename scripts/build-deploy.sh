#!/bin/bash

# Build and Deployment Script for Tauri Mail Client
# This script handles building, packaging, and deployment of the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build"
DIST_DIR="$PROJECT_ROOT/dist"
VERSION=$(node -p "require('$PROJECT_ROOT/package.json').version")
APP_NAME="simplemail"

# Parse command line arguments
COMMAND=${1:-"build"}
PLATFORM=${2:-"all"}
ENVIRONMENT=${3:-"production"}

# Create directories
mkdir -p "$BUILD_DIR"
mkdir -p "$DIST_DIR"

echo -e "${BLUE}🚀 Tauri Mail Client Build & Deployment Script${NC}"
echo -e "${BLUE}Command: $COMMAND, Platform: $PLATFORM, Environment: $ENVIRONMENT${NC}"

# Function to clean build artifacts
clean_build() {
    echo -e "${YELLOW}🧹 Cleaning build artifacts...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Clean Rust artifacts
    cd src-tauri
    cargo clean
    
    # Clean Node artifacts
    cd ..
    rm -rf node_modules/
    rm -rf dist/
    rm -rf build/
    
    echo -e "${GREEN}✅ Build artifacts cleaned${NC}"
}

# Function to install dependencies
install_dependencies() {
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Install Node dependencies
    echo "Installing Node.js dependencies..."
    npm ci
    
    # Install Rust dependencies
    echo "Installing Rust dependencies..."
    cd src-tauri
    cargo fetch
    
    echo -e "${GREEN}✅ Dependencies installed${NC}"
}

# Function to run tests
run_tests() {
    echo -e "${YELLOW}🧪 Running tests...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Frontend tests
    echo "Running frontend tests..."
    npm run test:unit
    npm run test:component
    
    # Backend tests
    echo "Running backend tests..."
    cd src-tauri
    cargo test --lib --bins --tests --all-features
    cargo test --test integration_tests --all-features
    
    echo -e "${GREEN}✅ All tests passed${NC}"
}

# Function to run security checks
run_security_checks() {
    echo -e "${YELLOW}🔒 Running security checks...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Run security script if available
    if [ -f "scripts/security-test.sh" ]; then
        ./scripts/security-test.sh
    else
        echo -e "${YELLOW}⚠️  Security test script not found, skipping${NC}"
    fi
    
    echo -e "${GREEN}✅ Security checks completed${NC}"
}

# Function to build frontend
build_frontend() {
    echo -e "${YELLOW}🌐 Building frontend...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Set environment variables
    export NODE_ENV=$ENVIRONMENT
    export TAURI_ENV=$ENVIRONMENT
    
    # Build frontend
    if [ "$ENVIRONMENT" = "development" ]; then
        npm run build:dev
    else
        npm run build
    fi
    
    echo -e "${GREEN}✅ Frontend built successfully${NC}"
}

# Function to build backend
build_backend() {
    echo -e "${YELLOW}🦀 Building backend...${NC}"
    
    cd "$PROJECT_ROOT/src-tauri"
    
    # Set environment variables
    export TAURI_ENV=$ENVIRONMENT
    
    if [ "$ENVIRONMENT" = "development" ]; then
        cargo build
    else
        cargo build --release
    fi
    
    echo -e "${GREEN}✅ Backend built successfully${NC}"
}

# Function to build Tauri application
build_tauri() {
    echo -e "${YELLOW}🔨 Building Tauri application...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Set environment variables
    export NODE_ENV=$ENVIRONMENT
    export TAURI_ENV=$ENVIRONMENT
    export TAURI_PRIVATE_KEY="$PROJECT_ROOT/private-key.pem"
    export TAURI_KEY_PASSWORD="$TAURI_KEY_PASSWORD"
    
    if [ "$ENVIRONMENT" = "development" ]; then
        cargo tauri build --debug
    else
        cargo tauri build
    fi
    
    echo -e "${GREEN}✅ Tauri application built successfully${NC}"
}

# Function to package application
package_application() {
    echo -e "${YELLOW}📦 Packaging application...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Create distribution directory
    mkdir -p "$DIST_DIR/$VERSION"
    
    # Copy build artifacts
    if [ -d "src-tauri/target/release/bundle" ]; then
        cp -r src-tauri/target/release/bundle/* "$DIST_DIR/$VERSION/"
    elif [ -d "src-tauri/target/debug/bundle" ]; then
        cp -r src-tauri/target/debug/bundle/* "$DIST_DIR/$VERSION/"
    else
        echo -e "${RED}❌ No build artifacts found${NC}"
        exit 1
    fi
    
    # Create checksums
    cd "$DIST_DIR/$VERSION"
    find . -type f -exec sha256sum {} > checksums.txt \;
    
    echo -e "${GREEN}✅ Application packaged successfully${NC}"
    echo -e "${BLUE}📁 Package location: $DIST_DIR/$VERSION${NC}"
}

# Function to build for specific platform
build_platform() {
    local platform=$1
    
    echo -e "${YELLOW}🔨 Building for platform: $platform${NC}"
    
    case $platform in
        "linux")
            # Build for Linux
            cd "$PROJECT_ROOT/src-tauri"
            cargo tauri build --target x86_64-unknown-linux-gnu
            ;;
        "windows")
            # Build for Windows
            cd "$PROJECT_ROOT/src-tauri"
            cargo tauri build --target x86_64-pc-windows-msvc
            ;;
        "macos")
            # Build for macOS
            cd "$PROJECT_ROOT/src-tauri"
            cargo tauri build --target x86_64-apple-darwin
            cargo tauri build --target aarch64-apple-darwin
            ;;
        "all")
            # Build for all platforms
            build_platform "linux"
            build_platform "windows"
            build_platform "macos"
            ;;
        *)
            echo -e "${RED}❌ Unknown platform: $platform${NC}"
            exit 1
            ;;
    esac
}

# Function to create Docker image
create_docker_image() {
    echo -e "${YELLOW}🐳 Creating Docker image...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Build Docker image
    docker build -t "$APP_NAME:$VERSION" .
    docker build -t "$APP_NAME:latest" .
    
    echo -e "${GREEN}✅ Docker image created successfully${NC}"
}

# Function to deploy to staging
deploy_staging() {
    echo -e "${YELLOW}🚀 Deploying to staging...${NC}"
    
    # Check if staging environment is configured
    if [ -z "$STAGING_HOST" ]; then
        echo -e "${YELLOW}⚠️  STAGING_HOST not configured, skipping deployment${NC}"
        return 0
    fi
    
    # Deploy to staging
    echo "Deploying to $STAGING_HOST..."
    
    # Copy files to staging server
    scp -r "$DIST_DIR/$VERSION"/* "$STAGING_USER@$STAGING_HOST:/var/www/staging/"
    
    # Restart application
    ssh "$STAGING_USER@$STAGING_HOST" "sudo systemctl restart $APP_NAME"
    
    echo -e "${GREEN}✅ Deployed to staging successfully${NC}"
}

# Function to deploy to production
deploy_production() {
    echo -e "${YELLOW}🚀 Deploying to production...${NC}"
    
    # Confirm deployment
    read -p "Are you sure you want to deploy to production? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled"
        return 0
    fi
    
    # Check if production environment is configured
    if [ -z "$PRODUCTION_HOST" ]; then
        echo -e "${YELLOW}⚠️  PRODUCTION_HOST not configured, skipping deployment${NC}"
        return 0
    fi
    
    # Deploy to production
    echo "Deploying to $PRODUCTION_HOST..."
    
    # Copy files to production server
    scp -r "$DIST_DIR/$VERSION"/* "$PRODUCTION_USER@$PRODUCTION_HOST:/var/www/production/"
    
    # Restart application
    ssh "$PRODUCTION_USER@$PRODUCTION_HOST" "sudo systemctl restart $APP_NAME"
    
    echo -e "${GREEN}✅ Deployed to production successfully${NC}"
}

# Function to create release
create_release() {
    echo -e "${YELLOW}🎉 Creating release...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Create git tag
    git tag -a "v$VERSION" -m "Release version $VERSION"
    git push origin "v$VERSION"
    
    # Create GitHub release (if gh CLI is available)
    if command -v gh &> /dev/null; then
        gh release create "v$VERSION" "$DIST_DIR/$VERSION"/* --title "Release $VERSION" --generate-notes
    else
        echo -e "${YELLOW}⚠️  GitHub CLI not found, skipping GitHub release${NC}"
    fi
    
    echo -e "${GREEN}✅ Release created successfully${NC}"
}

# Function to show help
show_help() {
    echo "Usage: $0 [COMMAND] [PLATFORM] [ENVIRONMENT]"
    echo ""
    echo "Commands:"
    echo "  build       Build the application (default)"
    echo "  clean       Clean build artifacts"
    echo "  test        Run all tests"
    echo "  security    Run security checks"
    echo "  package     Package the application"
    echo "  deploy      Deploy to staging/production"
    echo "  release     Create a release"
    echo "  docker      Create Docker image"
    echo "  help        Show this help message"
    echo ""
    echo "Platforms:"
    echo "  all         Build for all platforms (default)"
    echo "  linux       Build for Linux"
    echo "  windows     Build for Windows"
    echo "  macos       Build for macOS"
    echo ""
    echo "Environments:"
    echo "  production  Production build (default)"
    echo "  development Development build"
    echo ""
    echo "Examples:"
    echo "  $0 build all production"
    echo "  $0 clean"
    echo "  $0 test"
    echo "  $0 deploy"
    echo "  $0 release"
}

# Function to check system requirements
check_requirements() {
    echo -e "${BLUE}🔍 Checking system requirements...${NC}"
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js not found${NC}"
        exit 1
    fi
    
    # Check Rust
    if ! command -v cargo &> /dev/null; then
        echo -e "${RED}❌ Rust/Cargo not found${NC}"
        exit 1
    fi
    
    # Check Tauri CLI
    if ! command -v cargo-tauri &> /dev/null; then
        echo -e "${YELLOW}⚠️  Tauri CLI not found, installing...${NC}"
        cargo install tauri-cli
    fi
    
    echo -e "${GREEN}✅ System requirements check completed${NC}"
}

# Main execution
main() {
    # Check requirements
    check_requirements
    
    # Execute command
    case $COMMAND in
        "clean")
            clean_build
            ;;
        "test")
            run_tests
            ;;
        "security")
            run_security_checks
            ;;
        "build")
            install_dependencies
            build_frontend
            build_backend
            build_tauri
            ;;
        "package")
            build_platform "$PLATFORM"
            package_application
            ;;
        "deploy")
            deploy_staging
            if [ "$ENVIRONMENT" = "production" ]; then
                deploy_production
            fi
            ;;
        "release")
            create_release
            ;;
        "docker")
            create_docker_image
            ;;
        "help"|"-h"|"--help")
            show_help
            ;;
        *)
            echo -e "${RED}❌ Unknown command: $COMMAND${NC}"
            show_help
            exit 1
            ;;
    esac
    
    echo -e "${GREEN}🎉 Build script completed successfully!${NC}"
}

# Run main function
main "$@"

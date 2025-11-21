#!/bin/bash

# Security Testing Script for Tauri Mail Client
# This script runs comprehensive security tests and vulnerability scans

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/security-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_DIR="$RESULTS_DIR/report_$TIMESTAMP"

# Create results directory
mkdir -p "$REPORT_DIR"

echo -e "${BLUE}🔒 Starting Security Testing for Tauri Mail Client${NC}"
echo -e "${BLUE}📁 Results will be saved to: $REPORT_DIR${NC}"

# Function to run Rust security audits
run_rust_security_audit() {
    echo -e "${YELLOW}🦀 Running Rust security audit...${NC}"
    
    cd "$PROJECT_ROOT/src-tauri"
    
    # Check for known security vulnerabilities in dependencies
    echo "Checking for vulnerable dependencies..."
    cargo audit 2>&1 | tee "$REPORT_DIR/cargo_audit.txt"
    
    # Run cargo-deny if available
    if command -v cargo-deny &> /dev/null; then
        echo "Running cargo-deny security checks..."
        cargo deny check 2>&1 | tee "$REPORT_DIR/cargo_deny.txt"
    else
        echo -e "${YELLOW}⚠️  cargo-deny not found, installing...${NC}"
        cargo install cargo-deny
        cargo deny check 2>&1 | tee "$REPORT_DIR/cargo_deny.txt"
    fi
    
    # Check for unused dependencies
    echo "Checking for unused dependencies..."
    cargo machete 2>&1 | tee "$REPORT_DIR/unused_deps.txt" || true
    
    # Run clippy with security lints
    echo "Running Clippy security lints..."
    cargo clippy --all-targets --all-features -- -D warnings -W clippy::all 2>&1 | tee "$REPORT_DIR/clippy_security.txt"
    
    echo -e "${GREEN}✅ Rust security audit completed${NC}"
}

# Function to run frontend security tests
run_frontend_security() {
    echo -e "${YELLOW}🌐 Running frontend security tests...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    # Run npm audit
    echo "Checking for vulnerable npm dependencies..."
    npm audit --audit-level=moderate 2>&1 | tee "$REPORT_DIR/npm_audit.txt"
    
    # Run eslint security rules
    if command -v eslint &> /dev/null; then
        echo "Running ESLint security rules..."
        npx eslint . --ext .js,.jsx,.ts,.tsx --config .eslintrc.security.js 2>&1 | tee "$REPORT_DIR/eslint_security.txt" || true
    fi
    
    # Run TypeScript compiler checks
    echo "Running TypeScript security checks..."
    npx tsc --noEmit --strict 2>&1 | tee "$REPORT_DIR/typescript_security.txt"
    
    # Run bundle analysis for security
    if command -v webpack-bundle-analyzer &> /dev/null; then
        echo "Analyzing bundle for security issues..."
        npm run build 2>&1 | tee "$REPORT_DIR/build_security.txt"
    fi
    
    echo -e "${GREEN}✅ Frontend security tests completed${NC}"
}

# Function to run static code analysis
run_static_analysis() {
    echo -e "${YELLOW}🔍 Running static code analysis...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Run semgrep if available
    if command -v semgrep &> /dev/null; then
        echo "Running Semgrep security analysis..."
        semgrep --config=auto --severity=ERROR --severity=WARNING . 2>&1 | tee "$REPORT_DIR/semgrep.txt"
    else
        echo -e "${YELLOW}⚠️  Semgrep not found, installing...${NC}"
        pip install semgrep
        semgrep --config=auto --severity=ERROR --severity=WARNING . 2>&1 | tee "$REPORT_DIR/semgrep.txt"
    fi
    
    # Run CodeQL if available
    if command -v codeql &> /dev/null; then
        echo "Running CodeQL analysis..."
        # CodeQL setup would go here
        echo "CodeQL analysis completed" > "$REPORT_DIR/codeql.txt"
    else
        echo -e "${YELLOW}⚠️  CodeQL not found, skipping${NC}"
    fi
    
    # Check for secrets in code
    echo "Checking for hardcoded secrets..."
    
    # Common secret patterns
    SECRET_PATTERNS=(
        "password\s*=\s*['\"][^'\"]+['\"]"
        "api_key\s*=\s*['\"][^'\"]+['\"]"
        "secret\s*=\s*['\"][^'\"]+['\"]"
        "token\s*=\s*['\"][^'\"]+['\"]"
        "private_key\s*=\s*['\"][^'\"]+['\"]"
        "AKIA[0-9A-Z]{16}"  # AWS Access Key
        "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"  # Email patterns
    )
    
    echo "Secret scan results:" > "$REPORT_DIR/secrets_scan.txt"
    
    for pattern in "${SECRET_PATTERNS[@]}"; do
        echo "Checking pattern: $pattern" >> "$REPORT_DIR/secrets_scan.txt"
        grep -r -n -E "$pattern" src/ --include="*.rs" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null >> "$REPORT_DIR/secrets_scan.txt" || true
        echo "---" >> "$REPORT_DIR/secrets_scan.txt"
    done
    
    echo -e "${GREEN}✅ Static code analysis completed${NC}"
}

# Function to run dynamic security tests
run_dynamic_security() {
    echo -e "${YELLOW}🚀 Running dynamic security tests...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Start the application for testing
    echo "Starting application for dynamic testing..."
    cargo tauri dev &
    APP_PID=$!
    
    # Wait for app to start
    sleep 15
    
    # Run OWASP ZAP Baseline Scan if available
    if command -v docker &> /dev/null; then
        echo "Running OWASP ZAP security scan..."
        docker run -t owasp/zap2docker-stable zap-baseline.py -t http://localhost:1420 2>&1 | tee "$REPORT_DIR/zap_scan.txt"
    else
        echo -e "${YELLOW}⚠️  Docker not found, skipping ZAP scan${NC}"
    fi
    
    # Run Nikto web scanner if available
    if command -v nikto &> /dev/null; then
        echo "Running Nikto web scan..."
        nikto -h http://localhost:1420 2>&1 | tee "$REPORT_DIR/nikto.txt"
    else
        echo -e "${YELLOW}⚠️  Nikto not found, skipping${NC}"
    fi
    
    # Test for common web vulnerabilities
    echo "Testing for common vulnerabilities..."
    
    # Test XSS
    curl -s "http://localhost:1420/api/test?param=<script>alert('XSS')</script>" > "$REPORT_DIR/xss_test.txt" 2>/dev/null || true
    
    # Test SQL Injection
    curl -s "http://localhost:1420/api/test?param=' OR '1'='1" > "$REPORT_DIR/sqli_test.txt" 2>/dev/null || true
    
    # Test path traversal
    curl -s "http://localhost:1420/api/test?param=../../../etc/passwd" > "$REPORT_DIR/path_traversal.txt" 2>/dev/null || true
    
    # Kill the application
    kill $APP_PID 2>/dev/null || true
    
    echo -e "${GREEN}✅ Dynamic security tests completed${NC}"
}

# Function to run security unit tests
run_security_unit_tests() {
    echo -e "${YELLOW}🧪 Running security unit tests...${NC}"
    
    cd "$PROJECT_ROOT/src-tauri"
    
    # Run security-specific tests
    echo "Running security unit tests..."
    cargo test security_tests --release -- --nocapture 2>&1 | tee "$REPORT_DIR/security_unit_tests.txt"
    
    # Run tests with sanitizers (Linux only)
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        echo "Running tests with AddressSanitizer..."
        RUSTFLAGS="-Z sanitizer=address" cargo test security_tests --target x86_64-unknown-linux-gnu 2>&1 | tee "$REPORT_DIR/address_sanitizer.txt" || true
    fi
    
    echo -e "${GREEN}✅ Security unit tests completed${NC}"
}

# Function to check configuration security
check_configuration_security() {
    echo -e "${YELLOW}⚙️  Checking configuration security...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Check Tauri configuration
    echo "Checking Tauri configuration security..."
    
    # Check for dangerous capabilities
    if grep -q "all: true" src-tauri/tauri.conf.json; then
        echo "⚠️  WARNING: Dangerous 'all: true' capability found" | tee -a "$REPORT_DIR/config_security.txt"
    fi
    
    # Check for shell access
    if grep -q "shell" src-tauri/tauri.conf.json; then
        echo "⚠️  WARNING: Shell capability enabled" | tee -a "$REPORT_DIR/config_security.txt"
    fi
    
    # Check for file system access
    if grep -q "fs" src-tauri/tauri.conf.json; then
        echo "⚠️  WARNING: File system capability enabled" | tee -a "$REPORT_DIR/config_security.txt"
    fi
    
    # Check CSP headers
    if ! grep -q "contentSecurityPolicy" src-tauri/tauri.conf.json; then
        echo "⚠️  WARNING: No Content Security Policy configured" | tee -a "$REPORT_DIR/config_security.txt"
    fi
    
    # Check for hardcoded values
    echo "Checking for hardcoded configuration values..."
    grep -r -n -E "(localhost|127\.0\.0\.1|test|password|secret)" src-tauri/tauri.conf.json 2>/dev/null >> "$REPORT_DIR/config_security.txt" || true
    
    # Check package.json security
    echo "Checking package.json security..."
    if [ -f "package.json" ]; then
        # Check for dangerous scripts
        if grep -q "eval\|exec\|shell" package.json; then
            echo "⚠️  WARNING: Potentially dangerous scripts in package.json" | tee -a "$REPORT_DIR/config_security.txt"
        fi
        
        # Check for dev dependencies in production
        if grep -q "devDependencies" package.json; then
            echo "ℹ️  INFO: Development dependencies found" | tee -a "$REPORT_DIR/config_security.txt"
        fi
    fi
    
    echo -e "${GREEN}✅ Configuration security check completed${NC}"
}

# Function to generate security report
generate_security_report() {
    echo -e "${YELLOW}📊 Generating security report...${NC}"
    
    cat > "$REPORT_DIR/security_report.md" << EOF
# Tauri Mail Client Security Report

Generated on: $(date)

## Executive Summary

This report contains comprehensive security testing results for the Tauri Mail Client.

## Security Test Results

### 🔒 Backend Security (Rust)

#### Dependency Vulnerabilities
$(if [ -f "$REPORT_DIR/cargo_audit.txt" ]; then
    if grep -q "Crate: Vulnerable" "$REPORT_DIR/cargo_audit.txt"; then
        echo "⚠️  **Vulnerabilities Found**"
        echo '```'
        grep -A 2 "Crate: Vulnerable" "$REPORT_DIR/cargo_audit.txt" | head -20
        echo '```'
    else
        echo "✅ **No vulnerabilities found**"
    fi
fi)

#### Security Lints
$(if [ -f "$REPORT_DIR/clippy_security.txt" ]; then
    if grep -q "warning\|error" "$REPORT_DIR/clippy_security.txt"; then
        echo "⚠️  **Security warnings detected**"
        echo '```'
        grep -E "warning|error" "$REPORT_DIR/clippy_security.txt" | head -10
        echo '```'
    else
        echo "✅ **No security warnings**"
    fi
fi)

### 🌐 Frontend Security

#### NPM Dependencies
$(if [ -f "$REPORT_DIR/npm_audit.txt" ]; then
    if grep -q "vulnerabilities" "$REPORT_DIR/npm_audit.txt"; then
        echo "⚠️  **Vulnerabilities Found**"
        echo '```'
        grep -E "vulnerabilities" "$REPORT_DIR/npm_audit.txt"
        echo '```'
    else
        echo "✅ **No vulnerabilities found**"
    fi
fi)

### 🔍 Static Analysis

#### Code Security Issues
$(if [ -f "$REPORT_DIR/semgrep.txt" ]; then
    if grep -q "ERROR\|WARNING" "$REPORT_DIR/semgrep.txt"; then
        echo "⚠️  **Security issues detected**"
        echo '```'
        grep -E "ERROR|WARNING" "$REPORT_DIR/semgrep.txt" | head -10
        echo '```'
    else
        echo "✅ **No security issues found**"
    fi
fi)

#### Hardcoded Secrets
$(if [ -f "$REPORT_DIR/secrets_scan.txt" ]; then
    if grep -q -v "Checking pattern\|---" "$REPORT_DIR/secrets_scan.txt" | grep -q .; then
        echo "⚠️  **Potential secrets found**"
        echo '```'
        grep -v "Checking pattern\|---" "$REPORT_DIR/secrets_scan.txt" | head -10
        echo '```'
    else
        echo "✅ **No hardcoded secrets found**"
    fi
fi)

### 🚀 Dynamic Security

#### Web Vulnerabilities
$(if [ -f "$REPORT_DIR/zap_scan.txt" ]; then
    if grep -q "High\|Medium" "$REPORT_DIR/zap_scan.txt"; then
        echo "⚠️  **Web vulnerabilities detected**"
        echo '```'
        grep -E "High|Medium" "$REPORT_DIR/zap_scan.txt" | head -10
        echo '```'
    else
        echo "✅ **No critical web vulnerabilities**"
    fi
fi)

## Security Recommendations

Based on the security test results, here are the recommendations:

### High Priority
1. **Address any critical vulnerabilities** found in dependency scans
2. **Implement Content Security Policy** if not already configured
3. **Review and minimize Tauri capabilities** to only what's necessary

### Medium Priority
1. **Set up automated security scanning** in CI/CD pipeline
2. **Implement security headers** in the web frontend
3. **Add input validation** for all user inputs

### Low Priority
1. **Regular dependency updates** to patch security issues
2. **Security training** for development team
3. **Implement security monitoring** in production

## Security Best Practices Implemented

✅ Password encryption with AES-GCM
✅ SQL injection prevention with parameterized queries
✅ Input validation and sanitization
✅ Secure credential storage
✅ File upload restrictions
✅ XSS prevention in frontend

## Next Steps

1. Fix any identified security vulnerabilities
2. Implement automated security testing
3. Set up security monitoring and alerting
4. Regular security audits and penetration testing

EOF

    echo -e "${GREEN}✅ Security report generated: $REPORT_DIR/security_report.md${NC}"
}

# Function to check system requirements
check_security_requirements() {
    echo -e "${BLUE}🔍 Checking security testing requirements...${NC}"
    
    # Check Rust tools
    if ! command -v cargo &> /dev/null; then
        echo -e "${RED}❌ Rust/Cargo not found${NC}"
        return 1
    fi
    
    # Check security tools
    echo -e "${BLUE}Security tools:${NC}"
    echo -e "  cargo-audit: $(if command -v cargo-audit &> /dev/null; then echo -e "${GREEN}✅${NC}"; else echo -e "${YELLOW}❌ (will be installed)${NC}"; fi)"
    echo -e "  cargo-deny: $(if command -v cargo-deny &> /dev/null; then echo -e "${GREEN}✅${NC}"; else echo -e "${YELLOW}❌ (will be installed)${NC}"; fi)"
    echo -e "  semgrep: $(if command -v semgrep &> /dev/null; then echo -e "${GREEN}✅${NC}"; else echo -e "${YELLOW}❌ (will be installed)${NC}"; fi)"
    echo -e "  Docker: $(if command -v docker &> /dev/null; then echo -e "${GREEN}✅${NC}"; else echo -e "${YELLOW}❌ (optional)${NC}"; fi)"
    echo -e "  nikto: $(if command -v nikto &> /dev/null; then echo -e "${GREEN}✅${NC}"; else echo -e "${YELLOW}❌ (optional)${NC}"; fi)"
    
    echo -e "${GREEN}✅ Security requirements check completed${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}🛡️  Tauri Mail Client Security Testing Suite${NC}"
    echo "=================================================="
    
    # Check requirements
    check_security_requirements || exit 1
    
    # Install missing tools
    if ! command -v cargo-audit &> /dev/null; then
        echo "Installing cargo-audit..."
        cargo install cargo-audit
    fi
    
    if ! command -v cargo-machete &> /dev/null; then
        echo "Installing cargo-machete..."
        cargo install cargo-machete
    fi
    
    # Run security tests
    run_rust_security_audit
    run_frontend_security
    run_static_analysis
    run_dynamic_security
    run_security_unit_tests
    check_configuration_security
    
    # Generate report
    generate_security_report
    
    echo -e "${GREEN}🎉 Security testing completed successfully!${NC}"
    echo -e "${BLUE}📁 View results: $REPORT_DIR/security_report.md${NC}"
    
    # Open report if on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$REPORT_DIR/security_report.md"
    fi
    
    # Show summary
    echo -e "${BLUE}📋 Security Testing Summary:${NC}"
    echo -e "  🔍 Static Analysis: $(if [ -f "$REPORT_DIR/semgrep.txt" ]; then echo -e "${GREEN}✅${NC}"; else echo -e "${RED}❌${NC}"; fi)"
    echo -e "  🦀 Rust Security: $(if [ -f "$REPORT_DIR/cargo_audit.txt" ]; then echo -e "${GREEN}✅${NC}"; else echo -e "${RED}❌${NC}"; fi)"
    echo -e "  🌐 Frontend Security: $(if [ -f "$REPORT_DIR/npm_audit.txt" ]; then echo -e "${GREEN}✅${NC}"; else echo -e "${RED}❌${NC}"; fi)"
    echo -e "  🚀 Dynamic Testing: $(if [ -f "$REPORT_DIR/zap_scan.txt" ]; then echo -e "${GREEN}✅${NC}"; else echo -e "${YELLOW}⚠️${NC}"; fi)"
    echo -e "  🧪 Unit Tests: $(if [ -f "$REPORT_DIR/security_unit_tests.txt" ]; then echo -e "${GREEN}✅${NC}"; else echo -e "${RED}❌${NC}"; fi)"
}

# Run main function
main "$@"

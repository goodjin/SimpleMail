#!/bin/bash

# Performance Testing Script for Tauri Mail Client
# This script runs comprehensive performance tests and generates reports

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RESULTS_DIR="$PROJECT_ROOT/performance-results"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
REPORT_DIR="$RESULTS_DIR/report_$TIMESTAMP"

# Create results directory
mkdir -p "$REPORT_DIR"

echo -e "${BLUE}🚀 Starting Performance Testing for Tauri Mail Client${NC}"
echo -e "${BLUE}📁 Results will be saved to: $REPORT_DIR${NC}"

# Function to run Rust benchmarks
run_rust_benchmarks() {
    echo -e "${YELLOW}🔧 Running Rust backend benchmarks...${NC}"
    
    cd "$PROJECT_ROOT/src-tauri"
    
    # Run criterion benchmarks
    cargo bench --bench performance 2>&1 | tee "$REPORT_DIR/rust_benchmarks.txt"
    
    # Extract benchmark results
    if [ -f "target/criterion/report/index.html" ]; then
        cp -r target/criterion/report "$REPORT_DIR/rust_benchmarks"
        echo -e "${GREEN}✅ Rust benchmarks completed${NC}"
    else
        echo -e "${RED}❌ Rust benchmarks failed${NC}"
        return 1
    fi
}

# Function to run frontend performance tests
run_frontend_performance() {
    echo -e "${YELLOW}🌐 Running frontend performance tests...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        npm install
    fi
    
    # Run Lighthouse CI
    if command -v lhci &> /dev/null; then
        echo "Running Lighthouse performance audit..."
        lhci autorun --upload.target=filesystem --upload.outputDir="$REPORT_DIR/lighthouse" 2>&1 | tee "$REPORT_DIR/lighthouse.txt"
    else
        echo -e "${YELLOW}⚠️  Lighthouse CI not found, skipping frontend performance audit${NC}"
    fi
    
    # Run bundle size analysis
    if command -v webpack-bundle-analyzer &> /dev/null; then
        echo "Analyzing bundle size..."
        npm run build 2>&1 | tee "$REPORT_DIR/build.txt"
        # Note: Actual bundle analysis would depend on your build setup
    fi
    
    echo -e "${GREEN}✅ Frontend performance tests completed${NC}"
}

# Function to run database performance tests
run_database_performance() {
    echo -e "${YELLOW}🗄️  Running database performance tests...${NC}"
    
    cd "$PROJECT_ROOT/src-tauri"
    
    # Create test database with large dataset
    echo "Creating large test dataset..."
    cargo run --bin create_test_data 10000 2>&1 | tee "$REPORT_DIR/data_creation.txt"
    
    # Run database queries with timing
    echo "Running database query performance tests..."
    cargo test --release -- --ignored --nocapture database_performance 2>&1 | tee "$REPORT_DIR/database_performance.txt"
    
    echo -e "${GREEN}✅ Database performance tests completed${NC}"
}

# Function to run memory usage tests
run_memory_tests() {
    echo -e "${YELLOW}💾 Running memory usage tests...${NC}"
    
    cd "$PROJECT_ROOT/src-tauri"
    
    # Run memory profiling
    if command -valgrind &> /dev/null; then
        echo "Running Valgrind memory analysis..."
        valgrind --tool=massif --massif-out-file="$REPORT_DIR/memory_profile.out" cargo run --release --bin memory_test 2>&1 | tee "$REPORT_DIR/memory_test.txt"
        
        # Generate massif report
        ms_print "$REPORT_DIR/memory_profile.out" > "$REPORT_DIR/memory_report.txt"
    else
        echo -e "${YELLOW}⚠️  Valgrind not found, using basic memory monitoring${NC}"
        
        # Basic memory monitoring with time command
        /usr/bin/time -v cargo run --release --bin memory_test 2>&1 | tee "$REPORT_DIR/basic_memory.txt"
    fi
    
    echo -e "${GREEN}✅ Memory usage tests completed${NC}"
}

# Function to run load tests
run_load_tests() {
    echo -e "${YELLOW}⚡ Running load tests...${NC}"
    
    cd "$PROJECT_ROOT"
    
    # Start the application in background
    echo "Starting application for load testing..."
    cargo tauri dev &
    APP_PID=$!
    
    # Wait for app to start
    sleep 10
    
    # Run load tests with artillery or similar tool
    if command -v artillery &> /dev/null; then
        echo "Running artillery load tests..."
        artillery run tests/load/load-test-config.yml 2>&1 | tee "$REPORT_DIR/load_test.txt"
    else
        echo -e "${YELLOW}⚠️  Artillery not found, using basic load testing${NC}"
        
        # Basic load testing with curl
        echo "Running basic load tests..."
        for i in {1..100}; do
            curl -s http://localhost:1420/api/emails > /dev/null 2>&1 &
        done
        wait
    fi
    
    # Kill the application
    kill $APP_PID 2>/dev/null || true
    
    echo -e "${GREEN}✅ Load tests completed${NC}"
}

# Function to generate performance report
generate_report() {
    echo -e "${YELLOW}📊 Generating performance report...${NC}"
    
    cat > "$REPORT_DIR/performance_report.md" << EOF
# Tauri Mail Client Performance Report

Generated on: $(date)

## Executive Summary

This report contains comprehensive performance testing results for the Tauri Mail Client.

## Test Results

### Backend Performance (Rust)

$(if [ -f "$REPORT_DIR/rust_benchmarks.txt" ]; then
    echo "#### Benchmark Results"
    echo '```'
    grep -E "(test|bench)" "$REPORT_DIR/rust_benchmarks.txt" | head -20
    echo '```'
fi)

### Frontend Performance

$(if [ -f "$REPORT_DIR/lighthouse.txt" ]; then
    echo "#### Lighthouse Scores"
    echo '```'
    grep -E "(Performance|Accessibility|Best Practices|SEO)" "$REPORT_DIR/lighthouse.txt" | head -10
    echo '```'
fi)

### Database Performance

$(if [ -f "$REPORT_DIR/database_performance.txt" ]; then
    echo "#### Database Query Performance"
    echo '```'
    grep -E "(time|ms|seconds)" "$REPORT_DIR/database_performance.txt" | head -10
    echo '```'
fi)

### Memory Usage

$(if [ -f "$REPORT_DIR/memory_report.txt" ]; then
    echo "#### Memory Analysis"
    echo '```'
    grep -E "(heap|peak|memory)" "$REPORT_DIR/memory_report.txt" | head -10
    echo '```'
fi)

## Recommendations

Based on the test results, here are the performance recommendations:

1. **Database Optimization**: Consider adding indexes for frequently queried fields
2. **Frontend Optimization**: Implement code splitting and lazy loading
3. **Memory Management**: Monitor for memory leaks in long-running sessions
4. **Caching**: Implement caching for frequently accessed data

## Next Steps

1. Address any performance bottlenecks identified
2. Set up continuous performance monitoring
3. Establish performance budgets for new features
4. Regular performance regression testing

EOF

    echo -e "${GREEN}✅ Performance report generated: $REPORT_DIR/performance_report.md${NC}"
}

# Function to check system requirements
check_requirements() {
    echo -e "${BLUE}🔍 Checking system requirements...${NC}"
    
    # Check Rust
    if ! command -v cargo &> /dev/null; then
        echo -e "${RED}❌ Rust/Cargo not found${NC}"
        return 1
    fi
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js not found${NC}"
        return 1
    fi
    
    # Check for optional tools
    echo -e "${BLUE}Optional tools:${NC}"
    echo -e "  Valgrind: $(if command -v valgrind &> /dev/null; then echo -e "${GREEN}✅${NC}"; else echo -e "${YELLOW}❌ (optional)${NC}"; fi)"
    echo -e "  Lighthouse CI: $(if command -v lhci &> /dev/null; then echo -e "${GREEN}✅${NC}"; else echo -e "${YELLOW}❌ (optional)${NC}"; fi)"
    echo -e "  Artillery: $(if command -v artillery &> /dev/null; then echo -e "${GREEN}✅${NC}"; else echo -e "${YELLOW}❌ (optional)${NC}"; fi)"
    
    echo -e "${GREEN}✅ System requirements check completed${NC}"
}

# Main execution
main() {
    echo -e "${BLUE}🎯 Tauri Mail Client Performance Testing Suite${NC}"
    echo "=================================================="
    
    # Check requirements
    check_requirements || exit 1
    
    # Run performance tests
    run_rust_benchmarks
    run_frontend_performance
    run_database_performance
    run_memory_tests
    run_load_tests
    
    # Generate report
    generate_report
    
    echo -e "${GREEN}🎉 Performance testing completed successfully!${NC}"
    echo -e "${BLUE}📁 View results: $REPORT_DIR/performance_report.md${NC}"
    
    # Open report if on macOS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "$REPORT_DIR/performance_report.md"
    fi
}

# Run main function
main "$@"

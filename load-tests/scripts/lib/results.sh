#!/usr/bin/env bash
# Shared result paths for load-test runners (JSON summary + human-readable log).
# Usage (from a runner script):
#   source "$LOAD_TESTS/scripts/lib/results.sh"
#   load_test_init_results "$LOAD_TESTS"
#   load_test_set_paths "smoke-poll-read"
#   # -> $LOAD_TEST_JSON, $LOAD_TEST_LOG, $LOAD_TEST_STAMP

load_test_init_results() {
  local load_tests="${1:?load_tests root required}"
  LOAD_TEST_RESULTS_DIR="$load_tests/results"
  mkdir -p "$LOAD_TEST_RESULTS_DIR"
}

load_test_set_paths() {
  local prefix="${1:?prefix required}"
  LOAD_TEST_STAMP="$(date +%Y%m%d-%H%M%S)"
  LOAD_TEST_JSON="$LOAD_TEST_RESULTS_DIR/${prefix}-${LOAD_TEST_STAMP}.json"
  LOAD_TEST_LOG="$LOAD_TEST_RESULTS_DIR/${prefix}-${LOAD_TEST_STAMP}.log"
}

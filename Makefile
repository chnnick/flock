.PHONY: help setup setup-api setup-mobile run run-api run-mobile stop lint lint-api lint-mobile test test-api test-mobile clean

# Setup
setup: setup-api setup-mobile ## Set up entire project
	@echo "All services ready. Copy .env.example files to .env and fill in your keys."

setup-api: ## Set up API (Python venv + dependencies)
	@echo "Setting up API"
	cd api && python3 -m venv venv && \
		venv/bin/pip install -r requirements.txt
	@echo "API ready"

setup-mobile: ## Set up mobile app (npm install)
	@echo "Setting up mobile app"
	cd mobile && npm ci
	@echo "Mobile ready"

# Run
run: ## Run all services (use separate terminals instead for logs)
	@echo "Run these in separate terminals:"
	@echo "  make run-api"
	@echo "  make run-mobile"

run-api: ## Start FastAPI server
	cd api && . venv/bin/activate && uvicorn src.main:app --reload --port 8000

run-mobile: ## Start Expo dev server
	cd mobile && npx expo start

test: # TODO: add tests

test-connection: ## Test MongoDB connection
	cd api && . venv/bin/activate && python -m src.tests.test_connection

test-api: ## Run API tests
	cd api && . venv/bin/activate && pytest

test-mobile: # TODO: add tests
	cd mobile

# Utilities
clean: ## Remove generated files
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name node_modules -exec rm -rf {} + 2>/dev/null || true
	rm -rf api/venv
	@echo "Cleaned"
COMPOSE ?= docker compose

.PHONY: up down logs test test-cov seed clean shell help install

# Default target
help:
	@echo "Birthday Notification System - Commands"
	@echo "  make install   - Install npm dependencies (for local dev)"
	@echo "  make up        - Start all services (Docker)"
	@echo "  make down      - Stop all services"
	@echo "  make logs      - View application logs"
	@echo "  make test      - Run unit tests"
	@echo "  make test-cov  - Run unit tests with coverage"
	@echo "  make seed      - Seed database with sample users"make
	@echo "  make clean     - Remove containers, volumes, and images"
	@echo "  make shell     - Access application shell inside Docker"
	@echo "  make clean:db:users - Remove all users from the database"
	@echo "  make clean:db:logs - Remove all notification logs from the database"

# Install dependencies
install:
	@echo "Installing dependencies..."
	npm install

# Start all services
up:
	@echo "Starting services..."
	$(COMPOSE) up -d
	@echo "Services started!"
	@echo "  API:            http://localhost:3000"
	@echo "  Swagger:        http://localhost:3000/api"
	@echo "  Bull Dashboard: http://localhost:3000/admin/queues"

# Stop all services
down:
	@echo "Stopping services..."
	$(COMPOSE) down

# Restart all services (for .env changes)
restart:
	@echo "Restarting services to apply .env changes..."
	$(COMPOSE) restart
	@echo "Services restarted!"

# View app logs
logs:
	$(COMPOSE) logs -f app

# Run tests
test:
	npm run test

# Run tests with coverage
test-cov:
	npm run test:cov

# Seed database
seed:
	@echo "Seeding database..."
	npm run seed

# Clean up Docker resources
clean:
	@echo "Cleaning up..."
	$(COMPOSE) down -v --rmi local



# Access container shell
shell:
	$(COMPOSE) exec app sh
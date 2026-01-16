.PHONY: help install lint unit-tests build run

help:
	@echo "Available targets:"
	@echo "  make install     - Install npm dependencies"
	@echo "  make lint        - Run ESLint on JavaScript files"
	@echo "  make unit-tests  - Run unit tests"
	@echo "  make build       - Build Docker images"
	@echo "  make run         - Start Docker containers"

install:
	npm install

lint:
	npm run lint

unit-tests:
	npm test

build:
	docker-compose build

run:
	docker-compose up
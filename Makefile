.PHONY: help install lint build run

help:
	@echo "Available targets:"
	@echo "  make install  - Install npm dependencies"
	@echo "  make lint     - Run ESLint on JavaScript files"
	@echo "  make build    - Build Docker images"
	@echo "  make run      - Start Docker containers"

install:
	npm install

lint:
	npm run lint

build:
	docker-compose build

run:
	docker-compose up
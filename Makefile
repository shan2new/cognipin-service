SHELL := /bin/bash

.PHONY: dev build start migration-generate migration-run migration-revert seed fetch-companies

dev:
	./node_modules/.bin/ts-node-dev --respawn --transpile-only src/main.ts

build:
	npm run build

start:
	npm run start

migration-generate:
	npm run migration:generate

migration-run:
	npm run migration:run

migration-revert:
	npm run migration:revert

seed:
	npx ts-node src/seed.ts

fetch-companies:
	npx ts-node src/scripts/fetch-companies.ts --query "$(query)"



build:
	docker build -t flywire/okta-s3-auth .

startDev:
	docker-compose -f docker-compose-dev.yml up -d 

shell:
	docker exec -it okta-s3-auth-dev sh

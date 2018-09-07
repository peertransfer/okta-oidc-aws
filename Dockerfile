FROM nginx:1.15.2-alpine

RUN apk add --no-cache jq

ENV FW_VAR_AWS_OIDC_PROVIDER_URL "flywire.oktapreview.com"
ENV FW_VAR_AWS_ROLE_ARN "arn:aws:iam::306077209789:role/flywire-okta-oidc-aws-test-role"
ENV FW_VAR_AWS_REGION "us-east-1"
ENV FW_VAR_AWS_S3_BUCKET_NAME "flywire-okta-oidc-aws-test"
ENV FW_VAR_OKTA_ORG_URL "https://flywire.oktapreview.com"
ENV FW_VAR_OKTA_CLIENT_ID "0oag07d8xpcriufjQ0h7"

WORKDIR /usr/share/nginx/html
ADD . /usr/share/nginx/html

EXPOSE 80

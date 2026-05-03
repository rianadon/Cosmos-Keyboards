#!/usr/bin/env bash
set -e

uvx --from awscli aws s3 cp s3://${R2_BUCKET}/assets.tar.gz assets.tar.gz --endpoint-url "$R2_ENDPOINT"
tar -xzf assets.tar.gz

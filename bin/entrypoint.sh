#!/bin/sh
set -e 

trap shutdown TERM
jq -n env | egrep 'FW_VAR_|\{|\}' | sed 'x;${s/,$//;p;x;};1d' > ./js/env.json &
nginx -g "daemon off;" &
wait

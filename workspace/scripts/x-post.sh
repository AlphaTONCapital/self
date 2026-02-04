#!/bin/bash
# Helper script for X/Twitter posting as @atoncrux

AUTH_TOKEN=$(cat .secrets/x-auth-token.txt)
CT0=$(cat .secrets/x-ct0.txt)

case "$1" in
  "post")
    bird tweet "$2" --auth-token "$AUTH_TOKEN" --ct0 "$CT0"
    ;;
  "mentions")  
    bird mentions --auth-token "$AUTH_TOKEN" --ct0 "$CT0" -n 10
    ;;
  "search")
    bird search "$2" --auth-token "$AUTH_TOKEN" --ct0 "$CT0" -n 10
    ;;
  "whoami")
    bird whoami --auth-token "$AUTH_TOKEN" --ct0 "$CT0"
    ;;
  *)
    echo "Usage: $0 {post|mentions|search|whoami} [content]"
    echo "Examples:"
    echo "  $0 post 'Hello world'"  
    echo "  $0 search 'TON blockchain'"
    echo "  $0 mentions"
    ;;
esac

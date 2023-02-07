#!/bin/bash
source "$HOME/.nvm/nvm.sh"
nvm use 16
while sleep 1; do node ws/index.js; done

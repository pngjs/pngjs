#!/bin/bash
set -ev
if [ "${TRAVIS_NODE_VERSION}" = "0.12" ]; then
    npm coverage
    npm run coveralls
fi

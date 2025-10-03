# Quick Qodana scan - sem abrir relatório automaticamente
docker run --rm -it -v ${PWD}:/data/project/ -v ${PWD}/.qodana/cache:/data/cache/ jetbrains/qodana-js:latest

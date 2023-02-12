#!/bin/bash

SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )

kubectl --namespace nice-grpc get secret nice-grpc-web-tests -o jsonpath='{.data.tls\.crt}' | base64 --decode > $SCRIPT_DIR/tls.crt
kubectl --namespace nice-grpc get secret nice-grpc-web-tests -o jsonpath='{.data.tls\.key}' | base64 --decode > $SCRIPT_DIR/tls.key

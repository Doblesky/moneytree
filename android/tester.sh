#!/bin/bash
# Tests JVM du compagnon (logique pure, sans classe Android) : compile et lance android/test/.
set -euo pipefail
ICI="$(cd "$(dirname "$0")" && pwd)"
JDK="${JAVA_HOME:-C:/Program Files/Android/Android Studio/jbr}"
export PATH="$(cygpath -u "$JDK")/bin:$PATH"
SORTIE="$ICI/out/test"
mkdir -p "$SORTIE"
javac --release 11 -encoding UTF-8 -d "$SORTIE" \
  "$ICI/src/io/github/doblesky/moneytree/widget/Rotation.java" $(find "$ICI/test" -name '*.java')
java -cp "$SORTIE" io.github.doblesky.moneytree.widget.VerifRotation

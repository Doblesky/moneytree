#!/bin/bash
# Construit le compagnon Android signé (android/out/moneytree-widget.apk) avec les seuls outils
# du SDK Android, sans Gradle : aapt2, javac, d8, aapt, zipalign, apksigner.
#
# La clé de signature vit hors du dépôt, dans %USERPROFILE%\.moneytree\ (compagnon.jks et son
# mot de passe compagnon.mdp). Le script la crée au premier lancement. Si elle se perd, il
# suffit de désinstaller puis réinstaller le compagnon : la PWA lui renverra les cartes.
set -euo pipefail

VERSION_CODE=1
VERSION_NOM=1.0

ICI="$(cd "$(dirname "$0")" && pwd)"
SDK="${ANDROID_HOME:-$LOCALAPPDATA/Android/Sdk}"
OUTILS="$SDK/build-tools/36.0.0"
PLATEFORME="$SDK/platforms/android-37.0/android.jar"
JDK="${JAVA_HOME:-C:/Program Files/Android/Android Studio/jbr}"
export JAVA_HOME="$JDK"
export PATH="$(cygpath -u "$JDK")/bin:$PATH"
CLES="$(cygpath -m "$USERPROFILE")/.moneytree"
OUT="$ICI/out"

# Sous Windows, d8 et apksigner sont des scripts .bat.
outil() { if [ -f "$OUTILS/$1.bat" ]; then echo "$OUTILS/$1.bat"; else echo "$OUTILS/$1"; fi; }

rm -rf "${OUT:?}"
mkdir -p "$OUT/classes" "$OUT/gen" "$OUT/dex" "$OUT/res/drawable-nodpi"
cp "$ICI/../public/pwa-192x192.png" "$OUT/res/drawable-nodpi/icone.png"

"$OUTILS/aapt2" compile --dir "$ICI/res" -o "$OUT/res.zip"
"$OUTILS/aapt2" compile --dir "$OUT/res" -o "$OUT/icone.zip"
"$OUTILS/aapt2" link -o "$OUT/base.apk" -I "$PLATEFORME" --manifest "$ICI/AndroidManifest.xml" \
  --java "$OUT/gen" --min-sdk-version 31 --target-sdk-version 36 \
  --version-code "$VERSION_CODE" --version-name "$VERSION_NOM" "$OUT/res.zip" "$OUT/icone.zip"

javac --release 11 -nowarn -encoding UTF-8 -cp "$PLATEFORME" -d "$OUT/classes" \
  $(find "$ICI/src" "$OUT/gen" -name '*.java')
"$(outil d8)" --release --lib "$PLATEFORME" --min-api 31 --output "$OUT/dex" \
  $(find "$OUT/classes" -name '*.class')

cp "$OUT/base.apk" "$OUT/dex/non-signe.apk"
(cd "$OUT/dex" && "$OUTILS/aapt" add non-signe.apk classes.dex >/dev/null)
"$OUTILS/zipalign" -f -p 4 "$OUT/dex/non-signe.apk" "$OUT/aligne.apk"

if [ ! -f "$CLES/compagnon.jks" ]; then
  mkdir -p "$CLES"
  head -c 32 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' > "$CLES/compagnon.mdp"
  keytool -genkeypair -keystore "$CLES/compagnon.jks" -storepass:file "$CLES/compagnon.mdp" \
    -keypass:file "$CLES/compagnon.mdp" -alias compagnon -keyalg RSA -keysize 3072 \
    -validity 10000 -dname "CN=MoneyTree Widget" 2>/dev/null
  echo "Clé de signature créée dans $CLES (à garder, hors du dépôt)."
fi

# Sans --key-pass, apksigner reprend le mot de passe du trousseau (le même pour la clé).
"$(outil apksigner)" sign --ks "$CLES/compagnon.jks" --ks-pass "file:$CLES/compagnon.mdp" \
  --out "$OUT/moneytree-widget.apk" "$OUT/aligne.apk" 2>/dev/null
"$(outil apksigner)" verify "$OUT/moneytree-widget.apk" 2>/dev/null
echo "APK : $OUT/moneytree-widget.apk ($(wc -c < "$OUT/moneytree-widget.apk") octets, version $VERSION_NOM)"

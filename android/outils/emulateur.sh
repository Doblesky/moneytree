#!/bin/bash
# Petites fonctions pour tester le compagnon sur l'émulateur (à charger avec « source »).
# L'émulateur se lance à part, toujours en lecture seule :
#   emulator -avd Medium_Phone_API_37.0 -read-only -no-snapshot -no-window -no-audio -gpu swiftshader_indirect
export MSYS_NO_PATHCONV=1
ADB="${ADB:-$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe}"

# Attend la fin du démarrage, prépare Chrome (sans écrans d'accueil) et relie le port du serveur de dev.
# Le pont de l'émulateur passe en IPv4 : le serveur de dev doit écouter sur 127.0.0.1 (configuration
# « dev-emulateur » de .claude/launch.json, port 5174), vu comme localhost:5173 sur l'émulateur.
preparer() {
  "$ADB" wait-for-device
  until [ "$("$ADB" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = "1" ]; do "$ADB" shell sleep 2; done
  "$ADB" shell am set-debug-app --persistent com.android.chrome
  "$ADB" shell "echo '_ --disable-fre --no-default-browser-check --no-first-run' > /data/local/tmp/chrome-command-line"
  "$ADB" reverse tcp:5173 tcp:5174 >/dev/null
}

# Écran au premier plan.
focus() { "$ADB" shell "dumpsys window | grep mCurrentFocus" | tr -d '\r' | sed -E 's/.*u0 //; s/}$//'; }

# Éléments visibles, avec leur texte et leurs coordonnées.
elements() {
  "$ADB" shell "uiautomator dump /data/local/tmp/u.xml >/dev/null; cat /data/local/tmp/u.xml" | tr '>' '\n' |
    sed -nE 's/.* text="([^"]+)".*bounds="([^"]*)".*/\1 \2/p; s/.* text="".*content-desc="([^"]+)".*bounds="([^"]*)".*/\1 \2/p'
}

# Appuie au centre du premier élément dont le texte est exactement $1.
appuyer() {
  local b
  b=$("$ADB" shell "uiautomator dump /data/local/tmp/u.xml >/dev/null; cat /data/local/tmp/u.xml" | tr '>' '\n' |
    grep -E "(text|content-desc)=\"$1\"" | head -1 |
    sed -E 's/.*bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]".*/\1 \2 \3 \4/')
  [ -n "$b" ] || { echo "introuvable : $1" >&2; return 1; }
  set -- $b
  "$ADB" shell input tap $(( ($1 + $3) / 2 )) $(( ($2 + $4) / 2 ))
}

capture() { "$ADB" exec-out screencap -p > "$1"; }

# Journal du compagnon depuis le dernier « logcat -c ».
journal() { "$ADB" logcat -d -s MTWidget:* | grep -E "RECU|ACCEPTE|REFUS|FATAL" | sed -E 's/.*MTWidget *: //'; }

package io.github.doblesky.moneytree.widget;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/** Stockage privé du compagnon : le dernier paquet valide et le décalage « carte suivante ». */
final class Depot {
    static final String TAG = "MTWidget";
    private static final String FICHIER = "paquet.json";
    private static final String PREFS = "widget";

    private Depot() {}

    private static SharedPreferences prefs(Context c) {
        return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    /** Remplace le paquet enregistré (écriture dans un fichier temporaire, puis renommage). */
    static void enregistrer(Context c, String json) {
        File cible = new File(c.getFilesDir(), FICHIER);
        File temporaire = new File(c.getFilesDir(), FICHIER + ".tmp");
        try (FileOutputStream sortie = new FileOutputStream(temporaire)) {
            sortie.write(json.getBytes(StandardCharsets.UTF_8));
            sortie.getFD().sync();
        } catch (IOException e) {
            Log.w(TAG, "écriture du paquet impossible", e);
            return;
        }
        if (!temporaire.renameTo(cible)) {
            Log.w(TAG, "renommage du paquet impossible");
            return;
        }
        prefs(c).edit().putBoolean("versionInconnue", false).apply();
    }

    /** Dernier paquet valide, ou null s'il n'y en a pas. */
    static Paquet charger(Context c) {
        File fichier = new File(c.getFilesDir(), FICHIER);
        if (!fichier.exists()) return null;
        try {
            return Paquet.depuisJson(new String(Files.readAllBytes(fichier.toPath()), StandardCharsets.UTF_8));
        } catch (IOException | PaquetInvalide e) {
            Log.w(TAG, "paquet enregistré illisible", e);
            return null;
        }
    }

    static void noterVersionInconnue(Context c) {
        prefs(c).edit().putBoolean("versionInconnue", true).apply();
    }

    static boolean versionInconnue(Context c) {
        return prefs(c).getBoolean("versionInconnue", false);
    }

    static long decalage(Context c) {
        return prefs(c).getLong("decalage", 0);
    }

    static void avancer(Context c) {
        prefs(c).edit().putLong("decalage", decalage(c) + 1).apply();
    }
}

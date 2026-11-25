package io.github.doblesky.moneytree.widget;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;

/**
 * Alarme inexacte (sans permission spéciale, sans réveiller le téléphone) au début du créneau
 * suivant. Android 12 impose une fenêtre d'au moins 10 minutes ; endormi, le téléphone la
 * retarde jusqu'à son réveil, et la carte du créneau en cours s'affiche alors.
 */
final class Alarme {
    static final String ROTATION = "io.github.doblesky.moneytree.widget.ROTATION";
    private static final long FENETRE_MS = 10 * 60_000L;

    private Alarme() {}

    static void planifier(Context c, long maintenantMs, int intervalle) {
        long minutes = Math.floorDiv(maintenantMs, 60_000L);
        long debutSuivant = (Math.floorDiv(minutes, intervalle) + 1) * intervalle * 60_000L;
        AlarmManager alarmes = c.getSystemService(AlarmManager.class);
        alarmes.setWindow(AlarmManager.RTC, debutSuivant, FENETRE_MS, intention(c));
    }

    static void annuler(Context c) {
        c.getSystemService(AlarmManager.class).cancel(intention(c));
    }

    private static PendingIntent intention(Context c) {
        Intent rotation = new Intent(c, WidgetCartes.class).setAction(ROTATION);
        return PendingIntent.getBroadcast(c, 1, rotation,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}

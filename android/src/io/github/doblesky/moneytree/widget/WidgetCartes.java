package io.github.doblesky.moneytree.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;

/** Le widget : la carte du créneau en cours, le bouton « carte suivante » et l'appui qui la rouvre dans l'appli. */
public final class WidgetCartes extends AppWidgetProvider {
    /** Adresse de l'appli : une constante, jamais une valeur venue du paquet. */
    static final String APPLI = "https://doblesky.github.io/moneytree/";
    static final String SUIVANTE = "io.github.doblesky.moneytree.widget.SUIVANTE";

    @Override
    public void onUpdate(Context contexte, AppWidgetManager gestionnaire, int[] ids) {
        actualiserTout(contexte);
    }

    @Override
    public void onReceive(Context contexte, Intent intention) {
        super.onReceive(contexte, intention);
        String action = intention.getAction();
        if (SUIVANTE.equals(action)) Depot.avancer(contexte);
        if (SUIVANTE.equals(action) || Alarme.ROTATION.equals(action)) actualiserTout(contexte);
    }

    @Override
    public void onDisabled(Context contexte) {
        Alarme.annuler(contexte);
    }

    static void actualiserTout(Context c) {
        AppWidgetManager gestionnaire = AppWidgetManager.getInstance(c);
        ComponentName composant = new ComponentName(c, WidgetCartes.class);
        if (gestionnaire.getAppWidgetIds(composant).length == 0) return;
        Paquet paquet = Depot.charger(c);
        long maintenant = System.currentTimeMillis();
        Carte carte = null;
        if (paquet != null && !Depot.versionInconnue(c)) {
            int index = Rotation.indexCarte(Math.floorDiv(maintenant, 60_000L), paquet.intervalle,
                    paquet.cartes.size(), Depot.decalage(c));
            if (index >= 0) {
                carte = paquet.cartes.get(index);
                Alarme.planifier(c, maintenant, paquet.intervalle);
            }
        }
        gestionnaire.updateAppWidget(composant, vues(c, carte));
    }

    private static RemoteViews vues(Context c, Carte carte) {
        RemoteViews vues = new RemoteViews(c.getPackageName(), R.layout.widget_moyen);
        if (carte == null) {
            vues.setTextViewText(R.id.entete, "MoneyTree");
            vues.setTextViewText(R.id.titre, "");
            vues.setTextViewText(R.id.texte, c.getString(Depot.versionInconnue(c) ? R.string.mise_a_jour : R.string.vide));
            vues.setViewVisibility(R.id.fictif, View.GONE);
            vues.setViewVisibility(R.id.suivante, View.GONE);
            vues.setOnClickPendingIntent(android.R.id.background, ouvrir(c, APPLI));
            return vues;
        }
        vues.setTextViewText(R.id.entete, carte.moduleTitre + " · " + carte.palierNom);
        vues.setTextViewText(R.id.titre, carte.titre);
        vues.setTextViewText(R.id.texte, carte.premierParagraphe());
        vues.setViewVisibility(R.id.fictif, carte.fictif ? View.VISIBLE : View.GONE);
        vues.setViewVisibility(R.id.suivante, View.VISIBLE);
        vues.setOnClickPendingIntent(R.id.suivante, suivante(c));
        vues.setOnClickPendingIntent(android.R.id.background, ouvrir(c, lienCarte(carte)));
        return vues;
    }

    static String lienCarte(Carte carte) {
        return APPLI + "#/parcours/" + carte.module + "/" + carte.palier + "?carte=" + carte.rang;
    }

    private static PendingIntent ouvrir(Context c, String adresse) {
        Intent intention = new Intent(Intent.ACTION_VIEW, Uri.parse(adresse));
        intention.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        return PendingIntent.getActivity(c, 0, intention,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }

    private static PendingIntent suivante(Context c) {
        Intent intention = new Intent(c, WidgetCartes.class).setAction(SUIVANTE);
        return PendingIntent.getBroadcast(c, 2, intention,
                PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
    }
}

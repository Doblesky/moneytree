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

/** Le widget : une carte du dernier paquet, et l'appui qui la rouvre dans l'appli. */
public final class WidgetCartes extends AppWidgetProvider {
    /** Adresse de l'appli : une constante, jamais une valeur venue du paquet. */
    static final String APPLI = "https://doblesky.github.io/moneytree/";

    @Override
    public void onUpdate(Context contexte, AppWidgetManager gestionnaire, int[] ids) {
        actualiserTout(contexte);
    }

    static void actualiserTout(Context c) {
        AppWidgetManager gestionnaire = AppWidgetManager.getInstance(c);
        gestionnaire.updateAppWidget(new ComponentName(c, WidgetCartes.class), vues(c));
    }

    private static RemoteViews vues(Context c) {
        RemoteViews vues = new RemoteViews(c.getPackageName(), R.layout.widget_moyen);
        Paquet paquet = Depot.charger(c);
        Carte carte = paquet == null || paquet.cartes.isEmpty() ? null : paquet.cartes.get(0);
        if (Depot.versionInconnue(c) || carte == null) {
            vues.setTextViewText(R.id.entete, "MoneyTree");
            vues.setTextViewText(R.id.titre, "");
            vues.setTextViewText(R.id.texte, c.getString(Depot.versionInconnue(c) ? R.string.mise_a_jour : R.string.vide));
            vues.setViewVisibility(R.id.fictif, View.GONE);
            vues.setOnClickPendingIntent(android.R.id.background, ouvrir(c, APPLI));
            return vues;
        }
        vues.setTextViewText(R.id.entete, carte.moduleTitre + " · " + carte.palierNom);
        vues.setTextViewText(R.id.titre, carte.titre);
        vues.setTextViewText(R.id.texte, carte.premierParagraphe());
        vues.setViewVisibility(R.id.fictif, carte.fictif ? View.VISIBLE : View.GONE);
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
}

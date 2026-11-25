package io.github.doblesky.moneytree.widget;

import android.app.Activity;
import android.net.Uri;
import android.os.Bundle;
import android.util.Log;

/** Reçoit le paquet envoyé par la PWA, l'enregistre, met à jour le widget et se ferme sans rien afficher. */
public final class SyncActivity extends Activity {
    @Override
    protected void onCreate(Bundle etat) {
        super.onCreate(etat);
        try {
            recevoir();
        } catch (RuntimeException | StackOverflowError e) {
            // Un lien hostile ne doit jamais faire planter le compagnon : on l'ignore.
            Log.w(Depot.TAG, "REFUS erreur inattendue : " + e);
        }
        finish();
    }

    private void recevoir() {
        Uri lien = getIntent().getData();
        String donnees = lien == null || lien.isOpaque() ? null : lien.getQueryParameter("d");
        Log.i(Depot.TAG, "RECU octets=" + (donnees == null ? 0 : donnees.length()));
        try {
            Paquet paquet = Paquet.lire(donnees);
            Depot.enregistrer(this, paquet.json);
            Log.i(Depot.TAG, "ACCEPTE cartes=" + paquet.cartes.size());
        } catch (PaquetInvalide e) {
            Log.w(Depot.TAG, "REFUS " + e.getMessage());
            if (e.versionInconnue) Depot.noterVersionInconnue(this);
        }
        WidgetCartes.actualiserTout(this);
    }
}

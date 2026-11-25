package io.github.doblesky.moneytree.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Après un redémarrage ou un changement d'heure, les alarmes sont perdues ou décalées : on les replanifie. */
public final class Demarrage extends BroadcastReceiver {
    @Override
    public void onReceive(Context contexte, Intent intention) {
        WidgetCartes.actualiserTout(contexte);
    }
}

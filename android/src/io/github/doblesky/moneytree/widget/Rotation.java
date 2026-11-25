package io.github.doblesky.moneytree.widget;

import java.util.Random;

/**
 * Choix de la carte affichée, qui ne dépend que de l'heure : le temps est découpé en créneaux
 * de « intervalle » minutes, et chaque cycle de n créneaux montre les n cartes une fois chacune,
 * dans un ordre mélangé propre au cycle. Aucune classe Android : testé sur la JVM.
 */
final class Rotation {
    private Rotation() {}

    /** Index de la carte à afficher, ou -1 s'il n'y a aucune carte. */
    static int indexCarte(long minutesEpoch, int intervalle, int n, long decalage) {
        if (n <= 0) return -1;
        long creneau = Math.floorDiv(minutesEpoch, intervalle) + decalage;
        int[] ordre = melange(n, Math.floorDiv(creneau, n));
        return ordre[(int) Math.floorMod(creneau, n)];
    }

    /** Permutation de 0..n-1 (Fisher-Yates), toujours la même pour une même graine. */
    static int[] melange(int n, long graine) {
        int[] ordre = new int[n];
        for (int i = 0; i < n; i++) ordre[i] = i;
        Random hasard = new Random(graine);
        for (int i = n - 1; i > 0; i--) {
            int j = hasard.nextInt(i + 1);
            int t = ordre[i];
            ordre[i] = ordre[j];
            ordre[j] = t;
        }
        return ordre;
    }
}

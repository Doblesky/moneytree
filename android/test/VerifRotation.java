package io.github.doblesky.moneytree.widget;

import java.util.HashSet;
import java.util.Set;

/** Tests de Rotation, sans dépendance : lancés par android/tester.sh, sortie 1 au premier échec. */
public final class VerifRotation {
    private static void verifier(boolean condition, String message) {
        if (!condition) {
            System.err.println("ÉCHEC : " + message);
            System.exit(1);
        }
    }

    private static void unCycleVoitChaqueCarteUneFois(long cycle) {
        int n = 7;
        int intervalle = 10;
        Set<Integer> vus = new HashSet<>();
        for (long creneau = cycle * n; creneau < cycle * n + n; creneau++) {
            vus.add(Rotation.indexCarte(creneau * intervalle, intervalle, n, 0));
        }
        verifier(vus.size() == n, "le cycle " + cycle + " doit montrer les " + n + " cartes une fois chacune");
    }

    public static void main(String[] args) {
        verifier(Rotation.indexCarte(29_000_000, 10, 0, 0) == -1, "aucune carte → -1");

        for (long m = 0; m < 500; m += 7) {
            verifier(Rotation.indexCarte(m, 10, 1, 0) == 0, "une seule carte → toujours 0");
        }

        unCycleVoitChaqueCarteUneFois(0);
        unCycleVoitChaqueCarteUneFois(123);
        unCycleVoitChaqueCarteUneFois(-3);

        verifier(Rotation.indexCarte(29_123_456, 15, 40, 3) == Rotation.indexCarte(29_123_456, 15, 40, 3),
                "deux appels identiques → même carte");

        for (long m = 29_000_000; m < 29_000_600; m += 37) {
            verifier(Rotation.indexCarte(m, 10, 13, 1) == Rotation.indexCarte(m + 10, 10, 13, 0),
                    "« carte suivante » = créneau suivant (minute " + m + ")");
        }

        for (long m = -500; m < 0; m += 11) {
            int i = Rotation.indexCarte(m, 30, 9, 0);
            verifier(i >= 0 && i < 9, "minutes négatives → index valide");
        }

        System.out.println("Rotation : OK");
    }
}

package io.github.doblesky.moneytree.widget;

/**
 * Profondeur d'imbrication d'un texte JSON, mesurée sans le lire : l'analyseur JSON d'Android
 * est récursif, et un paquet hostile très imbriqué ferait déborder sa pile. Aucune classe
 * Android : testé sur la JVM.
 */
final class Profondeur {
    /** Un paquet valide a une profondeur de 3 (objet, tableau de cartes, carte). */
    static final int MAX = 8;

    private Profondeur() {}

    /** Profondeur maximale atteinte par les { et [ hors des chaînes. */
    static int max(String json) {
        int courante = 0;
        int maximum = 0;
        boolean dansChaine = false;
        for (int i = 0; i < json.length(); i++) {
            char c = json.charAt(i);
            if (dansChaine) {
                if (c == '\\') i++;
                else if (c == '"') dansChaine = false;
            } else if (c == '"') {
                dansChaine = true;
            } else if (c == '{' || c == '[') {
                maximum = Math.max(maximum, ++courante);
            } else if (c == '}' || c == ']') {
                courante--;
            }
        }
        return maximum;
    }
}

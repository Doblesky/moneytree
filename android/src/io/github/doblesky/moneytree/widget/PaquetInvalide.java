package io.github.doblesky.moneytree.widget;

/** Paquet refusé : il ne remplace pas le précédent. */
final class PaquetInvalide extends Exception {
    /** Le format est d'une version plus récente : le compagnon est à mettre à jour. */
    final boolean versionInconnue;

    PaquetInvalide(String raison) {
        this(raison, false);
    }

    PaquetInvalide(String raison, boolean versionInconnue) {
        super(raison);
        this.versionInconnue = versionInconnue;
    }
}

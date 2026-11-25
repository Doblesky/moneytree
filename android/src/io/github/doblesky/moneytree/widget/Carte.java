package io.github.doblesky.moneytree.widget;

/** Une carte de cours du paquet (même champs que CarteWidget, src/widget/paquet.ts). */
final class Carte {
    final String id;
    final int module;
    final int palier;
    final int rang;
    final String moduleTitre;
    final String palierNom;
    final String titre;
    final String texte;
    final boolean fictif;

    Carte(String id, int module, int palier, int rang, String moduleTitre, String palierNom,
            String titre, String texte, boolean fictif) {
        this.id = id;
        this.module = module;
        this.palier = palier;
        this.rang = rang;
        this.moduleTitre = moduleTitre;
        this.palierNom = palierNom;
        this.titre = titre;
        this.texte = texte;
        this.fictif = fictif;
    }

    /** Premier paragraphe du texte (les paragraphes sont séparés par une ligne vide). */
    String premierParagraphe() {
        int fin = texte.indexOf("\n\n");
        return fin < 0 ? texte : texte.substring(0, fin);
    }
}

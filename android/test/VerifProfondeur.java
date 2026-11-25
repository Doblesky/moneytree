package io.github.doblesky.moneytree.widget;

/** Tests de Profondeur, sans dépendance : lancés par android/tester.sh, sortie 1 au premier échec. */
public final class VerifProfondeur {
    private static void verifier(boolean condition, String message) {
        if (!condition) {
            System.err.println("ÉCHEC : " + message);
            System.exit(1);
        }
    }

    public static void main(String[] args) {
        verifier(Profondeur.max("{\"v\":1,\"cartes\":[{\"id\":\"a\"}]}") == 3, "objet > tableau > objet → 3");
        verifier(Profondeur.max("{\"texte\":\"[[[[[[[[[[ {{{{{{{{ \\\" [[[[\"}") == 1,
                "les crochets dans une chaîne, même après un guillemet échappé, ne comptent pas");
        verifier(Profondeur.max("[".repeat(500_000)) > Profondeur.MAX, "500 000 crochets ouvrants → trop profond");
        verifier(Profondeur.max("") == 0, "chaîne vide → 0");
        System.out.println("Profondeur : OK");
    }
}

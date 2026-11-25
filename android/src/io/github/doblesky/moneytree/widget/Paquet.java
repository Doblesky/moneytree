package io.github.doblesky.moneytree.widget;

import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.List;
import java.util.zip.DataFormatException;
import java.util.zip.Inflater;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

/**
 * Paquet de cartes envoyé par la PWA : JSON compressé en deflate-raw, puis base64url.
 * N'importe quelle page peut ouvrir le lien : tout est validé, et rien n'est exécuté.
 */
final class Paquet {
    static final int VERSION = 1;
    static final int TAILLE_MAX_DECODEE = 512_000;
    static final int CARTES_MAX = 2_000;

    final String json;
    final String profil;
    final int intervalle;
    final List<Carte> cartes;

    private Paquet(String json, String profil, int intervalle, List<Carte> cartes) {
        this.json = json;
        this.profil = profil;
        this.intervalle = intervalle;
        this.cartes = cartes;
    }

    /** Décode, décompresse et valide le paramètre « d » du lien. */
    static Paquet lire(String base64url) throws PaquetInvalide {
        if (base64url == null || base64url.isEmpty()) throw new PaquetInvalide("paquet vide");
        byte[] compresse;
        try {
            compresse = Base64.getUrlDecoder().decode(base64url);
        } catch (IllegalArgumentException e) {
            throw new PaquetInvalide("base64url invalide");
        }
        return depuisJson(decompresser(compresse));
    }

    private static String decompresser(byte[] compresse) throws PaquetInvalide {
        Inflater inflater = new Inflater(true);
        // Avec nowrap, l'inflater attend un octet de plus après les données.
        byte[] entree = new byte[compresse.length + 1];
        System.arraycopy(compresse, 0, entree, 0, compresse.length);
        inflater.setInput(entree);
        ByteArrayOutputStream sortie = new ByteArrayOutputStream();
        byte[] tampon = new byte[16_384];
        try {
            while (!inflater.finished()) {
                int n = inflater.inflate(tampon);
                if (n == 0 && (inflater.needsInput() || inflater.needsDictionary())) break;
                sortie.write(tampon, 0, n);
                if (sortie.size() > TAILLE_MAX_DECODEE) throw new PaquetInvalide("paquet trop gros");
            }
            if (!inflater.finished()) throw new PaquetInvalide("données compressées incomplètes");
        } catch (DataFormatException e) {
            throw new PaquetInvalide("données compressées invalides");
        } finally {
            inflater.end();
        }
        return new String(sortie.toByteArray(), StandardCharsets.UTF_8);
    }

    /** Valide un paquet déjà décodé (celui reçu, ou celui enregistré). */
    static Paquet depuisJson(String json) throws PaquetInvalide {
        try {
            JSONObject racine = new JSONObject(json);
            int version = racine.getInt("v");
            if (version != VERSION) throw new PaquetInvalide("version " + version, version > VERSION);
            String profil = texte(racine, "profil", 40);
            int intervalle = entier(racine, "intervalle", 10, 1440);
            JSONArray tableau = racine.getJSONArray("cartes");
            if (tableau.length() > CARTES_MAX) throw new PaquetInvalide("trop de cartes");
            List<Carte> cartes = new ArrayList<>(tableau.length());
            for (int i = 0; i < tableau.length(); i++) {
                JSONObject c = tableau.getJSONObject(i);
                cartes.add(new Carte(
                        texte(c, "id", 40),
                        entier(c, "module", 0, 99),
                        entier(c, "palier", 1, 5),
                        entier(c, "rang", 0, 50),
                        texte(c, "moduleTitre", 120),
                        texte(c, "palierNom", 60),
                        texte(c, "titre", 300),
                        texte(c, "texte", 6_000),
                        c.getBoolean("fictif")));
            }
            return new Paquet(json, profil, intervalle, Collections.unmodifiableList(cartes));
        } catch (JSONException e) {
            throw new PaquetInvalide("JSON invalide : " + e.getMessage());
        }
    }

    private static String texte(JSONObject objet, String cle, int longueurMax)
            throws JSONException, PaquetInvalide {
        String valeur = objet.getString(cle);
        if (valeur.length() > longueurMax) throw new PaquetInvalide(cle + " trop long");
        return valeur;
    }

    private static int entier(JSONObject objet, String cle, int min, int max)
            throws JSONException, PaquetInvalide {
        Object brut = objet.get(cle);
        if (!(brut instanceof Integer)) throw new PaquetInvalide(cle + " n'est pas un entier");
        int valeur = (Integer) brut;
        if (valeur < min || valeur > max) throw new PaquetInvalide(cle + " hors bornes");
        return valeur;
    }
}

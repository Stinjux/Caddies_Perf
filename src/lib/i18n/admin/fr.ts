/**
 * Interface d'ADMINISTRATION en francais — langue de reference.
 *
 * Toute chaine visible par un administrateur vit ici. Une chaine ecrite en
 * dur dans une page ne se traduit pas : elle reste en francais pour un
 * lecteur anglophone, sans que rien ne le signale.
 */
export const adminFr = {
  langue: {
    label: "Langue",
    fr: "Français",
    en: "English",
  },

  nav: {
    parcours: "Parcours",
    caddies: "Caddies",
    qr: "Affiche QR",
    comptes: "Comptes",
    rapports: "Rapports",
    journal: "Journal",
    deconnexion: "Déconnexion",
    parcoursActif: "Parcours actif",
    changer: "Changer",
  },

  commun: {
    administrateur: "Administrateur",
    adminGeneral: "Administrateur général",
    starter: "Starter",
    actif: "Actif",
    archive: "Archivé",
    desactive: "Désactivé",
    enregistrer: "Enregistrer",
    retour: "Retour",
    filtrer: "Filtrer",
    tous: "Tous",
    toutes: "Toutes",
    du: "Du",
    au: "Au",
    obligatoire: "Obligatoire.",
  },

  connexion: {
    sousTitre: "Connexion",
    courriel: "Adresse de courriel",
    motDePasse: "Mot de passe",
    seConnecter: "Se connecter",
    echec: "Connexion impossible.",
  },

  choisir: {
    titre: "Choisissez votre parcours",
  },

  parcours: {
    titre: "Parcours",
    ajouter: "Ajouter un parcours",
    aucunRattache: "Aucun parcours n'est rattaché à votre compte.",
    aucunDuTout: "Aucun parcours n'existe encore. Créez le premier.",
    reserveGeneral: "Seul un administrateur général peut créer un parcours.",
    tousLesParcours: "Vous voyez tous les parcours de la plateforme.",
  },

  formParcours: {
    nouveau: "Nouveau parcours",
    nom: "Nom du parcours",
    adresse: "Adresse",
    fuseau: "Fuseau horaire",
    fuseauAide: "Toutes les dates du parcours s'affichent dans ce fuseau, jamais celui du lecteur.",
    couleurPrincipale: "Couleur principale",
    couleurSecondaire: "Couleur secondaire",
    logo: "Logo",
    logoAide: (formats: string) => `Formats acceptés : ${formats}. 512 Ko maximum.`,
    lienGoogle: "Lien Google Reviews",
    lienGoogleAide: "Adresse https propre à ce parcours.",
  },

  comptes: {
    titre: "Comptes du parcours",
    cree: "Compte créé.",
    creationImpossible: "Création impossible.",
    ajouter: "Ajouter un compte",
    prenom: "Prénom",
    nom: "Nom",
    courriel: "Adresse de courriel",
    motDePasse: "Mot de passe (12 caractères minimum)",
    creer: "Créer le compte",
    niveaux: "Deux niveaux d'administration",
    niveauxDetail:
      "Un administrateur gère le parcours auquel il est rattaché. Un administrateur général gère tous les parcours, y compris ceux créés plus tard, et lui seul peut créer un parcours.",
    sectionGeneraux: "Administrateurs généraux",
    aucunGeneral: "Aucun administrateur général.",
    rosterDetail:
      "Sur toute la plateforme. Pour accorder ou retirer ce niveau, passez par la liste des comptes du parcours où la personne est rattachée.",
    cestVous: "(vous)",
    promouvoir: "Promouvoir administrateur général",
    retirer: "Retirer le niveau général",
    promu: "Niveau général accordé.",
    retire: "Niveau général retiré.",
  },

  caddies: {
    titre: "Caddies",
    importer: "Importer un fichier CSV",
    aucun: "Aucun caddie enregistré. Importez un fichier CSV pour commencer.",
    anciennete: (n: number) => `${n} an${n > 1 ? "s" : ""} d'ancienneté`,
    ancienneteInconnue: "Ancienneté non renseignée",
    disponible: "Disponible",
    indisponible: "Indisponible",
    renseignements: "Renseignements",
    depart: "Départ",
  },

  import: {
    titre: "Importer des caddies",
    bilan: (crees: string, remplaces: string, ignores: string) =>
      `${crees} caddie(s) créé(s), ${remplaces} remplacé(s), ${ignores} ignoré(s).`,
    aucunFichier: "Aucun fichier sélectionné.",
    avertissementTitre: "Trois colonnes ne seront jamais conservées",
    avertissementDetail:
      "La taille d'habits, la force et l'adresse du domicile sont lues puis rejetées. Elles ne peuvent pas être stockées : la base n'a aucune colonne pour les recevoir.",
    avertissementAge:
      "L'âge est converti en année de naissance et rangé dans un espace séparé, accessible aux seuls administrateurs.",
    colonnesAttendues: "Colonnes attendues, dans cet ordre",
    rejetee: " — rejetée",
    detection:
      "L'encodage et le séparateur sont détectés automatiquement. La ligne d'en-tête est reconnue si elle est présente.",
    fichier: "Fichier CSV",
    bouton: "Importer",
  },

  pii: {
    sousTitre:
      "Renseignements personnels · accès réservé aux administrateurs. Chaque consultation et chaque modification est journalisée.",
    anneeNaissance: "Année de naissance",
    aide: "Seule donnée d'âge conservée. Ni date complète, ni taille d'habits, ni adresse : le schéma de la base ne peut pas les recevoir.",
    enregistrerCorrection: "Enregistrer la correction",
    corrigee: "Correction enregistrée.",
    effacees: "Renseignements effacés.",
    correctionImpossible: "Correction impossible.",
    effacementDetail:
      "L'effacement est définitif. Les évaluations et les moyennes du parcours restent inchangées.",
    effacer: "Effacer les renseignements personnels",
  },

  qr: {
    titre: "Affiche du départ",
    explication:
      "Imprimez cette page et affichez-la au départ. Un seul code suffit pour tout le parcours : le client choisit ensuite son caddie dans une liste. Le code est permanent — la même affiche vaut d'une saison à l'autre.",
    manqueUrl:
      "Impression impossible : l'adresse publique du site (PUBLIC_BASE_URL) n'est pas configurée. Sans elle, l'affiche ne mènerait nulle part.",
    evaluez: "Évaluez votre caddie",
    scannez: "Scannez ce code — moins de 30 secondes, sans application à installer.",
  },

  rapports: {
    titre: "Rapports",
    explication: (seuil: number) =>
      `Les comparaisons portent sur le même parcours, la même période et les mêmes critères. En deçà de ${seuil} évaluations, un écart est affiché mais signalé comme non significatif.`,
    evalMin: "Évaluations minimum",
    statut: "Statut",
    actifs: "Actifs",
    desactives: "Désactivés",
    exporter: "Exporter en CSV",
    tuileEvaluations: "Évaluations",
    tuileNote: "Note du parcours",
    tuileClics: "Clics vers Google",
    caddies: "Caddies",
    aucunCaddie: "Aucun caddie ne correspond à ces critères.",
    colCaddie: "Caddie",
    colEvals: "Évals",
    colCompetences: "Compétences",
    colExperience: "Expérience",
    colScore: "Score",
    colEcart: "Écart",
    nonSignificatif: "non significatif",
    distribution: "Distribution des notes",
    aucuneNote: "Aucune note sur la période.",
    perceptionPrix: "Perception du prix",
    jamaisDansScore: "N'entre jamais dans le score d'un caddie.",
    aucuneReponse: "Aucune réponse sur la période.",
    criteresMesures: (liste: string) =>
      `Critères mesurés : ${liste}. Aucune donnée personnelle ne figure dans ce rapport.`,
    criteres: {
      accueil: "Accueil",
      regles_etiquette: "Règles",
      connaissance_parcours: "Parcours",
      lecture_verts: "Verts",
      communication: "Communication",
      experience_generale: "Expérience",
    },
    prix: {
      beaucoup_trop_bas: "Beaucoup trop bas",
      plutot_bas: "Plutôt bas",
      juste_et_raisonnable: "Juste et raisonnable",
      plutot_eleve: "Plutôt élevé",
      beaucoup_trop_eleve: "Beaucoup trop élevé",
    },
  },

  journal: {
    titre: "Journal des actions",
    explication:
      "Ce journal est en écriture seule. Aucune entrée ne peut être modifiée ni supprimée, et aucune donnée personnelle n'y figure.",
    nature: "Nature",
    auteur: "Auteur",
    aucune: "Aucune action ne correspond à ces critères.",
    par: "par",
    actions: {
      "course.create": "Parcours créé",
      "course.update": "Parcours modifié",
      "course.archive": "Parcours archivé",
      "account.create": "Compte créé",
      "account.update": "Compte modifié",
      "account.disable": "Compte désactivé",
      "account.enable": "Compte réactivé",
      "account.attach": "Compte rattaché",
      "account.detach": "Compte détaché",
      "account.password_reset": "Mot de passe réinitialisé",
      "account.grant_general": "Niveau général accordé",
      "account.revoke_general": "Niveau général retiré",
      "caddie.create": "Caddie créé",
      "caddie.update": "Caddie modifié",
      "caddie.disable": "Caddie désactivé",
      "pii.read": "Renseignements personnels consultés",
      "pii.write": "Renseignements personnels modifiés",
      "pii.erase": "Renseignements personnels effacés",
      "retention.purge": "Purge à échéance",
      "caddie.list": "Liste des caddies consultée",
      "caddie.read": "Fiche caddie consultée",
      "account.list": "Liste des comptes consultée",
      "report.read": "Rapport consulté",
      "report.export": "Rapport exporté",
      "audit.read": "Journal consulté",
    },
  },

  erreur: {
    titre: "Action impossible",
    detail: "Vous n'avez pas les droits nécessaires, ou cette page n'existe pas.",
    reessayer: "Réessayer",
    retourParcours: "Retour aux parcours",
  },
} as const;

/**
 * Les chaines francaises servent de MOULE a toutes les autres langues.
 *
 * Sans elargissement, `as const` figerait chaque texte en type litteral et
 * aucune traduction ne pourrait etre affectee. Elargi, le moule ne retient
 * que la FORME : les memes cles, aux memes endroits, avec les memes
 * parametres de fonction. Une traduction a laquelle il manque une cle, ou
 * dont une fonction ne prend pas les bons arguments, ne compile pas.
 */
type Elargi<T> = T extends string
  ? string
  : T extends (...args: infer A) => infer R
    ? (...args: A) => R
    : { [K in keyof T]: Elargi<T[K]> };

export type TextesAdmin = Elargi<typeof adminFr>;

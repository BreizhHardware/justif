// Chaînes UI centralisées pour faciliter les futures contributions i18n.
// Seul le français est fourni au lancement ; ajouter une clé de langue
// supplémentaire ici suffit pour proposer une nouvelle traduction.

export const messages = {
  fr: {
    appName: "Justif",
    nav: {
      expenses: "Dépenses",
      upload: "Importer",
      settings: "Paramètres",
      users: "Utilisateurs",
      logout: "Déconnexion",
    },
    login: {
      title: "Connexion",
      email: "Email",
      password: "Mot de passe",
      submit: "Se connecter",
      error: "Identifiants invalides",
    },
    setup: {
      title: "Bienvenue sur Justif",
      subtitle: "Créez votre compte administrateur pour démarrer",
      submit: "Créer le compte",
    },
    expenses: {
      title: "Dépenses",
      date: "Date",
      fournisseur: "Fournisseur",
      categorie: "Catégorie",
      description: "Description",
      montantOriginal: "Montant original",
      devise: "Devise",
      montantEur: "Montant TTC",
      justificatif: "Justificatif",
      export: "Exporter",
      delete: "Supprimer",
      deleteConfirm: "Confirmer la suppression de cette dépense ?",
      recalculate: "Recalculer",
      conversionFailed: "Conversion devise échouée",
      noResults: "Aucune dépense trouvée",
      filters: {
        from: "Du",
        to: "Au",
        categorie: "Catégorie",
        devise: "Devise",
        search: "Rechercher...",
      },
      myExpenses: "Mes dépenses",
      exportDialog: {
        title: "Des dépenses ont déjà été exportées",
        description:
          "Certaines dépenses de cette sélection ont déjà été incluses dans une note de frais précédente. Choisissez celles à inclure à nouveau dans cet export :",
        freshLabel: "dépense(s) jamais exportée(s) — toujours incluse(s)",
        confirm: "Exporter",
        cancel: "Annuler",
      },
    },
    upload: {
      title: "Importer un justificatif",
      dropzone: "Glissez un fichier ici ou cliquez pour sélectionner",
      analyzing: "Analyse en cours...",
      save: "Enregistrer",
      ocrError: "Erreur d'analyse OCR — vous pouvez saisir les champs manuellement",
    },
    settings: {
      title: "Paramètres",
      ocrProvider: "Fournisseur OCR",
      cloud: "Cloud (Mistral)",
      local: "Local (Ollama)",
      apiKey: "Clé API Mistral",
      model: "Modèle",
      ollamaUrl: "URL Ollama",
      defaultCurrency: "Devise par défaut",
      testConnection: "Tester la connexion",
      save: "Enregistrer",
      saved: "Paramètres enregistrés",
    },
    users: {
      title: "Utilisateurs",
      email: "Email",
      password: "Mot de passe",
      role: "Rôle",
      admin: "Administrateur",
      user: "Utilisateur",
      active: "Actif",
      inactive: "Désactivé",
      create: "Créer un utilisateur",
      newUserTitle: "Nouvel utilisateur",
      deactivate: "Désactiver",
      activate: "Réactiver",
      makeAdmin: "Promouvoir admin",
      makeUser: "Rétrograder utilisateur",
      you: "vous",
    },
    categories: ["Repas", "Transport", "Hébergement", "Matériel", "Logiciel", "Formation", "Autre"],
  },
} as const;

export type Locale = keyof typeof messages;
export const defaultLocale: Locale = "fr";

export function t() {
  return messages[defaultLocale];
}

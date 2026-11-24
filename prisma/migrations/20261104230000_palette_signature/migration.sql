-- Accueil de l'équipe : la palette « Signature » devient celle d'origine. L'hôtel de démonstration
-- y revient (ses couleurs de rubriques et de pastilles choisies sont effacées).
UPDATE "Hotel"
SET "couleursEquipe" = "couleursEquipe" - ARRAY[
  'commandesFond', 'commandesIcone', 'commandesTexte',
  'questionsFond', 'questionsIcone', 'questionsTexte',
  'avisFond', 'avisIcone', 'avisTexte', 'pastilles'
]
WHERE "slug" = 'hotel-saly' AND jsonb_typeof("couleursEquipe") = 'object';
